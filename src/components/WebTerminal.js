import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useParams } from 'react-router-dom';
import 'xterm/css/xterm.css';

const WebTerminal = () => {
  const { serverIp, nodeName, nodeIp } = useParams();
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const ws = useRef(null);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  // Clean up IP address by removing CIDR notation
  const cleanIp = nodeIp ? nodeIp.split('/')[0] : '';

  // Initialize terminal with a delay to ensure DOM is ready
  useEffect(() => {
    // Wait for DOM to be fully loaded in the new tab
    const delayInit = setTimeout(() => {
      if (!terminalRef.current) {
        console.error('Terminal reference not found');
        setError('Terminal container not available');
        return;
      }

      try {
        // Create terminal instance
        terminal.current = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: {
            background: '#000000',
            foreground: '#ffffff',
          },
          allowTransparency: true,
          scrollback: 10000,
          // Set explicit dimensions to avoid undefined dimensions issue
          cols: 80,
          rows: 24
        });

        // Initialize FitAddon - important to create this before opening
        fitAddon.current = new FitAddon();
        terminal.current.loadAddon(fitAddon.current);

        // Open terminal in container
        terminal.current.open(terminalRef.current);

        // Delay the fit to ensure terminal is fully rendered
        setTimeout(() => {
          try {
            if (fitAddon.current) {
              fitAddon.current.fit();
              console.log('Terminal fit completed');
              setIsTerminalReady(true);
            }
          } catch (fitErr) {
            console.error('Error fitting terminal:', fitErr);
            setError(`Fit error: ${fitErr.message}`);
          }
        }, 300);
      } catch (err) {
        console.error('Error initializing terminal:', err);
        setError(`Terminal initialization failed: ${err.message}`);
      }
    }, 200); // Delay initialization to ensure DOM is ready

    return () => {
      clearTimeout(delayInit);
      if (terminal.current) {
        try {
          terminal.current.dispose();
        } catch (err) {
          console.error('Error disposing terminal:', err);
        }
        terminal.current = null;
      }
    };
  }, []);

  // Handle WebSocket connection
  useEffect(() => {
    if (!isTerminalReady || !terminal.current || !cleanIp) return;

    let wsConnection = null;
    
    const connectWebSocket = async () => {
      try {
        setIsConnecting(true);
        console.log(`Connecting to WebSocket at ws://${serverIp}:3001/ws/ssh`);
        console.log(`Node details: ${nodeName} (${cleanIp})`);

        wsConnection = new WebSocket(`ws://${serverIp}:3001/ws/ssh`);
        ws.current = wsConnection;

        const connectionTimeout = setTimeout(() => {
          if (wsConnection.readyState !== WebSocket.OPEN) {
            console.error('WebSocket connection timeout');
            setError('Connection timeout. Server may be unreachable.');
            wsConnection.close();
          }
        }, 5000);

        wsConnection.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('WebSocket connected');
          wsConnection.send(
            JSON.stringify({
              nodeName,
              nodeIp: cleanIp,
              username: 'admin',
            })
          );
        };

        wsConnection.onmessage = (event) => {
            console.log('Received message:', event.data);
          if (terminal.current) {
            terminal.current.write(event.data);
          }
        };

        wsConnection.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Connection error. Please check server status.');
        };

        wsConnection.onclose = () => {
          console.log('WebSocket closed');
          if (terminal.current) {
            terminal.current.writeln('\r\n\x1b[33mSSH session closed\x1b[0m');
          }
          setIsConnecting(false);
        };

        // Handle terminal input
        terminal.current.onData((data) => {
          if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
            wsConnection.send(data);
          }
        });
      } catch (err) {
        console.error('Error creating WebSocket:', err);
        setError(`Connection failed: ${err.message}`);
        setIsConnecting(false);
      }
    };

    connectWebSocket();

    // Handle window resize with debouncing
    let resizeTimer = null;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (fitAddon.current && terminal.current) {
          try {
            console.log('Resizing terminal...');
            fitAddon.current.fit();
          } catch (err) {
            console.error('Resize error:', err);
          }
        }
      }, 200);
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      if (wsConnection) {
        wsConnection.close();
      }
      ws.current = null;
    };
  }, [serverIp, nodeName, cleanIp, isTerminalReady]);

  if (error) {
    return (
      <div
        style={{
          width: '100%',
          height: '100vh',
          backgroundColor: '#1e1e1e',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>Error:</span> {error}
        </div>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4a4a4a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        backgroundColor: '#000000',
        padding: '0',
        margin: '0',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isConnecting && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ffffff',
            fontSize: '16px',
            zIndex: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: '12px 20px',
            borderRadius: '4px',
          }}
        >
          Connecting to SSH session...
        </div>
      )}
      <div
        ref={terminalRef}
        style={{
          width: '100%',
          height: '100%',
          opacity: isTerminalReady ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
        }}
      />
    </div>
  );
};

export default WebTerminal;