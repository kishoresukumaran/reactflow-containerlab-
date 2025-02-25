import React from "react";
import ReactFlow, { addEdge, useNodesState, useEdgesState } from "react-flow-renderer";

const DesignArea = ({ nodes, edges, setNodes, setEdges, updateYaml }) => {
  const [reactFlowNodes, setReactFlowNodes] = useNodesState(nodes);
  const [reactFlowEdges, setReactFlowEdges] = useEdgesState(edges);

  // Handle new connections between nodes
  const onConnect = (params) => {
    const updatedEdges = addEdge(params, reactFlowEdges);
    setReactFlowEdges(updatedEdges);
    updateYaml(reactFlowNodes, updatedEdges); // Update YAML when edges change
  };

  // Handle node changes (e.g., position updates)
  const onNodesChange = (changes) => {
    const updatedNodes = changes.reduce((acc, change) => {
      if (change.type === "add") {
        acc.push({
          id: change.item.id,
          data: { kind: change.item.data.kind || "default", label: "New Node" },
          position: change.item.position,
        });
      }
      return acc;
    }, reactFlowNodes);

    setReactFlowNodes(updatedNodes);
    updateYaml(updatedNodes, reactFlowEdges); // Update YAML when nodes change
  };

  return (
    <div className="design-area">
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
        fitView
      />
    </div>
  );
};

export default DesignArea;
