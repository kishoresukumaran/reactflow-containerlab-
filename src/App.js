import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ContainerLab from './components/ContainerLab';
import ACT from './components/ACT';
import ClabServers from './components/ClabServers';
import Login from './components/Login';
import WebTerminal from './components/WebTerminal';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const handleLogin = (userInfo) => {
    setIsAuthenticated(true);
    setUser(userInfo);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route 
          path="/terminal/:serverIp/:nodeName/:nodeIp" 
          element={<WebTerminal />} 
        />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <MainApp user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
};

const MainApp = ({ user, onLogout }) => {
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
          <button
            className={`header-button ${mode === 'servers' ? 'active' : ''}`}
            onClick={() => setMode('servers')}
          >
            Servers
          </button>
        </div>
        <div className="header-title">
          <h1>Container Lab Studio</h1> 
        </div>
        <div className="user-info">
          <div className='user-name'>
            Welcome, {user?.displayName || user?.username}!
          </div>
          <button onClick={onLogout}>Logout</button>
        </div>
      </div>

      {mode === 'containerlab' ? (
        <ContainerLab user={user} onLogout={onLogout} />
      ) : mode === 'act' ? (
        <ACT user={user} onLogout={onLogout} />
      ) : (
        <ClabServers user={user} onLogout={onLogout} />
      )}
    </div>
  );
};

export default App;
