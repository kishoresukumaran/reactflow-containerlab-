import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls
} from 'react-flow-renderer';
import Sidebar from '../Sidebar';
import yaml from 'js-yaml';
import '../styles.css';

const ACT = () => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nodeName, setNodeName] = useState("");
  const [newNode, setNewNode] = useState(null);
  const [yamlOutput, setYamlOutput] = useState("");
  const [nodeModalWarning, setNodeModalWarning] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [nodeIp, setNodeIp] = useState("");
  const [nodeType, setNodeType] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [isModifying, setIsModifying] = useState(false);
  const [showVeos, setShowVeos] = useState(false);
  const [showCvp, setShowCvp] = useState(false);
  const [showGeneric, setShowGeneric] = useState(false);
  const [isYamlValid, setIsYamlValid] = useState(true);
  const [yamlParseError, setYamlParseError] = useState("");
  const [isUpdatingFromYaml, setIsUpdatingFromYaml] = useState(false);

  const [veosInputs, setVeosInputs] = useState({
    username: '',
    password: '',
    version: ''
  });

  const [cvpInputs, setCvpInputs] = useState({
    username: '',
    password: '',
    version: '',
    instance: '',
    ipAddress: '',
    autoConfig: false
  });

  const [genericInputs, setGenericInputs] = useState({
    username: '',
    password: '',
    version: ''
  });

  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState(false);
  const [sourceInterface, setSourceInterface] = useState("");
  const [targetInterface, setTargetInterface] = useState("");
  const [newEdgeData, setNewEdgeData] = useState(null);
  const [edgeModalWarning, setEdgeModalWarning] = useState(false);

  // Update onConnect handler
  const onConnect = useCallback((params) => {
    const sourceNode = nodes.find(node => node.id === params.source);
    const targetNode = nodes.find(node => node.id === params.target);
    
    setNewEdgeData({
      ...params,
      sourceNodeName: sourceNode.data.label,
      targetNodeName: targetNode.data.label
    });
    setIsEdgeModalOpen(true);
  }, [nodes]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode = {
        id: `node_${nodes.length + 1}`,
        position,
        data: { label: `${type} node` }
      };

      setNewNode(newNode);
      setIsModalOpen(true);
    },
    [nodes]
  );

  const onNodeContextMenu = (event, node) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      element: node,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleRemoveNode = () => {
    const nodeToRemove = contextMenu.element;
    setNodes((nds) => nds.filter((n) => n.id !== nodeToRemove.id));
    setContextMenu(null);
  };

  const handleModifyNode = () => {
    const nodeToModify = contextMenu.element;
    setNodeName(nodeToModify.data.label);
    setNodeIp(nodeToModify.data.ip || "");
    setNodeType(nodeToModify.data.type || "");
    setDeviceModel(nodeToModify.data.model || "");
    setNewNode(nodeToModify);
    setIsModifying(true);
    setIsModalOpen(true);
    setContextMenu(null);
  };

  const handleModalSubmit = () => {
    if (!nodeName.trim()) {
      setNodeModalWarning(true);
      return;
    }

    const newNodeWithData = {
      ...newNode,
      data: {
        ...newNode.data,
        label: nodeName,
        ip: nodeIp,
        type: nodeType,
        model: deviceModel
      }
    };

    if (isModifying) {
      setNodes((nds) => 
        nds.map((node) => 
          node.id === newNode.id ? newNodeWithData : node
        )
      );
      setIsModifying(false);
    } else {
      setNodes((nds) => [...nds, newNodeWithData]);
    }

    setIsModalOpen(false);
    setNodeName("");
    setNodeIp("");
    setNodeType("");
    setDeviceModel("");
    setNodeModalWarning(false);
  };

  // Add edge modal submit handler
  const handleEdgeModalSubmit = () => {
    if (!sourceInterface.trim() || !targetInterface.trim()) {
      setEdgeModalWarning(true);
      return;
    }

    const newEdge = {
      ...newEdgeData,
      id: `edge_${newEdgeData.source}_${newEdgeData.target}`,
      data: {
        sourceInterface,
        targetInterface
      }
    };

    setEdges((eds) => addEdge(newEdge, eds));
    setIsEdgeModalOpen(false);
    setSourceInterface("");
    setTargetInterface("");
    setNewEdgeData(null);
    setEdgeModalWarning(false);
  };

  // Update YAML output based on diagram changes
  const updateYamlFromDiagram = () => {
    // Skip if we're currently updating the diagram from YAML
    if (isUpdatingFromYaml) return;
    
    let yamlSections = [];
    let nodesData = { nodes: [] };

    // Global settings sections
    if (showVeos) {
      const veosSection = yaml.dump({
        veos: {
          username: veosInputs.username,
          password: veosInputs.password,
          version: veosInputs.version
        }
      });
      yamlSections.push(veosSection);
    }

    if (showCvp) {
      // Add CVP global settings without IP and auto-config
      const cvpSection = yaml.dump({
        cvp: {
          username: cvpInputs.username,
          password: cvpInputs.password,
          version: cvpInputs.version,
          instance: cvpInputs.instance
        }
      });
      yamlSections.push(cvpSection);

      // Add CVP node
      nodesData.nodes.push({
        CVP: {
          ip_addr: cvpInputs.ipAddress,
          node_type: 'cvp',
          auto_configuration: cvpInputs.autoConfig
        }
      });
    }

    if (showGeneric) {
      const genericSection = yaml.dump({
        generic: {
          username: genericInputs.username,
          password: genericInputs.password,
          version: genericInputs.version
        }
      });
      yamlSections.push(genericSection);
    }

    // Add regular nodes
    nodes.forEach(node => {
      if (node.data && node.data.label) {
        nodesData.nodes.push({
          [node.data.label]: {
            ip_addr: node.data.ip || "",
            node_type: node.data.type || "",
            device_model: node.data.model || ""
          }
        });
      }
    });

    // Add nodes section if there are any nodes
    if (nodesData.nodes.length > 0) {
      yamlSections.push(yaml.dump(nodesData));
    }

    // Add links section
    if (edges.length > 0) {
      const linksData = {
        links: edges.map(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          if (sourceNode && targetNode && edge.data) {
            return {
              connection: [
                `${sourceNode.data.label}:${edge.data.sourceInterface}`,
                `${targetNode.data.label}:${edge.data.targetInterface}`
              ]
            };
          }
          return null;
        }).filter(link => link !== null)
      };
      
      if (linksData.links.length > 0) {
        yamlSections.push(yaml.dump(linksData));
      }
    }

    setYamlOutput(yamlSections.join('\n'));
    setIsYamlValid(true);
    setYamlParseError("");
  };

  // Handle manual YAML edits by the user
  const handleYamlChange = (e) => {
    const newYaml = e.target.value;
    setYamlOutput(newYaml);
    
    // Validate and parse new YAML
    // try {
    updateDiagramFromYaml(newYaml);
    // setIsYamlValid(true);
    // setYamlParseError("");
    // } catch (error) {
    //   setIsYamlValid(false);
    //   setYamlParseError(`Error parsing YAML: ${error.message}`);
    // }
  };

  // Update diagram based on YAML input
  const updateDiagramFromYaml = (yamlText) => {
    if (!yamlText.trim()) {
      // If YAML is empty, just reset the topology
      handleReset();
      return;
    }

    setIsUpdatingFromYaml(true);

    try {
      // Split the YAML into sections by document separator (---)
      const yamlSections = yamlText.split(/---+/).filter(section => section.trim());
      
      // Initialize data holders
      let newNodes = [];
      let newEdges = [];
      let parsedVeos = null;
      let parsedCvp = null;
      let parsedGeneric = null;
      let cvpNode = null;
      let nodeCounter = 1;
      let positionCounter = 0;
      
      // Parse each section
      for (let section of yamlSections) {
        let parsedSection;
        try {
          parsedSection = yaml.load(section);
        } catch (error) {
          console.error("Failed to parse YAML section:", error);
          throw new Error(`Invalid YAML syntax in section: ${section.substring(0, 50)}...`);
        }
        
        // Skip empty sections
        if (!parsedSection) continue;
        
        // Handle global settings
        if (parsedSection.veos) {
          parsedVeos = parsedSection.veos;
        } else if (parsedSection.cvp) {
          parsedCvp = parsedSection.cvp;
        } else if (parsedSection.generic) {
          parsedGeneric = parsedSection.generic;
        }
        
        // Handle nodes
        if (parsedSection.nodes) {
          parsedSection.nodes.forEach(nodeObj => {
            const nodeName = Object.keys(nodeObj)[0];
            const nodeData = nodeObj[nodeName];
            
            // Generate node positions in a grid layout
            const columns = 3;
            const rowHeight = 150;
            const colWidth = 200;
            const row = Math.floor(positionCounter / columns);
            const col = positionCounter % columns;
            positionCounter++;
            
            // Check if this is a CVP node
            if (nodeName === "CVP" && nodeData.node_type === "cvp") {
              cvpNode = nodeData;
            } else {
              // Regular node
              newNodes.push({
                id: `node_${nodeCounter++}`,
                position: { x: 100 + col * colWidth, y: 100 + row * rowHeight },
                data: {
                  label: nodeName,
                  ip: nodeData.ip_addr || "",
                  type: nodeData.node_type || "",
                  model: nodeData.device_model || ""
                }
              });
            }
          });
        }
        
        // Handle links
        if (parsedSection.links) {
          parsedSection.links.forEach((linkObj, index) => {
            if (linkObj.connection && linkObj.connection.length === 2) {
              // Parse node and interface names
              const sourceConn = linkObj.connection[0].split(':');
              const targetConn = linkObj.connection[1].split(':');
              
              if (sourceConn.length !== 2 || targetConn.length !== 2) {
                throw new Error(`Invalid connection format in link ${index}: ${linkObj.connection}`);
              }
              
              const sourceNodeName = sourceConn[0];
              const sourceInterface = sourceConn[1];
              const targetNodeName = targetConn[0];
              const targetInterface = targetConn[1];
              
              // Find node IDs by name
              const sourceNode = newNodes.find(n => n.data.label === sourceNodeName);
              const targetNode = newNodes.find(n => n.data.label === targetNodeName);
              
              if (!sourceNode || !targetNode) {
                console.warn(`Cannot create edge: missing node ${!sourceNode ? sourceNodeName : targetNodeName}`);
                return;
              }
              
              // Create the edge
              newEdges.push({
                id: `edge_${sourceNode.id}_${targetNode.id}`,
                source: sourceNode.id,
                target: targetNode.id,
                data: {
                  sourceInterface,
                  targetInterface
                }
              });
            }
          });
        }
      }
      
      // Update component state with parsed data
      setNodes(newNodes);
      setEdges(newEdges);
      
      // Update global settings
      if (parsedVeos) {
        setShowVeos(true);
        setVeosInputs({
          username: parsedVeos.username || '',
          password: parsedVeos.password || '',
          version: parsedVeos.version || ''
        });
      } else {
        setShowVeos(false);
        setVeosInputs({ username: '', password: '', version: '' });
      }
      
      if (parsedCvp || cvpNode) {
        setShowCvp(true);
        setCvpInputs({
          username: parsedCvp?.username || '',
          password: parsedCvp?.password || '',
          version: parsedCvp?.version || '',
          instance: parsedCvp?.instance || '',
          ipAddress: cvpNode?.ip_addr || '',
          autoConfig: cvpNode?.auto_configuration || false
        });
      } else {
        setShowCvp(false);
        setCvpInputs({ username: '', password: '', version: '', instance: '', ipAddress: '', autoConfig: false });
      }
      
      if (parsedGeneric) {
        setShowGeneric(true);
        setGenericInputs({
          username: parsedGeneric.username || '',
          password: parsedGeneric.password || '',
          version: parsedGeneric.version || ''
        });
      } else {
        setShowGeneric(false);
        setGenericInputs({ username: '', password: '', version: '' });
      }
      
    } catch (error) {
      console.error("Failed to update diagram from YAML:", error);
      throw error;
    } finally {
      setIsUpdatingFromYaml(false);
    }
  };

  // Update YAML when topology changes
  useEffect(() => {
    updateYamlFromDiagram();
  }, [
    showVeos, showCvp, showGeneric,
    veosInputs, cvpInputs, genericInputs,
    nodes, edges
  ]);

  const handleVeosCheckbox = (e) => {
    setShowVeos(e.target.checked);
    if (!e.target.checked) {
      setVeosInputs({ username: '', password: '', version: '' });
    }
  };

  const handleDownloadYaml = () => {
    // Create a blob with the YAML content
    const blob = new Blob([yamlOutput], { type: 'text/yaml' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a link element
    const link = document.createElement('a');
    
    // Set link properties
    link.href = url;
    link.download = 'network_topology.yaml';
    
    // Append to the body (not visible)
    document.body.appendChild(link);
    
    // Trigger the download
    link.click();
    
    // Clean up
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  const handleCvpCheckbox = (e) => {
    setShowCvp(e.target.checked);
    if (!e.target.checked) {
      setCvpInputs({ username: '', password: '', version: '', instance: '', ipAddress: '', autoConfig: false });
    }
  };

  const handleGenericCheckbox = (e) => {
    setShowGeneric(e.target.checked);
    if (!e.target.checked) {
      setGenericInputs({ username: '', password: '', version: '' });
    }
  };

  // Add reset handler
  const handleReset = () => {
    // Reset all states
    setNodes([]);
    setEdges([]);
    setYamlOutput("");
    setShowVeos(false);
    setShowCvp(false);
    setShowGeneric(false);
    setVeosInputs({
      username: '',
      password: '',
      version: ''
    });
    setCvpInputs({
      username: '',
      password: '',
      version: '',
      instance: '',
      ipAddress: '',
      autoConfig: false
    });
    setGenericInputs({
      username: '',
      password: '',
      version: ''
    });
  };

  // Add apply YAML changes button handler
  const handleApplyYaml = () => {
    try {
      updateDiagramFromYaml(yamlOutput);
      setIsYamlValid(true);
      setYamlParseError("");
    } catch (error) {
      setIsYamlValid(false);
      setYamlParseError(`Error applying YAML: ${error.message}`);
    }
  };

  return (
    <div className="dndflow">
      <div className="node-panel">
        <h3 className="settings-heading">Global Settings</h3>
        <div className="checkbox-group-act">
          <label>
            <input
              type="checkbox"
              checked={showVeos}
              onChange={handleVeosCheckbox}
            />
            Add vEOS
          </label>
        </div>
        {showVeos && (
          <div className="input-section-act">
            <div className="input-group-act">
              <label>Username:</label>
              <input
                type="text"
                value={veosInputs.username}
                onChange={(e) => setVeosInputs({...veosInputs, username: e.target.value})}
              />
            </div>
            <div className="input-group-act">
              <label>Password:</label>
              <input
                type="password"
                value={veosInputs.password}
                onChange={(e) => setVeosInputs({...veosInputs, password: e.target.value})}
              />
            </div>
            <div className="input-group-act">
              <label>Version:</label>
              <input
                type="text"
                value={veosInputs.version}
                onChange={(e) => setVeosInputs({...veosInputs, version: e.target.value})}
              />
            </div>
          </div>
        )}

        <div className="checkbox-group-act">
          <label>
            <input
              type="checkbox"
              checked={showCvp}
              onChange={handleCvpCheckbox}
            />
            Add CVP
          </label>
        </div>
        {showCvp && (
          <div className="input-section-act">
            <div className="input-group-act">
              <label>Username:</label>
              <input
                type="text"
                value={cvpInputs.username}
                onChange={(e) => setCvpInputs({...cvpInputs, username: e.target.value})}
              />
            </div>
            <div className="input-group-act">
              <label>Password:</label>
              <input
                type="password"
                value={cvpInputs.password}
                onChange={(e) => setCvpInputs({...cvpInputs, password: e.target.value})}
              />
            </div>
            <div className="input-group-act">
              <label>Version:</label>
              <input
                type="text"
                value={cvpInputs.version}
                onChange={(e) => setCvpInputs({...cvpInputs, version: e.target.value})}
              />
            </div>
            <div className="input-group-act">
              <label>Instance:</label>
              <input
                type="text"
                value={cvpInputs.instance}
                onChange={(e) => setCvpInputs({...cvpInputs, instance: e.target.value})}
              />
            </div>
            <div className="input-group-act">
              <label>IP Address:</label>
              <input
                type="text"
                value={cvpInputs.ipAddress}
                onChange={(e) => setCvpInputs({...cvpInputs, ipAddress: e.target.value})}
                placeholder="e.g., 192.168.0.10"
              />
            </div>
            <div className="toggle-group-act">
              <label>Auto Configuration:</label>
              <div className="toggle-switch-act">
                <input
                  type="checkbox"
                  id="auto-config"
                  checked={cvpInputs.autoConfig}
                  onChange={(e) => setCvpInputs({...cvpInputs, autoConfig: e.target.checked})}
                />
                <label htmlFor="auto-config">
                  <span className="toggle-label-act">{cvpInputs.autoConfig ? 'YES' : 'NO'}</span>
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="checkbox-group-act">
          <label>
            <input
              type="checkbox"
              checked={showGeneric}
              onChange={handleGenericCheckbox}
            />
            Add Generic
          </label>
        </div>
        {showGeneric && (
          <div className="input-section-act">
            <div className="input-group-act">
              <label>Username:</label>
              <input
                type="text"
                value={genericInputs.username}
                onChange={(e) => setGenericInputs({...genericInputs, username: e.target.value})}
              />
            </div>
            <div className="input-group-act">
              <label>Password:</label>
              <input
                type="password"
                value={genericInputs.password}
                onChange={(e) => setGenericInputs({...genericInputs, password: e.target.value})}
              />
            </div>
            <div className="input-group-act">
              <label>Version:</label>
              <input
                type="text"
                value={genericInputs.version}
                onChange={(e) => setGenericInputs({...genericInputs, version: e.target.value})}
              />
            </div>
          </div>
        )}
        <hr className="act-divider" />
        <div className="act-section">
          <Sidebar />
        </div>
        <hr className="act-divider" />
        <div className="node-panel-act">
          <button className="reset-button-act" onClick={handleReset}>
            Reset All Fields
          </button>
        </div>
      </div>
      <div className="reactflow-wrapper" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeContextMenu={onNodeContextMenu}
          fitView
        >
          <Controls />
        </ReactFlow>
      </div>
      <div className="yaml-output">
        <div className="yaml-header-act">
          <h3>YAML Editor</h3>
          <div className="yaml-actions">
            {/* <button className="yaml-button" onClick={handleApplyYaml} disabled={!yamlOutput.trim()}>
              Apply Changes
            </button> */}
            <button className="download-button-act" onClick={handleDownloadYaml} disabled={!yamlOutput.trim()}>
              Download YAML
            </button>
          </div>
        </div>
        {!isYamlValid && (
          <div className="yaml-error-message">
            {yamlParseError}
          </div>
        )}
        <textarea
          className={`yaml-editor ${!isYamlValid ? 'yaml-error' : ''}`}
          value={yamlOutput}
          onChange={handleYamlChange}
          spellCheck="false"
        />
      </div>

      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Enter Node Details</h2>
            {nodeModalWarning && (
              <div className="warning-message">
                Node Name is required
              </div>
            )}
            <div className="input-group">
              <label>Name of the node:</label>
              <input
                type="text"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                className={nodeModalWarning && !nodeName.trim() ? 'input-error' : ''}
              />
            </div>
            <div className="input-group">
              <label>IP Address:</label>
              <input
                type="text"
                value={nodeIp}
                onChange={(e) => setNodeIp(e.target.value)}
                placeholder="e.g., 192.168.1.1"
              />
            </div>
            <div className="input-group">
              <label>Node Type:</label>
              <input
                type="text"
                value={nodeType}
                onChange={(e) => setNodeType(e.target.value)}
                placeholder="e.g., Router"
              />
            </div>
            <div className="input-group">
              <label>Device Model:</label>
              <input
                type="text"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                placeholder="e.g., DCS-7280"
              />
            </div>
            <div className="actions">
              <button onClick={handleModalSubmit}>Submit</button>
              <button onClick={() => {
                setIsModalOpen(false);
                setNodeName("");
                setNodeIp("");
                setNodeType("");
                setDeviceModel("");
                setNodeModalWarning(false);
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isEdgeModalOpen && (
        <div className="modal-act">
          <div className="modal-content-act">
            <h2>Configure Link Interfaces</h2>
            {edgeModalWarning && (
              <div className="warning-message">
                Both interfaces are required
              </div>
            )}
            <div className="form-content">
              <div className="input-group-act">
                <label>{newEdgeData?.sourceNodeName} Interface:</label>
                <input
                  type="text"
                  value={sourceInterface}
                  onChange={(e) => setSourceInterface(e.target.value)}
                  placeholder="e.g., Ethernet1"
                  className={edgeModalWarning && !sourceInterface.trim() ? 'input-error' : ''}
                />
              </div>
              <div className="input-group-act">
                <label>{newEdgeData?.targetNodeName} Interface:</label>
                <input
                  type="text"
                  value={targetInterface}
                  onChange={(e) => setTargetInterface(e.target.value)}
                  placeholder="e.g., Ethernet1"
                  className={edgeModalWarning && !targetInterface.trim() ? 'input-error' : ''}
                />
              </div>
            </div>
            <div className="actions">
              <button onClick={handleEdgeModalSubmit}>Submit</button>
              <button onClick={() => {
                setIsEdgeModalOpen(false);
                setSourceInterface("");
                setTargetInterface("");
                setNewEdgeData(null);
                setEdgeModalWarning(false);
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'absolute',
            top: contextMenu.mouseY,
            left: contextMenu.mouseX,
            backgroundColor: 'white',
            boxShadow: '0px 0px 5px rgba(0,0,0,0.3)',
            zIndex: 1000,
          }}
        >
          <button onClick={handleModifyNode}>Modify</button>
          <button onClick={handleRemoveNode}>Remove Node</button>
          <button onClick={handleContextMenuClose}>Cancel</button>
        </div>
      )}
    </div>
  );
};

export default ACT;