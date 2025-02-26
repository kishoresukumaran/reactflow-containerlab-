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

const App = () => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yamlOutput, setYamlOutput] = useState("");
  const [topologyName, setTopologyName] = useState("container-lab-topology");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNode, setNewNode] = useState(null);
  const [nodeName, setNodeName] = useState("");
  const [mgmtNetwork, setMgmtNetwork] = useState("");
  const [ipv4Subnet, setIpv4Subnet] = useState("");
  const [ipv6Subnet, setIpv6Subnet] = useState("");
  const [kinds, setKinds] = useState([]);
  const [defaultKind, setDefaultKind] = useState("");

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
        setNodeName("");
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
          const kindData = {};
          if (kind.startupConfig !== null) kindData["startup-config"] = kind.startupConfig;
          if (kind.image !== null) kindData.image = kind.image;
          if (kind.exec.length > 0) kindData.exec = kind.exec.filter(line => line);
          if (kind.binds.length > 0) kindData.binds = kind.binds.filter(line => line);
          acc[kind.name] = kindData;
          return acc;
        }, {}),
        defaults: {
          kind: defaultKind,
        },
        nodes: updatedNodes.map((node) => ({
          id: node.id,
          label: node.data.label,
          position: node.position,
        })),
        links: updatedEdges.map((edge) => ({
          source: edge.source,
          target: edge.target,
        })),
      },
      mgmt: {
        network: mgmtNetwork,
        "ipv4-subnet": ipv4Subnet,
        "ipv6-subnet": ipv6Subnet,
      },
    };

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

  // Handle default kind change
  const handleDefaultKindChange = (event) => {
    setDefaultKind(event.target.value);
    updateYaml(nodes, edges);
  };

  const handleKindChange = (index, field, value) => {
    const newKinds = [...kinds];
    newKinds[index][field] = value;
    setKinds(newKinds);
    updateYaml(nodes, edges);
  };

  const handleAddKind = () => {
    setKinds([...kinds, { name: "", startupConfig: null, image: null, exec: [], binds: [] }]);
  };

  const handleRemoveKind = (index) => {
    const removedKind = kinds[index].name;
    const newKinds = kinds.filter((_, i) => i !== index);
    setKinds(newKinds);
    if (defaultKind === removedKind) {
      setDefaultKind("");
    }
    updateYaml(nodes, edges);
  };

  // Handle node name change
  const handleNodeNameChange = (event) => {
    setNodeName(event.target.value);
  };

  // Handle modal submit
  const handleModalSubmit = () => {
    if (newNode) {
      newNode.data.label = nodeName;
      setNodes((nds) => nds.concat(newNode));
      updateYaml([...nodes, newNode], edges);
      setIsModalOpen(false);
      setNodeName("");
    }
  };

  // Handle modal cancel
  const handleModalCancel = () => {
    setIsModalOpen(false);
    setNodeName("");
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

  return (
    <ReactFlowProvider>
      <div className="app">
        <h1>Container Lab Designer</h1>
        <div className="dndflow">
          <div className="node-panel">
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
              <h3>Management</h3>
              <label htmlFor="mgmt-network">Network:</label>
              <input
                id="mgmt-network"
                type="text"
                value={mgmtNetwork}
                onChange={handleMgmtNetworkChange}
              />
            </div>
            <div>
              <label htmlFor="ipv4-subnet">IPv4 Subnet:</label>
              <input
                id="ipv4-subnet"
                type="text"
                value={ipv4Subnet}
                onChange={handleIpv4SubnetChange}
              />
            </div>
            <div>
              <label htmlFor="ipv6-subnet">IPv6 Subnet:</label>
              <input
                id="ipv6-subnet"
                type="text"
                value={ipv6Subnet}
                onChange={handleIpv6SubnetChange}
              />
            </div>
            <div>
              <h3>Global Settings</h3>
              <label htmlFor="default-kind">Default Kind:</label>
              <input
                id="default-kind"
                type="text"
                value={defaultKind}
                onChange={handleDefaultKindChange}
              />
              <h4>Kinds</h4>
              <button onClick={handleAddKind}>Add Kind</button>
              {kinds.map((kind, index) => (
                <div key={index} className="kind-section">
                  <input
                    type="text"
                    placeholder="Kind Name"
                    value={kind.name}
                    onChange={(e) => handleKindChange(index, "name", e.target.value)}
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={kind.startupConfig !== null}
                      onChange={(e) => handleKindChange(index, "startupConfig", e.target.checked ? "" : null)}
                    />
                    Startup Config
                  </label>
                  {kind.startupConfig !== null && (
                    <input
                      type="text"
                      value={kind.startupConfig}
                      onChange={(e) => handleKindChange(index, "startupConfig", e.target.value)}
                    />
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={kind.image !== null}
                      onChange={(e) => handleKindChange(index, "image", e.target.checked ? "" : null)}
                    />
                    Image
                  </label>
                  {kind.image !== null && (
                    <input
                      type="text"
                      value={kind.image}
                      onChange={(e) => handleKindChange(index, "image", e.target.value)}
                    />
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={kind.exec.length > 0}
                      onChange={(e) => handleKindChange(index, "exec", e.target.checked ? [""] : [])}
                    />
                    Exec
                  </label>
                  {kind.exec.length > 0 && kind.exec.map((line, execIndex) => (
                    <input
                      key={execIndex}
                      type="text"
                      value={line}
                      onChange={(e) => {
                        const newExec = [...kind.exec];
                        newExec[execIndex] = e.target.value;
                        handleKindChange(index, "exec", newExec);
                      }}
                    />
                  ))}
                  {kind.exec.length > 0 && <button onClick={() => handleKindChange(index, "exec", [...kind.exec, ""])}>Add Exec</button>}
                  <label>
                    <input
                      type="checkbox"
                      checked={kind.binds.length > 0}
                      onChange={(e) => handleKindChange(index, "binds", e.target.checked ? [""] : [])}
                    />
                    Binds
                  </label>
                  {kind.binds.length > 0 && kind.binds.map((line, bindIndex) => (
                    <input
                      key={bindIndex}
                      type="text"
                      value={line}
                      onChange={(e) => {
                        const newBinds = [...kind.binds];
                        newBinds[bindIndex] = e.target.value;
                        handleKindChange(index, "binds", newBinds);
                      }}
                    />
                  ))}
                  {kind.binds.length > 0 && <button onClick={() => handleKindChange(index, "binds", [...kind.binds, ""])}>Add Bind</button>}
                  <button onClick={() => handleRemoveKind(index)}>Remove Kind</button>
                </div>
              ))}
            </div>
            <Sidebar />
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
              <h2>Enter Node Name</h2>
              <input
                type="text"
                value={nodeName}
                onChange={handleNodeNameChange}
              />
              <button onClick={handleModalSubmit}>Submit</button>
              <button onClick={handleModalCancel}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
};

export default App;