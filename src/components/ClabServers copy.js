import React, { useState, useEffect } from 'react';
import { Loader2, Server } from 'lucide-react';

const ClabServers = () => {
  const [topologies, setTopologies] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState({});
  const [expanded, setExpanded] = useState({});
  const [selectedServer, setSelectedServer] = useState(null);

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
      console.log('Raw API data:', data);
      
      const transformedData = data.map(lab => ({
        topology: lab.lab_name,
        labName: lab.lab_name,
        labOwner:lab.lab_owner,
        nodes: lab.nodes.map(node => ({
          name: node.name,
          kind: node.kind,
          image: node.image,
          state: node.state,
          ipAddress: [node.ipv4_address, node.ipv6_address].filter(Boolean)
        }))
      }));

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
                  <div className="flex items-center gap-4">
                    <span className="topology-name">{topology.topology}</span>
                    <span className="topology-label">Lab: {topology.labName}</span>
                    <span className="topology-owner">Owner: {topology.lab_owner}</span>
                  </div>
                  <div className="flex items-center">
                    <div className="topology-actions mr-4">
                      <button 
                        className="action-button reconfigure-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add reconfigure handler
                        }}
                      >
                        Reconfigure
                      </button>
                      <button 
                        className="action-button destroy-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add destroy handler
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
    </div>
  );
};

export default ClabServers;