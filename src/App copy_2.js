import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  Controls
} from "react-flow-renderer";
import Sidebar from "./Sidebar";
import yaml from "js-yaml";
import { saveAs } from "file-saver";
import "./styles.css";
import ELK from 'elkjs/lib/elk.bundled.js'; // Update elk import

const elk = new ELK();

const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.spacing.nodeNode': 80,
  'elk.direction': 'RIGHT',
  'elk.spacing.portPort': 30,
};

// Add layout function
const getLayoutedElements = async (nodes, edges) => {
  const graph = {
    id: 'root',
    layoutOptions,
    children: nodes.map((node) => ({
      id: node.id,
      width: 150,
      height: 100,
      ports: node.data.ports || []
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target]
    }))
  };

  const layoutedGraph = await elk.layout(graph);
  return layoutedGraph;
};

let id = 0;
const getId = () => `node_${id++}`;

// Add default YAML constant
const DEFAULT_YAML = {
  name: '',
  topology: {
    nodes: [],
    links: []
  }
};

const App = () => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yamlOutput, setYamlOutput] = useState("");
  const [topologyName, setTopologyName] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNode, setNewNode] = useState(null);
  const [nodeName, setNodeName] = useState("");
  const [nodeBinds, setNodeBinds] = useState([""]);
  const [nodeMgmtIp, setNodeMgmtIp] = useState("");
  const [mgmtNetwork, setMgmtNetwork] = useState("");
  const [ipv4Subnet, setIpv4Subnet] = useState("");
  const [ipv6Subnet, setIpv6Subnet] = useState("");
  const [kinds, setKinds] = useState([{
    name: '',
    config: {
      showStartupConfig: false,
      startupConfig: '',
      showImage: false,
      image: '',
      showExec: false,
      exec: [''],
      showBinds: false,
      binds: ['']
    }
  }]);
  const [defaultKind, setDefaultKind] = useState("");
  const [showMgmt, setShowMgmt] = useState(false);
  const [showKind, setShowKind] = useState(false);
  const [kindName, setKindName] = useState("");
  const [showIpv6, setShowIpv6] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showKindConfig, setShowKindConfig] = useState(false);
  const [showDefault, setShowDefault] = useState(false);
  const [showKindModal, setShowKindModal] = useState(false);
  const [currentKindIndex, setCurrentKindIndex] = useState(0);
  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState(false);
  const [newEdgeData, setNewEdgeData] = useState(null);
  const [sourceInterface, setSourceInterface] = useState("");
  const [targetInterface, setTargetInterface] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [nodeKind, setNodeKind] = useState("");
  const [nodeImage, setNodeImage] = useState("");
  const [nodeModalWarning, setNodeModalWarning] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [isModifyingEdge, setIsModifyingEdge] = useState(false);
  const [edgeModalWarning, setEdgeModalWarning] = useState(false);
  const [mode, setMode] = useState('containerlab'); // Add mode state
  const [reactFlowInstance, setReactFlowInstance] = useState(null); // Add ReactFlow instance state

  const handleModeChange = (newMode) => {
    setMode(newMode);
    // Reset states when switching modes
    setNodes([]);
    setEdges([]);
    setYamlOutput('');
  };

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
        setNodeName("");
        setNodeBinds([""]);
        setNodeMgmtIp("");
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  // Add useEffect for management section updates
  useEffect(() => {
    if (showMgmt) {
      updateYaml(nodes, edges);
    }
  }, [mgmtNetwork, ipv4Subnet, ipv6Subnet]);

  // Add useEffect for default kind updates
  useEffect(() => {
    if (showDefault && defaultKind) {
      updateYaml(nodes, edges);
    }
  }, [defaultKind]);

  // Add useEffect for kinds state changes
  useEffect(() => {
    if (showKind) {
      updateYaml(nodes, edges);
    }
  }, [showKind, kinds]);

  // Add useEffects to watch checkbox states
  useEffect(() => {
    updateYaml(nodes, edges);
  }, [showMgmt, showKind, showDefault]);

  // Update onConnect handler to handle multiple edges
  const onConnect = useCallback((params) => {
    const sourceNode = nodes.find(node => node.id === params.source);
    const targetNode = nodes.find(node => node.id === params.target);
    
    const edgeParams = {
      ...params,
      // Remove type: 'straight' to use default curved edges
      sourceNodeName: sourceNode.data.label,
      targetNodeName: targetNode.data.label
    };
    
    setNewEdgeData(edgeParams);
    setIsEdgeModalOpen(true);
  }, [nodes, edges]);

  // Add validation function
  const validateTopologyName = () => {
    if (!topologyName.trim()) {
      setShowWarning(true);
      return false;
    }
    return true;
  };

  // Update onDrop callback
  const onDrop = useCallback(
    (event) => {
      if (!validateTopologyName()) {
        event.preventDefault();
        return;
      }
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData("application/reactflow");

      if (!type) return;

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode = {
        id: getId(),
        position,
        data: { label: `${type} node` }
      };

      setNewNode(newNode);
      setIsModalOpen(true);
    },
    [nodes, edges, topologyName]
  );

  // Allow dragging over the canvas
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle element removal
  const onElementsRemove = useCallback(
    (elementsToRemove) => {
      const nodeChanges = elementsToRemove.filter((el) => el.id.startsWith('node_')).map((node) => ({ id: node.id, type: 'remove' }));
      const edgeChanges = elementsToRemove.filter((el) => el.id.startsWith('edge_')).map((edge) => ({ id: edge.id, type: 'remove' }));
      const updatedNodes = applyNodeChanges(nodeChanges, nodes);
      const updatedEdges = applyEdgeChanges(edgeChanges, edges);
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      updateYaml(updatedNodes, updatedEdges);
    },
    [nodes, edges]
  );

  // Update updateYaml function to include defaults section
  const updateYaml = (updatedNodes, updatedEdges) => {
    const yamlData = {
      name: topologyName,
      topology: {
        nodes: updatedNodes.reduce((acc, node) => {
          const nodeConfig = {};
          if (node.data.kind?.trim()) nodeConfig.kind = node.data.kind;
          if (node.data.image?.trim()) nodeConfig.image = node.data.image;
          if (node.data.binds?.some(bind => bind.trim())) {
            nodeConfig.binds = node.data.binds.filter(bind => bind.trim());
          }
          if (node.data.mgmtIp?.trim()) nodeConfig["mgmt-ipv4"] = node.data.mgmtIp;
          
          if (Object.keys(nodeConfig).length > 0) {
            acc[node.data.label] = nodeConfig;
          }
          return acc;
        }, {}),
        // Add defaults section
        ...(showDefault && defaultKind && {
          defaults: {
            kind: defaultKind
          }
        }),
        // Rest of the topology sections
        ...(showKind && kinds.length > 0 && {
          kinds: kinds.reduce((acc, kind) => {
            if (kind.name) {
              acc[kind.name] = {
                ...(kind.config.showStartupConfig && { 'startup-config': kind.config.startupConfig }),
                ...(kind.config.showImage && { image: kind.config.image }),
                ...(kind.config.showExec && { exec: kind.config.exec.filter(e => e) }),
                ...(kind.config.showBinds && { binds: kind.config.binds.filter(b => b) })
              };
            }
            return acc;
          }, {})
        }),
        links: updatedEdges.map((edge) => ({
          endpoints: [
            `${updatedNodes.find(n => n.id === edge.source).data.label}:${edge.data.sourceInterface}`,
            `${updatedNodes.find(n => n.id === edge.target).data.label}:${edge.data.targetInterface}`
          ]
        }))
      }
    };

    // Add management section if enabled
    if (showMgmt) {
      yamlData.mgmt = {
        network: mgmtNetwork,
        "ipv4-subnet": ipv4Subnet,
        ...(showIpv6 && ipv6Subnet && { "ipv6-subnet": ipv6Subnet })
      };
    }

    setYamlOutput(yaml.dump(yamlData));
  };

  // Update handleTopologyNameChange function
  const handleTopologyNameChange = (event) => {
    const newTopologyName = event.target.value;
    setTopologyName(newTopologyName);
    
    // Create new YAML data with updated topology name
    const yamlData = {
      name: newTopologyName,
      topology: {
        nodes: nodes.reduce((acc, node) => {
          // ...existing node reduction code...
          return acc;
        }, {}),
        // ...existing topology sections...
        links: edges.map((edge) => ({
          endpoints: [
            `${nodes.find(n => n.id === edge.source).data.label}:${edge.data.sourceInterface}`,
            `${nodes.find(n => n.id === edge.target).data.label}:${edge.data.targetInterface}`
          ]
        }))
      }
    };

    // Update YAML output immediately with new topology name
    setYamlOutput(yaml.dump(yamlData));
  };

  // Handle management inputs change
  const handleMgmtNetworkChange = (event) => {
    const newValue = event.target.value;
    setMgmtNetwork(newValue);
  };

  const handleIpv4SubnetChange = (event) => {
    const newValue = event.target.value;
    setIpv4Subnet(newValue);
  };

  const handleIpv6SubnetChange = (event) => {
    const newValue = event.target.value;
    setIpv6Subnet(newValue);
  };

  // Add handler for configure button
  const handleConfigureKind = () => {
    setShowKindModal(true);
  };

  // Handle default kind change
  const handleDefaultKindChange = (event) => {
    const newValue = event.target.value;
    setDefaultKind(newValue);
  };

  const handleKindNameChange = (index, value) => {
    const newKinds = [...kinds];
    newKinds[index].name = value;
    setKinds(newKinds);
    updateYaml(nodes, edges);
  };

  const handleKindConfigChange = (kindIndex, field, value) => {
    const newKinds = [...kinds];
    newKinds[kindIndex].config[field] = value;
    setKinds(newKinds);
    updateYaml(nodes, edges);
  };

  const handleAddKind = () => {
    const newKind = {
      name: kindName,
      config: {
        showStartupConfig: false,
        startupConfig: '',
        showImage: false,
        image: '',
        showExec: false,
        exec: [''],
        showBinds: false,
        binds: ['']
      }
    };
    setKinds([...kinds, newKind]);
    setKindName('');
    updateYaml(nodes, edges);
  };

  const handleAddExec = () => {
    setKinds(prevKinds => {
      const newKinds = [...prevKinds];
      newKinds[currentKindIndex].config.exec.push("");
      return newKinds;
    });
  };

  const handleAddBind = () => {
    setNodeBinds([...nodeBinds, ""]);
  };

  // Handle node name change
  const handleNodeNameChange = (event) => {
    setNodeName(event.target.value);
  };

  // Handle node binds change
  const handleNodeBindsChange = (index, event) => {
    const newBinds = [...nodeBinds];
    newBinds[index] = event.target.value;
    setNodeBinds(newBinds);
  };

  // Handle adding a new bind input
  const handleAddBindNode = () => {
    setNodeBinds([...nodeBinds, ""]);
  };

  // Handle node management IP change
  const handleNodeMgmtIpChange = (event) => {
    setNodeMgmtIp(event.target.value);
  };

  // Add handlers
  const handleNodeKindChange = (event) => {
    setNodeKind(event.target.value);
  };

  const handleNodeImageChange = (event) => {
    setNodeImage(event.target.value);
  };

  // Handle modal submit
  const handleModalSubmit = () => {
    if (!nodeName.trim() || !nodeKind.trim()) {
      setNodeModalWarning(true);
      return;
    }

    const newNodeWithData = {
      ...newNode,
      data: {
        ...newNode.data,
        label: nodeName,
        kind: nodeKind,
        image: nodeImage,
        binds: nodeBinds,
        mgmtIp: nodeMgmtIp,
      },
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

    updateYaml([...nodes, newNodeWithData], edges);
    setIsModalOpen(false);
    setNodeName("");
    setNodeKind("");
    setNodeImage("");
    setNodeBinds([""]);
    setNodeMgmtIp("");
    setNodeModalWarning(false);
  };

  // Handle modal cancel
  const handleModalCancel = () => {
    setIsModalOpen(false);
    setNodeName("");
    setNodeBinds([""]);
    setNodeMgmtIp("");
  };

  // Define isValidConnection function to allow all connections
  const isValidConnection = () => true;

  // Handle download YAML button click
  const handleDownloadYaml = () => {
    const blob = new Blob([yamlOutput], { type: "text/yaml;charset=utf-8" });
    saveAs(blob, `${topologyName}.yml`);
  };

  // Handle right-click on node to show context menu
  const onNodeContextMenu = (event, node) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      element: node,
      type: 'node',
    });
  };

  // Handle right-click on edge to show context menu
  const onEdgeContextMenu = (event, edge) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      element: edge,
      type: 'edge',
    });
  };

  // Handle context menu close
  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  // Handle node removal from context menu
  const handleRemoveNode = () => {
    const nodeToRemove = contextMenu.element;
    const updatedNodes = nodes.filter((n) => n.id !== nodeToRemove.id);
    const updatedEdges = edges.filter((e) => e.source !== nodeToRemove.id && e.target !== nodeToRemove.id);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    updateYaml(updatedNodes, updatedEdges);
    handleContextMenuClose();
  };

  // Handle edge removal from context menu
  const handleRemoveEdge = () => {
    const edgeToRemove = contextMenu.element;
    const updatedEdges = edges.filter((e) => e.id !== edgeToRemove.id);
    setEdges(updatedEdges);
    updateYaml(nodes, updatedEdges);
    handleContextMenuClose();
  };

  // Update reset handler to include YAML reset
  const handleReset = () => {
    // Reset all state
    setTopologyName("");
    setShowMgmt(false);
    setMgmtNetwork("");
    setIpv4Subnet("");
    setShowIpv6(false);
    setIpv6Subnet("");
    setShowKind(false);
    setKinds([{
      name: '',
      config: {
        showStartupConfig: false,
        startupConfig: '',
        showImage: false,
        image: '',
        showExec: false,
        exec: [''],
        showBinds: false,
        binds: ['']
      }
    }]);
    setShowDefault(false);
    setDefaultKind("");
    
    // Reset nodes and edges
    setNodes([]);
    setEdges([]);
    
    // Reset YAML
    setYamlOutput(yaml.dump(DEFAULT_YAML));
  };

  // Update handleEdgeModalSubmit function
  const handleEdgeModalSubmit = () => {
    if (!sourceInterface.trim() || !targetInterface.trim()) {
      setEdgeModalWarning(true);
      return;
    }

    const newEdge = {
      ...newEdgeData,
      id: isModifyingEdge ? newEdgeData.id : `edge_${newEdgeData.source}_${newEdgeData.target}`,
      data: {
        sourceInterface,
        targetInterface
      }
    };

    if (isModifyingEdge) {
      setEdges((eds) => {
        const updatedEdges = eds.map((edge) => 
          edge.id === newEdge.id ? newEdge : edge
        );
        updateYaml(nodes, updatedEdges);
        return updatedEdges;
      });
      setIsModifyingEdge(false);
    } else {
      setEdges((eds) => {
        const updatedEdges = addEdge(newEdge, eds);
        updateYaml(nodes, updatedEdges);
        return updatedEdges;
      });
    }

    setIsEdgeModalOpen(false);
    setSourceInterface("");
    setTargetInterface("");
    setNewEdgeData(null);
    setEdgeModalWarning(false);
  };

  // Update checkbox handlers
  const handleCheckboxChange = (setter, checked) => {
    if (!validateTopologyName()) {
      return;
    }
    setter(checked);
    updateYaml(nodes, edges);
  };

  // Add handleMgmtCheckbox function
  const handleMgmtCheckbox = (e) => {
    if (!validateTopologyName()) {
      return;
    }
    setShowMgmt(e.target.checked);
    // Reset management values when unchecked
    if (!e.target.checked) {
      setMgmtNetwork('');
      setIpv4Subnet('');
      setIpv6Subnet('');
      setShowIpv6(false);
    }
    updateYaml(nodes, edges);
  };

  // Update checkbox handlers
  const handleKindCheckbox = (e) => {
    if (!validateTopologyName()) {
      return;
    }
    setShowKind(e.target.checked);
    // Reset kinds when unchecked
    if (!e.target.checked) {
      setKinds([{
        name: '',
        config: {
          showStartupConfig: false,
          startupConfig: '',
          showImage: false,
          image: '',
          showExec: false,
          exec: [''],
          showBinds: false,
          binds: ['']
        }
      }]);
    }
    updateYaml(nodes, edges);
  };

  const handleDefaultCheckbox = (e) => {
    if (!validateTopologyName()) {
      return;
    }
    setShowDefault(e.target.checked);
    // Reset default kind when unchecked
    if (!e.target.checked) {
      setDefaultKind('');
    }
    updateYaml(nodes, edges);
  };

  // Add handler for IPv6 checkbox
  const handleIpv6Checkbox = (e) => {
    setShowIpv6(e.target.checked);
    updateYaml(nodes, edges);
  };

  // Add handler for modify action
  const handleModifyNode = () => {
    const nodeToModify = contextMenu.element;
    setNodeName(nodeToModify.data.label);
    setNodeKind(nodeToModify.data.kind || "");
    setNodeImage(nodeToModify.data.image || "");
    setNodeBinds(nodeToModify.data.binds || [""]);
    setNodeMgmtIp(nodeToModify.data.mgmtIp || "");
    setNewNode(nodeToModify);
    setIsModifying(true);
    setIsModalOpen(true);
    setContextMenu(null);
  };

  // Add handler for modify edge
  const handleModifyEdge = () => {
    const edgeToModify = contextMenu.element;
    setSourceInterface(edgeToModify.data.sourceInterface || "");
    setTargetInterface(edgeToModify.data.targetInterface || "");
    setNewEdgeData({
      ...edgeToModify,
      sourceNodeName: nodes.find(n => n.id === edgeToModify.source).data.label,
      targetNodeName: nodes.find(n => n.id === edgeToModify.target).data.label
    });
    setIsEdgeModalOpen(true);
    setIsModifyingEdge(true);
    setContextMenu(null);
  };

  // Add new handler for kind binds
  const handleAddKindBind = () => {
    const newKinds = [...kinds];
    newKinds[currentKindIndex].config.binds.push('');
    setKinds(newKinds);
  };

  // Add handleKindModalDone function
  const handleKindModalDone = () => {
    setShowKindModal(false);
    updateYaml(nodes, edges);
  };

  return (
    <ReactFlowProvider>
      <div className="app">
        <div className="header">
          <div className="header-buttons">
            <button 
              className={`header-button ${mode === 'containerlab' ? 'active' : ''}`}
              onClick={() => handleModeChange('containerlab')}
            >
              ContainerLab
            </button>
            <button 
              className={`header-button ${mode === 'act' ? 'active' : ''}`}
              onClick={() => handleModeChange('act')}
            >
              ACT
            </button>
          </div>
          <h1>Container Lab Topology Designer</h1>
        </div>

        <div className="dndflow">
          {mode === 'containerlab' ? (
            // Existing ContainerLab Layout
            <>
              <div className="node-panel">
                <Sidebar />
                <div className="input-group">
                  <label>Name of the topology:</label>
                  <input
                    type="text"
                    value={topologyName}
                    onChange={handleTopologyNameChange}
                  />
                </div>

                <h3 className="settings-heading">
                  Global Settings
                  <span className="info-icon">ⓘ</span>
                </h3>

                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={showMgmt}
                      onChange={handleMgmtCheckbox}
                    />
                    Add Management
                  </label>
                </div>

                {showMgmt && (
                  <div className="management-section">
                    <div className="input-group">
                      <label>Network:</label>
                      <input
                        type="text"
                        value={mgmtNetwork}
                        onChange={(e) => setMgmtNetwork(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label>IPv4 Subnet:</label>
                      <input
                        type="text"
                        value={ipv4Subnet}
                        onChange={(e) => setIpv4Subnet(e.target.value)}
                      />
                    </div>
                    <div className="checkbox-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={showIpv6}
                          onChange={(e) => setShowIpv6(e.target.checked)}
                        />
                        Add IPv6 Subnet
                      </label>
                    </div>
                    {showIpv6 && (
                      <div className="input-group">
                        <label>IPv6 Subnet:</label>
                        <input
                          type="text"
                          value={ipv6Subnet}
                          onChange={(e) => setIpv6Subnet(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={showKind}
                      onChange={handleKindCheckbox}
                    />
                    Add Kinds
                  </label>
                </div>
                {showKind && (
                  <div className="kinds-section">
                    {kinds.map((kind, index) => (
                      <div key={index} className="kind-input-group">
                        <label htmlFor={`kind-name-${index}`}>Kind Name</label>
                        <input
                          id={`kind-name-${index}`}
                          type="text"
                          value={kind.name}
                          onChange={(e) => handleKindNameChange(index, e.target.value)}
                        />
                        <button onClick={() => {
                          setShowKindModal(true);
                          setCurrentKindIndex(index);
                        }}>Configure</button>
                      </div>
                    ))}
                    <button onClick={handleAddKind}>Add More Kinds</button>
                  </div>
                )}
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={showDefault}
                      onChange={handleDefaultCheckbox}
                    />
                    Add Default
                  </label>
                </div>
                {showDefault && (
                  <div className="default-input-group">
                    <label htmlFor="default-kind">Default Kind:</label>
                    <input
                      id="default-kind"
                      type="text"
                      value={defaultKind}
                      onChange={handleDefaultKindChange}
                      placeholder="e.g., ceos"
                    />
                  </div>
                )}
                <button className="reset-button" onClick={handleReset}>
                  Reset All Fields
                </button>
              </div>
              <div
                className="reactflow-wrapper"
                ref={reactFlowWrapper}
                onDrop={onDrop}
                onDragOver={onDragOver}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onElementsRemove={onElementsRemove}
                  isValidConnection={isValidConnection}
                  fitView
                  onNodeContextMenu={onNodeContextMenu}
                  onEdgeContextMenu={onEdgeContextMenu}
                />
              </div>
              <div className="yaml-output">
                <textarea value={yamlOutput} readOnly />
                <button onClick={handleDownloadYaml}>Download YAML</button>
              </div>
            </>
          ) : (
            // ACT Layout
            <>
              <div className="node-panel">
                <h3>Drag and drop to add nodes</h3>
                <Sidebar />
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
                  fitView
                >
                  <Controls />
                </ReactFlow>
              </div>
              <div className="yaml-output">
                <h3>YAML Output</h3>
                <pre>{yamlOutput}</pre>
              </div>
            </>
          )}
        </div>
        {isModalOpen && (
          <div className="modal">
            <div className="modal-content">
              <h2>Enter Node Details</h2>
              <div className="form-content">
                {nodeModalWarning && (
                  <div className="warning-message">
                    Node Name and Kind are required fields
                  </div>
                )}
                <div className="input-group">
                  <label>Name of the node: *</label>
                  <input
                    type="text"
                    value={nodeName}
                    placeholder="e.g., spine1"
                    onChange={handleNodeNameChange}
                    className={nodeModalWarning && !nodeName.trim() ? 'input-error' : ''}
                  />
                </div>
                <div className="input-group">
                  <label>Kind: *</label>
                  <input
                    type="text"
                    value={nodeKind}
                    placeholder="e.g., ceos"
                    onChange={handleNodeKindChange}
                    className={nodeModalWarning && !nodeKind.trim() ? 'input-error' : ''}
                  />
                </div>
                <div className="input-group">
                  <label>Image:</label>
                  <input
                    type="text"
                    value={nodeImage}
                    onChange={handleNodeImageChange}
                    placeholder="e.g., ceos:4.31.4M"
                  />
                </div>
                <div className="input-group">
                  <label>Binds:</label>
                  {nodeBinds.map((bind, index) => (
                    <input
                      key={index}
                      type="text"
                      value={bind}
                      onChange={(e) => {
                        const newBinds = [...nodeBinds];
                        newBinds[index] = e.target.value;
                        setNodeBinds(newBinds);
                      }}
                      placeholder="Enter bind path"
                    />
                  ))}
                  <button type="button" onClick={handleAddBind}>Add Bind</button>
                </div>
                <div className="input-group">
                  <label>Management IP:</label>
                  <input
                    type="text"
                    value={nodeMgmtIp}
                    onChange={handleNodeMgmtIpChange}
                  />
                </div>
              </div>
              <div className="actions">
                <button onClick={handleModalSubmit}>Submit</button>
                <button onClick={handleModalCancel}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {showKindModal && (
          <div className="modal">
            <div className="modal-content kind-config-modal">
              <h2>Configure Kind: {kinds[currentKindIndex].name}</h2>
              
              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showStartupConfig}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showStartupConfig', e.target.checked)}
                  />
                  Startup Config
                </label>
                {kinds[currentKindIndex].config.showStartupConfig && (
                  <input
                    type="text"
                    value={kinds[currentKindIndex].config.startupConfig}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'startupConfig', e.target.value)}
                    placeholder="Enter startup config path"
                  />
                )}
              </div>

              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showImage}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showImage', e.target.checked)}
                  />
                  Image
                </label>
                {kinds[currentKindIndex].config.showImage && (
                  <input
                    type="text"
                    value={kinds[currentKindIndex].config.image}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'image', e.target.value)}
                    placeholder="Enter image name"
                  />
                )}
              </div>

              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showExec}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showExec', e.target.checked)}
                  />
                  Exec Commands
                </label>
                {kinds[currentKindIndex].config.showExec && (
                  <div className="exec-commands">
                    {kinds[currentKindIndex].config.exec.map((cmd, index) => (
                      <input
                        key={index}
                        type="text"
                        value={cmd}
                        onChange={(e) => {
                          const newExec = [...kinds[currentKindIndex].config.exec];
                          newExec[index] = e.target.value;
                          handleKindConfigChange(currentKindIndex, 'exec', newExec);
                        }}
                        placeholder="Enter exec command"
                      />
                    ))}
                    <button onClick={handleAddExec}>Add Exec Command</button>
                  </div>
                )}
              </div>

              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showBinds}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showBinds', e.target.checked)}
                  />
                  Binds
                </label>
                {kinds[currentKindIndex].config.showBinds && (
                  <div className="binds">
                    {kinds[currentKindIndex].config.binds.map((bind, index) => (
                      <input
                        key={index}
                        type="text"
                        value={bind}
                        onChange={(e) => {
                          const newBinds = [...kinds[currentKindIndex].config.binds];
                          newBinds[index] = e.target.value;
                          handleKindConfigChange(currentKindIndex, 'binds', newBinds);
                        }}
                        placeholder="Enter bind path"
                      />
                    ))}
                    <button onClick={handleAddKindBind}>Add Bind</button>
                  </div>
                )}
              </div>

              <div className="actions">
                <button onClick={() => setShowKindModal(false)}>Cancel</button>
                <button onClick={handleKindModalDone}>Done</button>
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
            {contextMenu.type === 'node' && (
              <>
                <button onClick={handleModifyNode}>Modify</button>
                <button onClick={handleRemoveNode}>Remove Node</button>
                <button onClick={handleContextMenuClose}>Cancel</button>
              </>
            )}
            {contextMenu.type === 'edge' && (
              <>
                <button onClick={handleModifyEdge}>Modify</button>
                <button onClick={handleRemoveEdge}>Remove Edge</button>
                <button onClick={handleContextMenuClose}>Cancel</button>
              </>
            )}
          </div>
        )}
        {isEdgeModalOpen && (
          <div className="modal">
            <div className="modal-content">
              <h2>Configure Link Interfaces</h2>
              {edgeModalWarning && (
                <div className="warning-message">
                  Please enter both source and target interface details
                </div>
              )}
              <div className="input-group">
                <label>{newEdgeData.sourceNodeName} Interface:</label>
                <input
                  type="text"
                  value={sourceInterface}
                  onChange={(e) => setSourceInterface(e.target.value)}
                  className={edgeModalWarning && !sourceInterface.trim() ? 'input-error' : ''}
                />
              </div>
              <div className="input-group">
                <label>{newEdgeData.targetNodeName} Interface:</label>
                <input
                  type="text"
                  value={targetInterface}
                  onChange={(e) => setTargetInterface(e.target.value)}
                  className={edgeModalWarning && !targetInterface.trim() ? 'input-error' : ''}
                />
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
        {showWarning && (
          <div className="modal warning-modal">
            <div className="modal-content">
              <h3>Warning</h3>
              <p>Please enter the topology name first</p>
              <button onClick={() => setShowWarning(false)}>OK</button>
            </div>
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
};

export default App;