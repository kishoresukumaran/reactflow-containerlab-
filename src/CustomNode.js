import React from 'react';
import { Handle } from 'react-flow-renderer';

const CustomNode = ({ data }) => {
  return (
    <div className="custom-node">
      <div>{data.label}</div>
      <Handle type="target" position="top" />
      <Handle type="source" position="bottom" />
      <Handle type="target" position="left" />
      <Handle type="source" position="right" />
    </div>
  );
};

export default CustomNode;