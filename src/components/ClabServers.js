import React, { useState, useEffect } from 'react';
import { Loader2, Server } from 'lucide-react';
import LogModal from './LogModal';

const ClabServers = () => {
  const [topologies, setTopologies] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState({});
  const [expanded, setExpanded] = useState({});
  const [selectedServer, setSelectedServer] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [operationLogs, setOperationLogs] = useState('');
  const [operationTitle, setOperationTitle] = useState('');

  const fetchTopologies = async (serverIp) => {
    setLoading(prev => ({ ...prev, [serverIp]: true }));
    setError(prev => ({ ...prev, [serverIp]: null }));
    setSelectedServer(serverIp);
    setTopologies({}); // Clear previous results
    
    try {
      const response = await fetch(`http://${serverIp}:3001/api/containerlab/inspect`);
      if (!response.ok) {
        throw new Error(`Failed to fetch topology data from ${serverIp}`);
      }
      const data = await response.json();
      console.log('Raw API data:', data); // Debug point 1
      
      const transformedData = data.map(lab => {
        console.log('Processing lab:', lab); // Debug point 2
        return {
          topology: lab.lab_name,
          labPath: lab.labPath,
          labName: lab.lab_name,
          labOwner: lab.lab_owner,
          nodes: lab.nodes.map(node => ({
            name: node.name,
            kind: node.kind,
            image: node.image,
            state: node.state,
            ipAddress: [node.ipv4_address, node.ipv6_address].filter(Boolean)
          }))
        };
      });
      console.log('Transformed data:', transformedData); // Debug point 3

      setTopologies({ [serverIp]: transformedData });
      
      // Initialize all topologies as collapsed
      const initialExpandedState = {};
      transformedData.forEach(topology => {
        initialExpandedState[topology.topology] = false;
      });
      setExpanded({ [serverIp]: initialExpandedState });
    } catch (err) {
      setError(prev => ({ ...prev, [serverIp]: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, [serverIp]: false }));
    }
  };

  const toggleExpand = (serverIp, topologyName) => {
    setExpanded(prev => ({
      ...prev,
      [serverIp]: {
        ...prev[serverIp],
        [topologyName]: !prev[serverIp]?.[topologyName]
      }
    }));
  };

  return (
    <div className="p-6 max-w-full">
      <div className="server-header">
        <h2>Available Servers</h2>
        <table className="server-table">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-4 py-2 text-left">Server Name</th>
              <th className="border border-gray-200 px-4 py-2 text-left">IP Address</th>
              <th className="border border-gray-200 px-4 py-2 text-left">Status</th>
              <th className="border border-gray-200 px-4 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'clab-ire-1', ip: '10.83.12.71', status: 'active' },
              { name: 'clab-ire-2', ip: '10.83.12.72', status: 'active' },
              { name: 'clab-ire-3', ip: '10.83.12.73', status: 'active' }
            ].map((server) => (
              <tr key={server.name} className="hover:bg-gray-50">
                <td className="border border-gray-200 px-4 py-2">
                  <div className="server-info">
                    <Server className="server-icon" />
                    <span className="server-name">{server.name}</span>
                  </div>
                </td>
                <td className="border border-gray-200 px-4 py-2">{server.ip}</td>
                <td className="border border-gray-200 px-4 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    server.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {server.status}
                  </span>
                </td>
                <td className="border border-gray-200 px-4 py-2">
                  <button 
                    onClick={() => fetchTopologies(server.ip)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                    disabled={loading[server.ip]}
                  >
                    {loading[server.ip] ? (
                      <div className="flex items-center">
                        <Loader2 className="animate-spin mr-2" size={18} />
                        Loading...
                      </div>
                    ) : (
                      "Fetch Topologies"
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedServer && topologies[selectedServer] && (
        <div className="mt-8">
          <div className="topology-header-section">
            <h3 className="topology-title">Topologies for {selectedServer}</h3>
            <div className="topology-stats">
              <div className="count-badge">
                Total Topologies: {topologies[selectedServer].length}
              </div>
              <div className="count-badge">
                Total Nodes: {topologies[selectedServer].reduce((sum, topology) => 
                  sum + topology.nodes.length, 0
                )}
              </div>
            </div>
          </div>
          {error[selectedServer] && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              Error: {error[selectedServer]}
            </div>
          )}
          {topologies[selectedServer].length === 0 && !loading[selectedServer] && !error[selectedServer] ? (
            <div className="text-center p-8 text-gray-500">
              No topology data available. Click the button above to fetch data.
            </div>
          ) : (
            topologies[selectedServer].map((topology, index) => (
              <div key={index} className="mb-8">
                <div 
                  className="topology-header"
                  onClick={() => toggleExpand(selectedServer, topology.topology)}
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center">
                      <span className="text-gray-500"><strong>Lab Name: </strong></span>
                      <span className="ml-1 font-medium">{topology.topology}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-500"><strong>Owner: </strong></span>
                      <span className="ml-1 font-medium">{topology.labOwner}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-500"><strong>Topology File: </strong></span>
                      <span className="ml-1 font-medium truncate">{topology.labPath}</span>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="topology-actions mr-4">
                      <button 
                        className="action-button reconfigure-button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to reconfigure this topology?')) {
                            try {
                              setOperationTitle('Reconfiguring Topology');
                              setOperationLogs('');
                              setShowLogModal(true);

                              const response = await fetch(`http://${selectedServer}:3001/api/containerlab/reconfigure`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  serverIp: selectedServer,
                                  topoFile: topology.labPath
                                }),
                              });

                              const reader = response.body.getReader();
                              const decoder = new TextDecoder();
                              let finalJsonStr = '';
                              let buffer = '';

                              while (true) {
                                const { value, done } = await reader.read();
                                if (done) break;
                                
                                const text = decoder.decode(value);
                                buffer += text;

                                // Split by newlines to process each line
                                const lines = buffer.split('\n');
                                // Keep the last potentially incomplete line in the buffer
                                buffer = lines.pop() || '';

                                for (const line of lines) {
                                  try {
                                    // Try to parse as JSON to see if it's the final message
                                    const parsed = JSON.parse(line);
                                    finalJsonStr = line;
                                  } catch {
                                    // If not JSON, it's a log line
                                    setOperationLogs(prevLogs => prevLogs + line + '\n');
                                  }
                                }
                              }

                              // Process any remaining buffer
                              if (buffer) {
                                try {
                                  JSON.parse(buffer);
                                  finalJsonStr = buffer;
                                } catch {
                                  setOperationLogs(prevLogs => prevLogs + buffer + '\n');
                                }
                              }

                              // Parse the final JSON message
                              const result = JSON.parse(finalJsonStr);
                              
                              if (result.success) {
                                setTimeout(() => {
                                  setShowLogModal(false);
                                  alert('Topology reconfigured successfully');
                                  fetchTopologies(selectedServer);
                                }, 2000);
                              } else {
                                alert(`Failed to reconfigure topology: ${result.error}`);
                              }
                            } catch (error) {
                              console.error('Error reconfiguring topology:', error);
                              alert(`Error reconfiguring topology: ${error.message}`);
                              setShowLogModal(false);
                            }
                          }
                        }}
                      >
                        Reconfigure
                      </button>
                      <button 
                        className="action-button destroy-button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to destroy this topology?')) {
                            try {
                              setOperationTitle('Destroying Topology');
                              setOperationLogs('');
                              setShowLogModal(true);

                              const response = await fetch(`http://${selectedServer}:3001/api/containerlab/destroy`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  serverIp: selectedServer,
                                  topoFile: topology.labPath
                                }),
                              });

                              const reader = response.body.getReader();
                              const decoder = new TextDecoder();
                              let finalJsonStr = '';
                              let buffer = '';

                              while (true) {
                                const { value, done } = await reader.read();
                                if (done) break;
                                
                                const text = decoder.decode(value);
                                buffer += text;

                                // Split by newlines to process each line
                                const lines = buffer.split('\n');
                                // Keep the last potentially incomplete line in the buffer
                                buffer = lines.pop() || '';

                                for (const line of lines) {
                                  try {
                                    // Try to parse as JSON to see if it's the final message
                                    const parsed = JSON.parse(line);
                                    finalJsonStr = line;
                                  } catch {
                                    // If not JSON, it's a log line
                                    setOperationLogs(prevLogs => prevLogs + line + '\n');
                                  }
                                }
                              }

                              // Process any remaining buffer
                              if (buffer) {
                                try {
                                  JSON.parse(buffer);
                                  finalJsonStr = buffer;
                                } catch {
                                  setOperationLogs(prevLogs => prevLogs + buffer + '\n');
                                }
                              }

                              // Parse the final JSON message
                              const result = JSON.parse(finalJsonStr);
                              
                              if (result.success) {
                                setTimeout(() => {
                                  setShowLogModal(false);
                                  alert('Topology destroyed successfully');
                                  fetchTopologies(selectedServer);
                                }, 2000);
                              } else {
                                alert(`Failed to destroy topology: ${result.error}`);
                              }
                            } catch (error) {
                              console.error('Error destroying topology:', error);
                              alert(`Error destroying topology: ${error.message}`);
                              setShowLogModal(false);
                            }
                          }
                        }}
                      >
                        Destroy
                      </button>
                    </div>
                    {/* <div className={`expand-button ${expanded[selectedServer]?.[topology.topology] ? 'expanded' : ''}`}>
                    ▼
                    </div> */}
                  </div>
                </div>
                
                {expanded[selectedServer]?.[topology.topology] && (
                  <div className="overflow-x-auto">
                    <table className="topology-table">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Kind
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Image
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            State
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            IP Address
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {topology.nodes.map((node, nodeIndex) => (
                          <tr key={nodeIndex} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {node.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {node.kind}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {node.image}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                node.state === 'running' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {node.state}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {node.ipAddress.map((ip, ipIdx) => (
                                <div key={ipIdx}>{ip}</div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
      <LogModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        logs={operationLogs}
        title={operationTitle}
      />
    </div>
  );
};

export default ClabServers;