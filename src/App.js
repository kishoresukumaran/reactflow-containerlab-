import React, { useState, useRef, useCallback } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
} from "react-flow-renderer";
import Sidebar from "./Sidebar";
import yaml from "js-yaml";
import "./styles.css";

let id = 0;
const getId = () => `node_${id++}`;

const App = () => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yamlOutput, setYamlOutput] = useState("");
  const [topologyName, setTopologyName] = useState("container-lab-topology");

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
        type,
        position,
        data: { label: `${type} node` },
      };

      setNodes((nds) => nds.concat(newNode));
      updateYaml([...nodes, newNode], edges);
    },
    [nodes, edges]
  );

  // Allow dragging over the canvas
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Update YAML dynamically
  const updateYaml = (updatedNodes, updatedEdges) => {
    const yamlData = {
      name: topologyName,
      topology: {
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
    };

    setYamlOutput(yaml.dump(yamlData));
  };

  // Handle topology name change
  const handleTopologyNameChange = (event) => {
    setTopologyName(event.target.value);
    updateYaml(nodes, edges);
  };

  // Define isValidConnection function to allow all connections
  const isValidConnection = () => true;

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
              isValidConnection={isValidConnection}
              edgeType="straight"
              fitView
            />
          </div>
          <div className="yaml-output">
            <textarea value={yamlOutput} readOnly />
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default App;