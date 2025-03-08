import React from 'react';

const LogModal = ({ isOpen, onClose, logs, title }) => {
  if (!isOpen) return null;

  return (
    <div className="logModal-overlay">
      <div className="logModal-container">
        <div className="logModal-header">
          <h2 className="logModal-title">{title}</h2>
          <button
            onClick={onClose}
            className="logModal-close-button"
          >
            <svg className="logModal-close-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="logModal-content">
          <pre className="logModal-logs">
            {logs}
          </pre>
        </div>
        <div className="logModal-footer">
          <button
            onClick={onClose}
            className="logModal-close-btn"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogModal;