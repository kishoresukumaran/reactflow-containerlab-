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

  // Add new state variables
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
    updateYamlAct();
  };

  // Update updateYamlAct to include links
  const updateYamlAct = () => {
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
      nodesData.nodes.push({
        [node.data.label]: {
          ip_addr: node.data.ip,
          node_type: node.data.type,
          device_model: node.data.model
        }
      });
    });

    // Add nodes section if there are any nodes
    if (nodesData.nodes.length > 0) {
      yamlSections.push(yaml.dump(nodesData));
    }

    // Add links section
    if (edges.length > 0) {
      const linksData = {
        links: edges.map(edge => ({
          connection: [
            `${nodes.find(n => n.id === edge.source).data.label}:${edge.data.sourceInterface}`,
            `${nodes.find(n => n.id === edge.target).data.label}:${edge.data.targetInterface}`
          ]
        }))
      };
      yamlSections.push(yaml.dump(linksData));
    }

    setYamlOutput(yamlSections.join('\n'));
  };

  // Update useEffect to watch for node changes
  useEffect(() => {
    updateYamlAct();
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
        <h3>YAML</h3>
        <pre>{yamlOutput}</pre>
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
                <label>{newEdgeData.sourceNodeName} Interface:</label>
                <input
                  type="text"
                  value={sourceInterface}
                  onChange={(e) => setSourceInterface(e.target.value)}
                  placeholder="e.g., Ethernet1"
                  className={edgeModalWarning && !sourceInterface.trim() ? 'input-error' : ''}
                />
              </div>
              <div className="input-group-act">
                <label>{newEdgeData.targetNodeName} Interface:</label>
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