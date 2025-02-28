import React from 'react';
import { Handle, Position } from 'react-flow-renderer';

const CustomNode = ({ data }) => {
  return (
    <div className="network-node">
      {data.ports.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={port.position}
          style={{
            [port.position === Position.TOP || port.position === Position.BOTTOM ? 'left' : 'top']: 
            port.position === Position.TOP || port.position === Position.BOTTOM ? port.offsetX : port.offsetY
          }}
        />
      ))}
      <div className="node-content">
        <div className="node-label">{data.label}</div>
      </div>
    </div>
  );
};

export default CustomNode;