const express = require('express');
const { exec } = require('child_process');
const multer = require('multer');
const cors = require('cors');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;

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

app.use(cors());
app.use(express.json());

// SSH configuration
const sshConfig = {
    username: 'root',
    password: 'arastra',
    tryKeyboard: true,
    readyTimeout: 5000
};

// Existing inspect endpoint
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
                if (!labsByFile[container.labPath]) {
                    labsByFile[container.labPath] = {
                        labPath: container.labPath,
                        lab_name: container.lab_name,
                        lab_owner: container.owner,
                        nodes: []
                    };
                    topologies.push(labsByFile[container.labPath]);
                }
                labsByFile[container.labPath].nodes.push(container);
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

        const ssh = new NodeSSH();
        
        // Connect to the remote server
        try {
            console.log(`Connecting to server ${serverIp}...`);
            await ssh.connect({
                ...sshConfig,
                host: serverIp,
            });
            console.log('Connected successfully');
        } catch (error) {
            return res.status(500).json({
                error: `Failed to connect to server ${serverIp}: ${error.message}`
            });
        }

        const remoteFilePath = `/opt/${req.file.originalname}`;

        try {
            // Upload the file to the remote server
            console.log(`Uploading file to ${remoteFilePath}`);
            await ssh.putFile(req.file.path, remoteFilePath);
            console.log('File uploaded successfully');

            // Execute containerlab deploy command
            console.log('Executing containerlab deploy command...');
            const deployCommand = `clab deploy --topo ${req.file.originalname}`;
            const result = await ssh.execCommand(deployCommand, {
                cwd: '/opt',
                onStdout: (chunk) => {
                    console.log('stdout:', chunk.toString('utf8'));
                },
                onStderr: (chunk) => {
                    console.error('stderr:', chunk.toString('utf8'));
                }
            });

            // Clean up the temporary file
            fs.unlinkSync(req.file.path);
            
            if (result.code === 0) {
                res.json({
                    success: true,
                    message: 'Topology deployed successfully',
                    deploymentOutput: result.stdout,
                    filePath: remoteFilePath
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Deployment failed',
                    error: result.stderr,
                    command: deployCommand
                });
            }

        } catch (error) {
            // Clean up the temporary file in case of error
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            return res.status(500).json({
                error: `Deployment failed: ${error.message}`
            });
        } finally {
            ssh.dispose(); // Always close the SSH connection
        }

    } catch (error) {
        // Clean up the temporary file in case of error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        return res.status(500).json({
            error: `Server error: ${error.message}`
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Create uploads directory on server start
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads directory');
}

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});