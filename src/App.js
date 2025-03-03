import React, { useState } from 'react';
import ContainerLab from './components/ContainerLab';
import ACT from './components/ACT';

const App = () => {
  const [mode, setMode] = useState('containerlab');

  return (
    <div className="app">
      <div className="header">
        <div className="header-buttons">
          <button 
            className={`header-button ${mode === 'containerlab' ? 'active' : ''}`}
            onClick={() => setMode('containerlab')}
          >
            ContainerLab
          </button>
          <button 
            className={`header-button ${mode === 'act' ? 'active' : ''}`}
            onClick={() => setMode('act')}
          >
            ACT
          </button>
        </div>
        <h1>Container Lab Topology Designer</h1>
      </div>
      
      {mode === 'containerlab' ? <ContainerLab /> : <ACT />}
    </div>
  );
};

export default App;