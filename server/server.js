const express = require('express');
const { exec } = require('child_process');
const multer = require('multer');
const cors = require('cors');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const http = require('http');

const app = express();
const port = 3001;

// Create HTTP server
const server = http.createServer(app);

// Configure CORS
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Create WebSocket server with proper configuration
const wss = new WebSocket.Server({ 
  server,
  path: '/ws/ssh',
  perMessageDeflate: false,
  clientTracking: true
});

// Configure multer with custom storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

app.use(express.json());

// SSH configuration
const sshConfig = {
    username: 'root',
    password: 'arastra',
    tryKeyboard: true,
    readyTimeout: 5000
};

// Add this function near the top of the file, after the imports
const resolvePath = (relativePath, basePath = '/opt') => {
    if (relativePath.startsWith('/')) {
        return relativePath;
    }
    // Handle ../ patterns
    const parts = relativePath.split('/');
    const baseParts = basePath.split('/');
    
    for (const part of parts) {
        if (part === '..') {
            baseParts.pop();
        } else if (part !== '.') {
            baseParts.push(part);
        }
    }
    
    return baseParts.join('/');
};

// Modify the inspect endpoint
app.get('/api/containerlab/inspect', (req, res) => {
    exec('clab inspect --all --format json', (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }

        try {
            const data = JSON.parse(stdout);
            const topologies = [];
            const labsByFile = {};

            // Group nodes by topology file
            data.containers.forEach(container => {
                // Resolve the full path for the topology file
                const fullLabPath = resolvePath(container.labPath);
                
                if (!labsByFile[fullLabPath]) {
                    labsByFile[fullLabPath] = {
                        labPath: fullLabPath, // Use the full path
                        lab_name: container.lab_name,
                        lab_owner: container.owner,
                        nodes: []
                    };
                    topologies.push(labsByFile[fullLabPath]);
                }
                labsByFile[fullLabPath].nodes.push({
                    ...container,
                    labPath: fullLabPath // Also update the path in the node data
                });
            });

            res.json(topologies);
        } catch (parseError) {
            res.status(500).json({
                error: 'Failed to parse JSON output',
                details: parseError.message,
                rawOutput: stdout
            });
        }
    });
});

