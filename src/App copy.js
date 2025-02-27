import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
} from "react-flow-renderer";
import Sidebar from "./Sidebar";
import CustomNode from "./CustomNode";
import yaml from "js-yaml";
import { saveAs } from "file-saver";
import * as htmlToImage from 'html-to-image';
import "./styles.css";

let id = 0;
const getId = () => `node_${id++}`;

const nodeTypes = {
  customNode: CustomNode,
};

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

  // Allow connections between any nodes
  const onConnect = useCallback(
    (params) => {
      const updatedEdges = addEdge(params, edges);
      setEdges(updatedEdges);
      updateYaml(nodes, updatedEdges);
    },
    [edges, nodes]
  );

  // Handle drag-and-drop for adding new nodes
  const onDrop = useCallback(
    (event) => {
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
        type: 'customNode',
        position,
        data: { label: `${type} node` },
      };

      setNewNode(newNode);
      setIsModalOpen(true);
    },
    [nodes, edges]
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

  // Update YAML dynamically
  const updateYaml = (updatedNodes, updatedEdges) => {
    const yamlData = {
      name: topologyName,
      topology: {
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
        }, {}),
        nodes: updatedNodes.reduce((acc, node) => {
          acc[node.data.label] = {
            binds: node.data.binds,
            "mgmt-ipv4": node.data.mgmtIp,
          };
          return acc;
        }, {}),
        links: updatedEdges.map((edge) => ({
          source: edge.source,
          target: edge.target,
        })),
      },
    };

    if (showDefault) {
      yamlData.topology.defaults = {
        kind: defaultKind
      };
    }

    if (showMgmt) {
      yamlData.mgmt = {
        network: mgmtNetwork,
        "ipv4-subnet": ipv4Subnet,
        ...(showIpv6 && { "ipv6-subnet": ipv6Subnet }),
      };
    }

    setYamlOutput(yaml.dump(yamlData));
  };

  // Handle topology name change
  const handleTopologyNameChange = (event) => {
    setTopologyName(event.target.value);
    updateYaml(nodes, edges);
  };

  // Handle management inputs change
  const handleMgmtNetworkChange = (event) => {
    setMgmtNetwork(event.target.value);
    updateYaml(nodes, edges);
  };

  const handleIpv4SubnetChange = (event) => {
    setIpv4Subnet(event.target.value);
    updateYaml(nodes, edges);
  };

  const handleIpv6SubnetChange = (event) => {
    setIpv6Subnet(event.target.value);
    updateYaml(nodes, edges);
  };

  // Add handler for configure button
  const handleConfigureKind = () => {
    setShowKindModal(true);
  };

  // Handle default kind change
  const handleDefaultKindChange = (event) => {
    setDefaultKind(event.target.value);
    updateYaml(nodes, edges);
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
    setKinds([...kinds, {
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
  };

  const handleAddExec = () => {
    setKinds(prevKinds => {
      const newKinds = [...prevKinds];
      newKinds[currentKindIndex].config.exec.push("");
      return newKinds;
    });
  };

  const handleAddBind = () => {
    setNodeBinds(prevBinds => [...prevBinds, ""]);
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

  // Handle modal submit
  const handleModalSubmit = () => {
    if (newNode) {
      newNode.data.label = nodeName;
      newNode.data.binds = nodeBinds.filter(bind => bind);
      newNode.data.mgmtIp = nodeMgmtIp;
      setNodes((nds) => nds.concat(newNode));
      updateYaml([...nodes, newNode], edges);
      setIsModalOpen(false);
      setNodeName("");
      setNodeBinds([""]);
      setNodeMgmtIp("");
    }
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

  // Handle download PNG button click
  const handleDownloadPng = () => {
    htmlToImage.toPng(reactFlowWrapper.current)
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `${topologyName}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((error) => {
        console.error('Error generating PNG:', error);
      });
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

  return (
    <ReactFlowProvider>
      <div className="app">
        <h1>Container Lab Designer</h1>
        <div className="dndflow">
          <div className="node-panel">
            <Sidebar />
            <div>
              <label htmlFor="topology-name">Name of the topology:</label>
              <input
                id="topology-name"
                type="text"
                value={topologyName}
                onChange={handleTopologyNameChange}
              />
            </div>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={showMgmt}
                  onChange={(e) => {
                    setShowMgmt(e.target.checked);
                    updateYaml(nodes, edges);
                  }}
                />
                Add Management
              </label>
              {showMgmt && (
                <>
                  <label htmlFor="mgmt-network">Network:</label>
                  <input
                    id="mgmt-network"
                    type="text"
                    value={mgmtNetwork}
                    onChange={handleMgmtNetworkChange}
                  />
                  <label htmlFor="ipv4-subnet">IPv4 Subnet:</label>
                  <input
                    id="ipv4-subnet"
                    type="text"
                    value={ipv4Subnet}
                    onChange={handleIpv4SubnetChange}
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={showIpv6}
                      onChange={(e) => {
                        setShowIpv6(e.target.checked);
                        updateYaml(nodes, edges);
                      }}
                    />
                    Add IPv6 Subnet
                  </label>
                  {showIpv6 && (
                    <input
                      id="ipv6-subnet"
                      type="text"
                      value={ipv6Subnet}
                      onChange={handleIpv6SubnetChange}
                    />
                  )}
                </>
              )}
            </div>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={showKind}
                  onChange={(e) => {
                    setShowKind(e.target.checked);
                    updateYaml(nodes, edges);
                  }}
                />
                Add Kinds
              </label>
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
            </div>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={showDefault}
                  onChange={(e) => {
                    setShowDefault(e.target.checked);
                    updateYaml(nodes, edges);
                  }}
                />
                Add Default
              </label>
              {showDefault && (
                <div className="default-input-group">
                  <label htmlFor="default-kind">Default Kind</label>
                  <input
                    id="default-kind"
                    type="text"
                    value={defaultKind}
                    onChange={(e) => {
                      setDefaultKind(e.target.value);
                      updateYaml(nodes, edges);
                    }}
                  />
                </div>
              )}
            </div>
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
              edgeType="straight"
              fitView
              nodeTypes={nodeTypes}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeContextMenu={onEdgeContextMenu}
            />
            <button className="download-button" onClick={handleDownloadPng}>Download Topology as PNG</button>
          </div>
          <div className="yaml-output">
            <textarea value={yamlOutput} readOnly />
            <button onClick={handleDownloadYaml}>Download YAML</button>
          </div>
        </div>
        {isModalOpen && (
          <div className="modal">
            <div className="modal-content">
              <h2>Enter Node Details</h2>
              <div className="input-group">
                <label>Name of the node:</label>
                <input
                  type="text"
                  value={nodeName}
                  onChange={handleNodeNameChange}
                />
              </div>
              <div className="input-group">
                <label>Binds:</label>
                {nodeBinds.map((bind, index) => (
                  <div key={index} className="bind-input">
                    <input
                      type="text"
                      value={bind}
                      onChange={(e) => handleNodeBindsChange(index, e)}
                      placeholder={`Bind path ${index + 1}`}
                    />
                  </div>
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
                    <button onClick={handleAddBind}>Add Bind</button>
                  </div>
                )}
              </div>

              <button onClick={() => setShowKindModal(false)}>Done</button>
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
              <button onClick={handleRemoveNode}>Remove Node</button>
            )}
            {contextMenu.type === 'edge' && (
              <button onClick={handleRemoveEdge}>Remove Link</button>
            )}
            <button onClick={handleContextMenuClose}>Cancel</button>
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
};

export default App;