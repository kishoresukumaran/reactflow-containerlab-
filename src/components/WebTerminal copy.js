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

  // Initialize terminal
  useEffect(() => {
    const initTerminal = async () => {
      try {
        if (!terminal.current) {
          // Create terminal with specific dimensions
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
            cols: 120,
            rows: 30,
            rendererType: 'canvas',
            disableStdin: false,
            windowsMode: true
          });

          // Initialize fit addon
          fitAddon.current = new FitAddon();
          terminal.current.loadAddon(fitAddon.current);

          // Open terminal in container
          if (terminalRef.current) {
            terminal.current.open(terminalRef.current);
            
            // Wait for terminal to be ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (fitAddon.current) {
              fitAddon.current.fit();
              setIsTerminalReady(true);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing terminal:', err);
        setError('Failed to initialize terminal');
      }
    };

    initTerminal();

    return () => {
      try {
        if (terminal.current) {
          terminal.current.dispose();
          terminal.current = null;
        }
      } catch (err) {
        console.error('Error disposing terminal:', err);
      }
    };
  }, []);

  // Handle WebSocket connection
  useEffect(() => {
    const connectWebSocket = async () => {
      if (!ws.current && terminal.current && isTerminalReady && cleanIp) {
        try {
          setIsConnecting(true);
          console.log(`Connecting to WebSocket at ws://${serverIp}:3001/ws/ssh`);
          console.log(`Node details: ${nodeName} (${cleanIp})`);
          
          ws.current = new WebSocket(`ws://${serverIp}:3001/ws/ssh`);
          
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('WebSocket connection timeout'));
            }, 5000);

            ws.current.onopen = () => {
              clearTimeout(timeout);
              console.log('WebSocket connected');
              ws.current.send(JSON.stringify({
                nodeName,
                nodeIp: cleanIp,
                username: 'admin'
              }));
              resolve();
            };

            ws.current.onerror = (error) => {
              clearTimeout(timeout);
              console.error('WebSocket error:', error);
              reject(error);
            };
          });

          ws.current.onmessage = (event) => {
            if (terminal.current) {
              terminal.current.write(event.data);
            }
          };

          ws.current.onclose = () => {
            console.log('WebSocket closed');
            if (terminal.current) {
              terminal.current.writeln('\r\n\x1b[33mSSH session closed\x1b[0m');
            }
          };

          // Handle terminal input
          terminal.current.onData(data => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(data);
            }
          });

        } catch (err) {
          console.error('Error creating WebSocket:', err);
          setError('Failed to connect to SSH session');
        } finally {
          setIsConnecting(false);
        }
      }
    };

    connectWebSocket();

    // Handle window resize
    const handleResize = () => {
      try {
        if (fitAddon.current) {
          fitAddon.current.fit();
        }
      } catch (err) {
        console.error('Error handling resize:', err);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [serverIp, nodeName, cleanIp, isTerminalReady]);

  if (error) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100vh', 
        backgroundColor: '#000000',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '16px'
      }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      backgroundColor: '#000000',
      padding: '20px',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {isConnecting && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#ffffff',
          fontSize: '16px',
          zIndex: 1000
        }}>
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
          position: 'relative'
        }} 
      />
    </div>
  );
};

export default WebTerminal; 