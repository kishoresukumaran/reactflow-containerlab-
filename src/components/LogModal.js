import React from 'react';

const LogModal = ({ isOpen, onClose, logs, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-3/4 max-w-4xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="p-4 flex-1 overflow-auto">
          <pre className="bg-black text-green-400 p-4 rounded font-mono text-sm whitespace-pre-wrap h-[400px] overflow-y-auto">
            {logs}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default LogModal; 