import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ContainerLab from './components/ContainerLab';
import ACT from './components/ACT';
import ClabServers from './components/ClabServers';
import Login from './components/Login';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null); // Add state for user information

  // Handle login and save user info
  const handleLogin = (userInfo) => {
    setIsAuthenticated(true);
    setUser(userInfo); // Save user information (e.g., name or email)
  };

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null); // Clear user information
  };

  return (
    <Router>
      <Routes>
        {/* Login Route */}
        <Route path="/login" element={<Login onLogin={handleLogin} />} />

        {/* Protected Routes */}
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
          <h1>Container Lab Topology Designer</h1> 
        </div>
        {/* Display user info and logout button */}
        <div className="user-info">
          <div className='user-name'>
            <span>Welcome, {user?.name || 'User'}!</span>
          </div>
          <div className='logout-button'>
            <button onClick={onLogout}>Logout</button>
          </div>
        </div>
      </div>

      {/* Render components based on mode */}
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
