import React from 'react';

const Sidebar = () => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', 'default');  // Changed to 'default'
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside>
      <div className="description"><h3 className="settings-heading">Drag and drop to add nodes</h3></div>
      <div
        className="node"
        onDragStart={(event) => onDragStart(event, 'node')}
        draggable
      >
        Node
      </div>
    </aside>
  );
};

export default Sidebar;