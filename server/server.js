const express = require('express');
const { exec } = require('child_process');
const multer = require('multer');
const cors = require('cors');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;
const upload = multer({ dest: 'uploads/' }); // Temporary storage for uploaded files

app.use(cors());
app.use(express.json());

// SSH configuration
const sshConfig = {
  username: 'root', // Update this with your SSH username
  password: 'docker', // Update this with your SSH password
  // Or use key-based authentication:
  // privateKey: '/path/to/your/private/key',
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

// New deployment endpoint
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
      await ssh.connect({
        ...sshConfig,
        host: serverIp,
      });
    } catch (error) {
      return res.status(500).json({
        error: `Failed to connect to server ${serverIp}: ${error.message}`
      });
    }

    // Read the uploaded file
    const fileContent = fs.readFileSync(req.file.path);
    const remoteFilePath = `/opt/${req.file.originalname}`;

    // Upload the file to the remote server
    try {
      await ssh.putFile(req.file.path, remoteFilePath);
      
      // Clean up the temporary file
      fs.unlinkSync(req.file.path);
      
      // Close the SSH connection
      ssh.dispose();

      return res.json({
        success: true,
        message: `File successfully deployed to ${remoteFilePath}`,
        filePath: remoteFilePath
      });

    } catch (error) {
      // Clean up the temporary file in case of error
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      ssh.dispose();
      return res.status(500).json({
        error: `Failed to upload file to server: ${error.message}`
      });
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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
}); 