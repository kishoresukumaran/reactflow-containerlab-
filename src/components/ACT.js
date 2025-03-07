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
  const [edgeContextMenu, setEdgeContextMenu] = useState(null);

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

  // Add a handler for edge right-clicks
  const onEdgeContextMenu = (event, edge) => {
    event.preventDefault();
    setEdgeContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      element: edge,
    });
  };
  
  const onNodeContextMenu = (event, node) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      element: node,
    });
  };

  // Add a handler to close the edge context menu
  const handleEdgeContextMenuClose = () => {
    setEdgeContextMenu(null);
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  // Add a handler to remove the edge
  const handleRemoveEdge = () => {
    const edgeToRemove = edgeContextMenu.element;
    setEdges((eds) => eds.filter((e) => e.id !== edgeToRemove.id));
    setEdgeContextMenu(null);
  };

  const handleRemoveNode = () => {
    const nodeToRemove = contextMenu.element;
    setNodes((nds) => nds.filter((n) => n.id !== nodeToRemove.id));
    setContextMenu(null);
  };

  // Add a handler to modify the edge
  const handleModifyEdge = () => {
    const edgeToModify = edgeContextMenu.element;

    // Find the source and target nodes to display their names
    const sourceNode = nodes.find(node => node.id === edgeToModify.source);
    const targetNode = nodes.find(node => node.id === edgeToModify.target);

    // Set up the edge modal with existing data
    setSourceInterface(edgeToModify.data?.sourceInterface || "");
    setTargetInterface(edgeToModify.data?.targetInterface || "");
    setNewEdgeData({
      ...edgeToModify,
      sourceNodeName: sourceNode?.data.label,
      targetNodeName: targetNode?.data.label
    });

    setIsEdgeModalOpen(true);
    setEdgeContextMenu(null);
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
  
    // If we're modifying an existing edge
    if (newEdgeData.id) {
      setEdges((eds) => eds.map((edge) => 
        edge.id === newEdgeData.id 
          ? {
              ...edge,
              data: {
                sourceInterface,
                targetInterface
              }
            }
          : edge
      ));
    } else {
      // This is a new edge
      const newEdge = {
        ...newEdgeData,
        id: `edge_${newEdgeData.source}_${newEdgeData.target}`,
        data: {
          sourceInterface,
          targetInterface
        }
      };
      setEdges((eds) => addEdge(newEdge, eds));
    }
  
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
  const handleYamlChange = (event) => {
    const newYaml = event.target.value;
    setYamlOutput(newYaml);
    setIsUpdatingFromYaml(true);  // Set flag to indicate manual YAML editing
  
    try {
      if (newYaml.trim() === '') {
        // Handle empty YAML case
        setNodes([]);
        setEdges([]);
        setIsYamlValid(true);
        setYamlParseError('');
        return;
      }

      // Parse the YAML input
      const parsedYaml = yaml.load(newYaml);
      
      // Initialize arrays for new nodes and edges
      let newNodes = [];
      let nodeCounter = 1;
      let positionCounter = 0;

      // Handle global settings first
      if (parsedYaml.veos) {
        setShowVeos(true);
        setVeosInputs({
          username: parsedYaml.veos.username || '',
          password: parsedYaml.veos.password || '',
          version: parsedYaml.veos.version || ''
        });
      } else {
        setShowVeos(false);
      }

      if (parsedYaml.cvp) {
        setShowCvp(true);
        setCvpInputs({
          username: parsedYaml.cvp.username || '',
          password: parsedYaml.cvp.password || '',
          version: parsedYaml.cvp.version || '',
          instance: parsedYaml.cvp.instance || '',
          ipAddress: '',
          autoConfig: false
        });
      } else {
        setShowCvp(false);
      }

      if (parsedYaml.generic) {
        setShowGeneric(true);
        setGenericInputs({
          username: parsedYaml.generic.username || '',
          password: parsedYaml.generic.password || '',
          version: parsedYaml.generic.version || ''
        });
      } else {
        setShowGeneric(false);
      }

      // Handle nodes
      if (parsedYaml.nodes) {
        newNodes = parsedYaml.nodes.map((nodeObj) => {
          const nodeName = Object.keys(nodeObj)[0];
          const nodeData = nodeObj[nodeName];
          
          // Generate position in a grid layout
          const columns = 3;
          const rowHeight = 150;
          const colWidth = 200;
          const row = Math.floor(positionCounter / columns);
          const col = positionCounter % columns;
          positionCounter++;

          // Special handling for CVP node
          if (nodeName === "CVP" && nodeData.node_type === "cvp") {
            setCvpInputs(prev => ({
              ...prev,
              ipAddress: nodeData.ip_addr || '',
              autoConfig: nodeData.auto_configuration || false
            }));
          }

          return {
            id: `node_${nodeCounter++}`,
            position: { x: 100 + col * colWidth, y: 100 + row * rowHeight },
            data: {
              label: nodeName,
              ip: nodeData.ip_addr || "",
              type: nodeData.node_type || "",
              model: nodeData.device_model || ""
            }
          };
        });
      }

      // Handle links
      let newEdges = [];
      if (parsedYaml.links) {
        newEdges = parsedYaml.links.map((linkObj, index) => {
          const [sourceNodeName, sourceInterface] = linkObj.connection[0].split(':');
          const [targetNodeName, targetInterface] = linkObj.connection[1].split(':');

          // Find corresponding nodes
          const sourceNode = newNodes.find(n => n.data.label === sourceNodeName);
          const targetNode = newNodes.find(n => n.data.label === targetNodeName);

          if (sourceNode && targetNode) {
            return {
              id: `edge_${sourceNode.id}_${targetNode.id}_${sourceInterface}_${targetInterface}`,
              source: sourceNode.id,
              target: targetNode.id,
              data: {
                sourceInterface,
                targetInterface
              }
            };
          }
          return null;
        }).filter(edge => edge !== null);
      }

      // Update state with new nodes and edges
      setNodes(newNodes);
      setEdges(newEdges);
      setIsYamlValid(true);
      setYamlParseError('');
      
    } catch (error) {
      console.error('Failed to parse YAML:', error);
      setIsYamlValid(false);
      setYamlParseError(`Error parsing YAML: ${error.message}`);
      // Still keep the YAML text updated
      setYamlOutput(newYaml);
    }
  };

  // Update YAML when topology changes
  useEffect(() => {
    if (!isUpdatingFromYaml) {  // Only update if not manually editing
      updateYamlFromDiagram();
    }
  }, [
    showVeos, showCvp, showGeneric,
    veosInputs, cvpInputs, genericInputs,
    nodes, edges,
    isUpdatingFromYaml  // Add this to dependencies
  ]);

  // Reset isUpdatingFromYaml flag when focus is lost
  const handleYamlBlur = () => {
    setIsUpdatingFromYaml(false);
    updateYamlFromDiagram();  // Update diagram when focus is lost
  };

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
      updateYamlFromDiagram();
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
          onEdgeContextMenu={onEdgeContextMenu}
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
          onBlur={handleYamlBlur}
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

      {edgeContextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'absolute',
            top: edgeContextMenu.mouseY,
            left: edgeContextMenu.mouseX,
            backgroundColor: 'white',
            boxShadow: '0px 0px 5px rgba(0,0,0,0.3)',
            zIndex: 1000,
          }}
        >
          <button onClick={handleModifyEdge}>Modify</button>
          <button onClick={handleRemoveEdge}>Remove Edge</button>
          <button onClick={handleEdgeContextMenuClose}>Cancel</button>
        </div>
      )}
    </div>
  );
};

export default ACT;