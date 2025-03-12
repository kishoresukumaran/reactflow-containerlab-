import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react';

const FileManagerModal = ({ isOpen, onClose, onImport }) => {
  const [servers, setServers] = useState([
    { ip: '10.83.12.71', name: 'clab-ire-1' },
    { ip: '10.83.12.72', name: 'clab-ire-2' },
    { ip: '10.83.12.73', name: 'clab-ire-3' }
  ]);
  const [expandedServers, setExpandedServers] = useState({});
  const [fileContents, setFileContents] = useState({});
  const [currentPaths, setCurrentPaths] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const [sshCredentials, setSSHCredentials] = useState({
    username: 'root', // Replace with your default SSH username
    password: 'arastra', // For security, you might want to prompt for this
    useKey: false,
    keyPath: ''
  });

  useEffect(() => {
    // Initialize current paths for each server
    const initialPaths = {};
    servers.forEach(server => {
      initialPaths[server.ip] = '/opt/containerlab_topologies';
    });
    setCurrentPaths(initialPaths);
  }, [servers]);

  const toggleServer = async (serverIp) => {
    // First toggle the expanded state
    const newExpandedState = !expandedServers[serverIp];
    
    setExpandedServers(prev => ({
      ...prev,
      [serverIp]: newExpandedState
    }));
  
    // Only fetch contents if we're expanding
    if (newExpandedState) {
      await fetchContents(serverIp, currentPaths[serverIp]);
    }
  };

  const fetchContents = async (serverIp, path) => {
    try {
      setLoading(true);
      console.log(`Fetching from: http://${serverIp}:3001/api/files/list?path=${encodeURIComponent(path)}&serverIp=${encodeURIComponent(serverIp)}`);
      
      const response = await fetch(`http://${serverIp}:3001/api/files/list?path=${encodeURIComponent(path)}&serverIp=${encodeURIComponent(serverIp)}`);
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      // If response is not ok, let's see what the error message is
      if (!response.ok) {
        const text = await response.text();
        console.error('Error response:', text);
        throw new Error(`Server responded with ${response.status}: ${text.substring(0, 100)}...`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setFileContents(prev => ({
          ...prev,
          [`${serverIp}:${path}`]: data.contents
        }));
      } else {
        console.error('Failed to fetch contents:', data.error);
      }
    } catch (error) {
      console.error('Error fetching contents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectoryClick = async (serverIp, path) => {
    const newPath = path;
    setCurrentPaths(prev => ({
      ...prev,
      [serverIp]: newPath
    }));
    await fetchContents(serverIp, newPath);
  };

  const handleFileClick = (serverIp, path) => {
    setSelectedFile({ serverIp, path });
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      const response = await fetch(`http://${selectedFile.serverIp}:3001/api/files/read?path=${encodeURIComponent(selectedFile.path)}&serverIp=${encodeURIComponent(selectedFile.serverIp)}`);
      const data = await response.json();
      
      if (data.success) {
        onImport(data.content);
        onClose();
      } else {
        console.error('Failed to read file:', data.error);
      }
    } catch (error) {
      console.error('Error reading file:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content" style={{ width: '80%', maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
        <h2>Import Topology File</h2>
        <div className="file-manager">
          {servers.map(server => (
            <div key={server.ip} className="server-section">
              <div 
                className="server-header" 
                onClick={() => toggleServer(server.ip)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {expandedServers[server.ip] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <span>{server.name} ({server.ip})</span>
              </div>
              
              {expandedServers[server.ip] && (
                <div className="server-contents" style={{ marginLeft: '20px' }}>
                  {loading ? (
                    <div>Loading...</div>
                  ) : (
                    fileContents[`${server.ip}:${currentPaths[server.ip]}`]?.map((item, index) => (
                      <div 
                        key={index}
                        className={`file-item ${selectedFile?.path === item.path ? 'selected' : ''}`}
                        onClick={() => item.type === 'directory' 
                          ? handleDirectoryClick(server.ip, item.path)
                          : handleFileClick(server.ip, item.path)
                        }
                        style={{ 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px',
                          backgroundColor: selectedFile?.path === item.path ? '#e2e8f0' : 'transparent'
                        }}
                      >
                        {item.type === 'directory' ? <Folder size={16} /> : <File size={16} />}
                        <span>{item.name}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancel</button>
          <button 
            onClick={handleImport}
            disabled={!selectedFile || loading}
            className="import-button"
          >
            {loading ? 'Loading...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileManagerModal; 