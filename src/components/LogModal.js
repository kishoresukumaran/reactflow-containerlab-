import React from 'react';

const LogModal = ({ isOpen, onClose, logs, title, showSuccess = false, onNavigateToServers }) => {
  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content" style={{ width: '80%', maxWidth: '800px' }}>
        <h2>{title}</h2>
        <div className="log-content" style={{ 
          maxHeight: '400px', 
          overflowY: 'auto', 
          whiteSpace: 'pre-wrap',
          backgroundColor: '#f5f5f5',
          padding: '10px',
          marginBottom: '20px',
          fontFamily: 'monospace'
        }}>
          {logs}
        </div>
        {showSuccess && (
          <div style={{ 
            marginBottom: '20px', 
            padding: '10px', 
            backgroundColor: '#e6ffe6', 
            borderRadius: '4px',
            textAlign: 'center' 
          }}>
            <p style={{ marginBottom: '10px' }}>
              Deployment successful! Please check Servers page to access the nodes.
            </p>
            <button
              onClick={onNavigateToServers}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Go to Servers
            </button>
          </div>
        )}
        <div className="actions" style={{ textAlign: 'right' }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default LogModal;