// Updated deployment endpoint with containerlab deployment
app.post('/api/containerlab/deploy', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { serverIp } = req.body;
        if (!serverIp) {
            return res.status(400).json({ error: 'Server IP is required' });
        }

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const ssh = new NodeSSH();
        
        // Connect to the remote server
        try {
            res.write('Connecting to server...\n');
            await ssh.connect({
                ...sshConfig,
                host: serverIp,
            });
            res.write('Connected successfully\n');
        } catch (error) {
            res.write(`Failed to connect to server: ${error.message}\n`);
            res.end();
            return;
        }

        const remoteFilePath = `/opt/containerlab_topologies/${req.file.originalname}`;

        try {
            // Create the containerlab_topologies directory if it doesn't exist
            res.write('Ensuring target directory exists...\n');
            await ssh.execCommand('mkdir -p /opt/containerlab_topologies', {
                cwd: '/'
            });

            // Upload the file to the remote server
            res.write(`Uploading file to ${remoteFilePath}...\n`);
            await ssh.putFile(req.file.path, remoteFilePath);
            res.write('File uploaded successfully\n');

            // Execute containerlab deploy command with absolute path
            res.write('Executing containerlab deploy command...\n');
            const deployCommand = `clab deploy --topo ${remoteFilePath}`;
            const result = await ssh.execCommand(deployCommand, {
                cwd: '/', // Use root directory to ensure absolute paths work correctly
                onStdout: (chunk) => {
                    res.write(`stdout: ${chunk.toString()}\n`);
                },
                onStderr: (chunk) => {
                    res.write(`stderr: ${chunk.toString()}\n`);
                }
            });

            // Clean up the temporary file
            fs.unlinkSync(req.file.path);
            
            if (result.code === 0) {
                res.write('Operation completed successfully\n');
                res.end(JSON.stringify({
                    success: true,
                    message: 'Topology deployed successfully',
                    filePath: remoteFilePath
                }));
            } else {
                res.write(`Operation failed: ${result.stderr}\n`);
                res.end(JSON.stringify({
                    success: false,
                    message: 'Deployment failed',
                    error: result.stderr
                }));
            }

        } catch (error) {
            // Clean up the temporary file in case of error
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            res.write(`Operation failed: ${error.message}\n`);
            res.end(JSON.stringify({
                error: `Deployment failed: ${error.message}`
            }));
        } finally {
            ssh.dispose();
        }

    } catch (error) {
        // Clean up the temporary file in case of error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.write(`Server error: ${error.message}\n`);
        res.end(JSON.stringify({
            error: `Server error: ${error.message}`
        }));
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Modify the destroy endpoint
app.post('/api/containerlab/destroy', async (req, res) => {
    try {
        const { serverIp, topoFile } = req.body;
        
        if (!serverIp || !topoFile) {
            return res.status(400).json({ 
                error: 'Server IP and topology file path are required' 
            });
        }

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const ssh = new NodeSSH();
        
        // Connect to the remote server
        try {
            res.write('Connecting to server...\n');
            await ssh.connect({
                ...sshConfig,
                host: serverIp,
            });
            res.write('Connected successfully\n');
        } catch (error) {
            res.write(`Failed to connect to server: ${error.message}\n`);
            res.end();
            return;
        }

        try {
            // Execute containerlab destroy command
            res.write('Executing containerlab destroy command...\n');
            // Ensure we have an absolute path
            const absoluteTopoPath = resolvePath(topoFile);
            const destroyCommand = `clab destroy --topo ${absoluteTopoPath}`;
            const result = await ssh.execCommand(destroyCommand, {
                cwd: '/', // Use root directory to ensure absolute paths work correctly
                onStdout: (chunk) => {
                    res.write(`stdout: ${chunk.toString()}\n`);
                },
                onStderr: (chunk) => {
                    res.write(`stderr: ${chunk.toString()}\n`);
                }
            });

            if (result.code === 0) {
                res.write('Operation completed successfully\n');
                res.end(JSON.stringify({
                    success: true,
                    message: 'Topology destroyed successfully'
                }));
            } else {
                res.write(`Operation failed: ${result.stderr}\n`);
                res.end(JSON.stringify({
                    success: false,
                    message: 'Destroy operation failed',
                    error: result.stderr
                }));
            }

        } catch (error) {
            res.write(`Operation failed: ${error.message}\n`);
            res.end(JSON.stringify({
                error: `Destroy operation failed: ${error.message}`
            }));
        } finally {
            ssh.dispose();
        }

    } catch (error) {
        res.write(`Server error: ${error.message}\n`);
        res.end(JSON.stringify({
            error: `Server error: ${error.message}`
        }));
    }
});

// Modify the reconfigure endpoint
app.post('/api/containerlab/reconfigure', async (req, res) => {
    try {
        const { serverIp, topoFile } = req.body;
        
        if (!serverIp || !topoFile) {
            return res.status(400).json({ 
                error: 'Server IP and topology file path are required' 
            });
        }

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const ssh = new NodeSSH();
        
        // Connect to the remote server
        try {
            res.write('Connecting to server...\n');
            await ssh.connect({
                ...sshConfig,
                host: serverIp,
            });
            res.write('Connected successfully\n');
        } catch (error) {
            res.write(`Failed to connect to server: ${error.message}\n`);
            res.end();
            return;
        }

        try {
            // Execute containerlab reconfigure command
            res.write('Executing containerlab reconfigure command...\n');
            // Ensure we have an absolute path
            const absoluteTopoPath = resolvePath(topoFile);
            const reconfigureCommand = `clab deploy --topo ${absoluteTopoPath} --reconfigure`;
            const result = await ssh.execCommand(reconfigureCommand, {
                cwd: '/', // Use root directory to ensure absolute paths work correctly
                onStdout: (chunk) => {
                    res.write(`stdout: ${chunk.toString()}\n`);
                },
                onStderr: (chunk) => {
                    res.write(`stderr: ${chunk.toString()}\n`);
                }
            });

            if (result.code === 0) {
                res.write('Operation completed successfully\n');
                res.end(JSON.stringify({
                    success: true,
                    message: 'Topology reconfigured successfully'
                }));
            } else {
                res.write(`Operation failed: ${result.stderr}\n`);
                res.end(JSON.stringify({
                    success: false,
                    message: 'Reconfigure operation failed',
                    error: result.stderr
                }));
            }

        } catch (error) {
            res.write(`Operation failed: ${error.message}\n`);
            res.end(JSON.stringify({
                error: `Reconfigure operation failed: ${error.message}`
            }));
        } finally {
            ssh.dispose();
        }

    } catch (error) {
        res.write(`Server error: ${error.message}\n`);
        res.end(JSON.stringify({
            error: `Server error: ${error.message}`
        }));
    }
});

// Add get free ports endpoint
// Free ports endpoint
app.get('/api/ports/free', async (req, res) => {
    try {
        const { serverIp } = req.query;
        
        // Validate IP format
        if (!serverIp || !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(serverIp)) {
            return res.status(400).json({ 
                success: false,
                error: 'Valid IPv4 address required' 
            });
        }

        const ssh = new NodeSSH();
        
        try {
            await ssh.connect({
                ...sshConfig,
                host: serverIp,
            });

            // Optimized port finding script
            const findPortsScript = `
                #!/bin/bash
                used_ports=$(ss -tuln | awk '{print $5}' | awk -F: '{print $NF}' | sort -nu)
                comm -23 <(seq 1024 65535 | sort) <(echo "$used_ports") | tr '\n' ' '
            `;

            const result = await ssh.execCommand(findPortsScript, {
                execOptions: { timeout: 10000 }
            });
            
            if (result.code === 0) {
                const freePorts = result.stdout
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .map(Number);
                    
                res.json({
                    success: true,
                    freePorts: freePorts,
                    count: freePorts.length
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: `Port scan failed: ${result.stderr || 'Unknown error'}`
                });
            }

        } catch (error) {
            res.status(500).json({
                success: false,
                error: `SSH connection failed: ${error.message}`
            });
        } finally {
            ssh.dispose();
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`
        });
    }
});

// Create uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  let sshClient = null;
  let sshStream = null;

  ws.on('message', async (message) => {
    // If we already have an SSH stream, send the data directly
    if (sshStream) {
      sshStream.write(message.toString());
      return;
    }

    // Otherwise, try to parse as JSON for initial connection
    try {
      const data = JSON.parse(message);
      console.log('Received connection request:', data);
      const { nodeName, nodeIp, username } = data;

      // Create SSH client
      sshClient = new Client();

      // Connect to SSH
      console.log(`Attempting SSH connection to ${nodeIp}`);
      sshClient.connect({
        host: nodeIp,
        username: 'admin',
        // For keyboard-interactive authentication:
        tryKeyboard: true,
        readyTimeout: 10000,
        debug: console.log
      });
      
      sshClient.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
        console.log('Keyboard interactive authentication requested');
        const responses = prompts.map(() => 'admin');
        finish(responses);
      });
      
      sshClient.on('authenticationRequired', (authMethods) => {
        console.log('Authentication required, methods:', authMethods);
        if (!authMethods || authMethods.length === 0) {
          // Try password auth as fallback
          sshClient.authPassword('admin', 'admin');
        }
      });

      // Handle SSH errors
      sshClient.on('error', (err) => {
        console.error('SSH connection error:', err);
        ws.send(`\r\n\x1b[31mError: ${err.message}\x1b[0m`);
      });

      // Add connection timeout handler
      const connectionTimeout = setTimeout(() => {
        if (sshClient && !sshClient._sock) {
          console.error('SSH connection timeout');
          ws.send('\r\n\x1b[31mError: Connection timeout\x1b[0m');
          sshClient.end();
        }
      }, 10000);

      sshClient.on('ready', () => {
        clearTimeout(connectionTimeout);
        console.log('SSH connection ready');
        // Create interactive shell
        sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            console.error('Error creating shell:', err);
            ws.send('\r\n\x1b[31mError: Failed to create shell\x1b[0m');
            return;
          }

          console.log('Shell created successfully');
          sshStream = stream;

          // Handle data from SSH stream
          stream.on('data', (data) => {
            const output = data.toString();
            ws.send(output);
          });

          // Handle stream close
          stream.on('close', () => {
            console.log('SSH stream closed');
            sshClient.end();
            sshStream = null;
          });
        });
      });

    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      ws.send(`\r\n\x1b[31mError: ${error.message}\x1b[0m`);
    }
  });

  // Handle WebSocket close
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (sshClient) {
      sshClient.end();
    }
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    if (sshClient) {
      sshClient.end();
    }
  });
});

// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`WebSocket server is ready at ws://0.0.0.0:${port}/ws/ssh`);
});
