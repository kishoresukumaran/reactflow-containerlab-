import React from "react";

const Sidebar = () => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside>
      <div className="description">Drag and drop to add nodes</div>
      <div
        className="node"
        onDragStart={(event) => onDragStart(event, "Arista cEOS")}
        draggable
      >
        Arista cEOS
      </div>
      <div
        className="node"
        onDragStart={(event) => onDragStart(event, "Linux Server")}
        draggable
      >
        Linux Server
      </div>
    </aside>
  );
};

export default Sidebar;
