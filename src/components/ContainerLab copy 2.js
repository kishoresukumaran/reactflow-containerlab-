import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  Controls
} from "react-flow-renderer";
import Sidebar from "../Sidebar";
import yaml from "js-yaml";
import { saveAs } from "file-saver";
import "../styles.css";
import ELK from 'elkjs/lib/elk.bundled.js'; // Update elk import
import { Server, Loader2 } from "lucide-react";
import LogModal from './LogModal';
import FileManagerModal from './FileManagerModal';

const elk = new ELK();

const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.spacing.nodeNode': 80,
  'elk.direction': 'RIGHT',
  'elk.spacing.portPort': 30,
};

// Add layout function
const getLayoutedElements = async (nodes, edges) => {
  const graph = {
    id: 'root',
    layoutOptions,
    children: nodes.map((node) => ({
      id: node.id,
      width: 150,
      height: 100,
      ports: node.data.ports || []
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target]
    }))
  };

  const layoutedGraph = await elk.layout(graph);
  return layoutedGraph;
};

let id = 0;
const getId = () => `node_${id++}`;

const DEFAULT_YAML = {};

// Add default YAML constant
// const DEFAULT_YAML = {
//   name: '',
//   topology: {
//     nodes: [],
//     links: []
//   }
// };

// Add YAML to topology converter function
const convertYamlToTopology = (yamlString, existingEdges, existingNodes) => {
  try {
    const parsedYaml = yaml.load(yamlString);
    if (!parsedYaml?.topology?.nodes) return null;

    // Keep track of existing nodes positions
    const existingPositions = {};
    existingNodes.forEach(node => {
      existingPositions[node.id] = node.position;
    });

    const newNodes = [];
    let nodePosition = { x: 100, y: 100 };

    Object.entries(parsedYaml.topology.nodes).forEach(([nodeName, nodeData]) => {
      newNodes.push({
        id: nodeName,
        type: 'default',
        position: existingPositions[nodeName] || { ...nodePosition },
        data: { 
          label: nodeName,
          kind: nodeData.kind
        }
      });
      nodePosition.x += 200;
    });

    return {
      nodes: newNodes,
      edges: existingEdges.filter(edge => 
        newNodes.some(node => node.id === edge.source) && 
        newNodes.some(node => node.id === edge.target)
      )
    };
  } catch (error) {
    console.error('Invalid YAML:', error);
    return null;
  }
};

const App = ({ user }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yamlOutput, setYamlOutput] = useState("");
  const [topologyName, setTopologyName] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNode, setNewNode] = useState(null);
  const [nodeName, setNodeName] = useState("");
  const [nodeBinds, setNodeBinds] = useState([""]);
  const [nodeMgmtIp, setNodeMgmtIp] = useState("");
  const [mgmtNetwork, setMgmtNetwork] = useState("");
  const [ipv4Subnet, setIpv4Subnet] = useState("");
  const [ipv6Subnet, setIpv6Subnet] = useState("");
  const [isYamlValid, setIsYamlValid] = useState(true);
  const [yamlParseError, setYamlParseError] = useState('');
  const [kinds, setKinds] = useState([{
    name: '',
    config: {
      showStartupConfig: false,
      startupConfig: '',
      showImage: false,
      image: '',
      showExec: false,
      exec: [''],
      showBinds: false,
      binds: ['']
    }
  }]);
  const [defaultKind, setDefaultKind] = useState("");
  const [showMgmt, setShowMgmt] = useState(false);
  const [showKind, setShowKind] = useState(false);
  const [kindName, setKindName] = useState("");
  const [showIpv6, setShowIpv6] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showKindConfig, setShowKindConfig] = useState(false);
  const [showDefault, setShowDefault] = useState(false);
  const [showKindModal, setShowKindModal] = useState(false);
  const [currentKindIndex, setCurrentKindIndex] = useState(0);
  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState(false);
  const [newEdgeData, setNewEdgeData] = useState(null);
  const [sourceInterface, setSourceInterface] = useState("");
  const [targetInterface, setTargetInterface] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [nodeKind, setNodeKind] = useState("");
  const [nodeImage, setNodeImage] = useState("");
  const [nodeModalWarning, setNodeModalWarning] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [isModifyingEdge, setIsModifyingEdge] = useState(false);
  const [edgeModalWarning, setEdgeModalWarning] = useState(false);
  const [mode, setMode] = useState('containerlab'); // Add mode state
  const [reactFlowInstance, setReactFlowInstance] = useState(null); // Add ReactFlow instance state
  const [editableYaml, setEditableYaml] = useState(yamlOutput); // Add new state
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [deployLoading, setDeployLoading] = useState({});
  const [showLogModal, setShowLogModal] = useState(false);
  const [operationLogs, setOperationLogs] = useState('');
  const [operationTitle, setOperationTitle] = useState('');
  const [showSshPortForwarding, setShowSshPortForwarding] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedSshServer, setSelectedSshServer] = useState('');
  const [freePorts, setFreePorts] = useState([]);
  const [isLoadingPorts, setIsLoadingPorts] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Add this near your other state declarations
  const imageOptions = [
    { value: "ceos:4.31.4M", label: "cEOS 4.31.4M" },
    { value: "ceos:4.32.2F", label: "cEOS 4.32.2F" },
    { value: "alpine", label: "Linux Host" }
  ];

  // Add this near your other state declarations and imageOptions
  const kindOptions = [
    { value: "ceos", label: "cEOS" },
    { value: "linux", label: "Linux" },
  ];

  // Add server options constant
  const serverOptions = [
    { value: "10.83.12.71", label: "10.83.12.71" },
    { value: "10.83.12.72", label: "10.83.12.72" },
    { value: "10.83.12.73", label: "10.83.12.73" }
  ];

  const handleModeChange = (newMode) => {
    setMode(newMode);
    // Reset states when switching modes
    setNodes([]);
    setEdges([]);
    setYamlOutput('');
  };

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
        setNodeName("");
        setNodeBinds([""]);
        setNodeMgmtIp("");
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  // Add useEffect for management section updates
  useEffect(() => {
    if (showMgmt) {
      updateYaml(nodes, edges);
    }
  }, [mgmtNetwork, ipv4Subnet, ipv6Subnet]);

  // Add useEffect for default kind updates
  useEffect(() => {
    if (showDefault && defaultKind) {
      updateYaml(nodes, edges);
    }
  }, [defaultKind]);

  // Add useEffect for kinds state changes
  useEffect(() => {
    if (showKind) {
      updateYaml(nodes, edges);
    }
  }, [showKind, kinds]);

  // Add useEffects to watch checkbox states
  useEffect(() => {
    updateYaml(nodes, edges);
  }, [showMgmt, showKind, showDefault]);

  // Update onConnect handler to handle multiple edges
  const onConnect = useCallback((params) => {
    const sourceNode = nodes.find(node => node.id === params.source);
    const targetNode = nodes.find(node => node.id === params.target);
    
    const edgeParams = {
      ...params,
      // Remove type: 'straight' to use default curved edges
      sourceNodeName: sourceNode.data.label,
      targetNodeName: targetNode.data.label
    };
    
    setNewEdgeData(edgeParams);
    setIsEdgeModalOpen(true);
  }, [nodes, edges]);

  // Add validation function
  const validateTopologyName = () => {
    if (!topologyName.trim()) {
      setShowWarning(true);
      return false;
    }
    return true;
  };

  // Update onDrop callback
  const onDrop = useCallback(
    (event) => {
      if (!validateTopologyName()) {
        event.preventDefault();
        return;
      }
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData("application/reactflow");

      if (!type) return;

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode = {
        id: getId(),
        position,
        data: { label: `${type} node` }
      };

      setNewNode(newNode);
      setIsModalOpen(true);
    },
    [nodes, edges, topologyName]
  );

  // Allow dragging over the canvas
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle element removal
  const onElementsRemove = useCallback(
    (elementsToRemove) => {
      const nodeChanges = elementsToRemove.filter((el) => el.id.startsWith('node_')).map((node) => ({ id: node.id, type: 'remove' }));
      const edgeChanges = elementsToRemove.filter((el) => el.id.startsWith('edge_')).map((edge) => ({ id: edge.id, type: 'remove' }));
      const updatedNodes = applyNodeChanges(nodeChanges, nodes);
      const updatedEdges = applyEdgeChanges(edgeChanges, edges);
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      updateYaml(updatedNodes, updatedEdges);
    },
    [nodes, edges]
  );

  const updateYaml = (updatedNodes, updatedEdges) => {
    // Check if all inputs are empty
    const isEmpty =
      !topologyName.trim() &&
      updatedNodes.length === 0 &&
      updatedEdges.length === 0 &&
      !showMgmt &&
      !showKind &&
      !showDefault;
  
    if (isEmpty) {
      setYamlOutput('');
      setEditableYaml(''); // Update editable YAML state
      return;
    }
  
    // Start building the YAML data
    const yamlData = {};
  
    if (topologyName.trim()) {
      yamlData.name = `${user?.username || ''}-${topologyName}`; // Use optional chaining
    }
  
    if (updatedNodes.length > 0) {
      yamlData.topology = yamlData.topology || {};
      yamlData.topology.nodes = updatedNodes.reduce((acc, node) => {
        const nodeConfig = {};
        if (node.data.kind?.trim()) nodeConfig.kind = node.data.kind;
        if (node.data.image?.trim()) nodeConfig.image = node.data.image;
        if (node.data.binds?.some(bind => bind.trim())) {
          nodeConfig.binds = node.data.binds.filter(bind => bind.trim());
        }
        if (node.data.mgmtIp?.trim()) nodeConfig['mgmt-ipv4'] = node.data.mgmtIp;
  
        acc[node.data.label] = nodeConfig;
        return acc;
      }, {});
    }
  
    if (updatedEdges.length > 0) {
      yamlData.topology = yamlData.topology || {};
      yamlData.topology.links = updatedEdges.map((edge) => ({
        endpoints: [
          `${updatedNodes.find(n => n.id === edge.source).data.label}:${edge.data.sourceInterface}`,
          `${updatedNodes.find(n => n.id === edge.target).data.label}:${edge.data.targetInterface}`
        ]
      }));
    }
  
    if (showMgmt) {
      yamlData.mgmt = {
        network: mgmtNetwork,
        "ipv4-subnet": ipv4Subnet,
        ...(showIpv6 && ipv6Subnet && { "ipv6-subnet": ipv6Subnet })
      };
    }
  
    if (showKind && kinds.length > 0) {
      yamlData.topology = yamlData.topology || {};
      yamlData.topology.kinds = kinds.reduce((acc, kind) => {
        if (kind.name) {
          acc[kind.name] = {
            ...(kind.config.showStartupConfig && { 'startup-config': kind.config.startupConfig }),
            ...(kind.config.showImage && { image: kind.config.image }),
            ...(kind.config.showExec && { exec: kind.config.exec.filter(e => e) }),
            ...(kind.config.showBinds && { binds: kind.config.binds.filter(b => b) })
          };
        }
        return acc;
      }, {});
    }
  
    if (showDefault && defaultKind.trim()) {
      yamlData.topology = yamlData.topology || {};
      yamlData.topology.defaults = { kind: defaultKind };
    }
  
    // Generate and set the YAML output
    const generatedYaml = yaml.dump(yamlData);
    setYamlOutput(generatedYaml);
    setEditableYaml(generatedYaml); // Update editable YAML state
  };
  
  // Update handleTopologyNameChange function
  const handleTopologyNameChange = (event) => {
    const newTopologyName = event.target.value;
    setTopologyName(newTopologyName);
    
    // Create new YAML data with updated topology name
    const yamlData = {
      name: `${user?.username || ''}-${newTopologyName}`, // Use optional chaining
      topology: {
        nodes: nodes.reduce((acc, node) => {
          const nodeConfig = {};
          if (node.data.kind?.trim()) nodeConfig.kind = node.data.kind;
          if (node.data.image?.trim()) nodeConfig.image = node.data.image;
          if (node.data.binds?.some(bind => bind.trim())) {
            nodeConfig.binds = node.data.binds.filter(bind => bind.trim());
          }
          if (node.data.mgmtIp?.trim()) nodeConfig['mgmt-ipv4'] = node.data.mgmtIp;
          
          acc[node.data.label] = nodeConfig;
          return acc;
        }, {}),
        links: edges.map((edge) => ({
          endpoints: [
            `${nodes.find(n => n.id === edge.source).data.label}:${edge.data.sourceInterface}`,
            `${nodes.find(n => n.id === edge.target).data.label}:${edge.data.targetInterface}`
          ]
        }))
      }
    };

    // Add management section if enabled
    if (showMgmt) {
      yamlData.mgmt = {
        network: mgmtNetwork,
        "ipv4-subnet": ipv4Subnet,
        ...(showIpv6 && ipv6Subnet && { "ipv6-subnet": ipv6Subnet })
      };
    }

    // Add kinds section if enabled
    if (showKind && kinds.length > 0) {
      yamlData.topology = yamlData.topology || {};
      yamlData.topology.kinds = kinds.reduce((acc, kind) => {
        if (kind.name) {
          acc[kind.name] = {
            ...(kind.config.showStartupConfig && { 'startup-config': kind.config.startupConfig }),
            ...(kind.config.showImage && { image: kind.config.image }),
            ...(kind.config.showExec && { exec: kind.config.exec.filter(e => e) }),
            ...(kind.config.showBinds && { binds: kind.config.binds.filter(b => b) })
          };
        }
        return acc;
      }, {});
    }

    // Add defaults section if enabled
    if (showDefault && defaultKind.trim()) {
      yamlData.topology = yamlData.topology || {};
      yamlData.topology.defaults = { kind: defaultKind };
    }

    // Generate and update both YAML states
    const generatedYaml = yaml.dump(yamlData);
    setYamlOutput(generatedYaml);
    setEditableYaml(generatedYaml);
  };

  // Handle management inputs change
  const handleMgmtNetworkChange = (event) => {
    const newValue = event.target.value;
    setMgmtNetwork(newValue);
  };

  const handleIpv4SubnetChange = (event) => {
    const newValue = event.target.value;
    setIpv4Subnet(newValue);
  };

  const handleIpv6SubnetChange = (event) => {
    const newValue = event.target.value;
    setIpv6Subnet(newValue);
  };

  // Add handler for configure button
  const handleConfigureKind = () => {
    setShowKindModal(true);
  };

  // Handle default kind change
  const handleDefaultKindChange = (event) => {
    const newValue = event.target.value;
    setDefaultKind(newValue);
  };

  const handleKindNameChange = (index, value) => {
    const newKinds = [...kinds];
    newKinds[index].name = value;
    setKinds(newKinds);
    updateYaml(nodes, edges);
  };

  const handleKindConfigChange = (kindIndex, field, value) => {
    const newKinds = [...kinds];
    newKinds[kindIndex].config[field] = value;
    setKinds(newKinds);
    updateYaml(nodes, edges);
  };

  const handleAddKind = () => {
    const newKind = {
      name: kindName,
      config: {
        showStartupConfig: false,
        startupConfig: '',
        showImage: false,
        image: '',
        showExec: false,
        exec: [''],
        showBinds: false,
        binds: ['']
      }
    };
    setKinds([...kinds, newKind]);
    setKindName('');
    updateYaml(nodes, edges);
  };

  const handleAddExec = () => {
    setKinds(prevKinds => {
      const newKinds = [...prevKinds];
      newKinds[currentKindIndex].config.exec.push("");
      return newKinds;
    });
  };

  const handleAddBind = () => {
    setNodeBinds([...nodeBinds, ""]);
  };

  // Handle node name change
  const handleNodeNameChange = (event) => {
    setNodeName(event.target.value);
  };

  // Handle node binds change
  const handleNodeBindsChange = (index, event) => {
    const newBinds = [...nodeBinds];
    newBinds[index] = event.target.value;
    setNodeBinds(newBinds);
  };

  // Handle adding a new bind input
  const handleAddBindNode = () => {
    setNodeBinds([...nodeBinds, ""]);
  };

  // Handle node management IP change
  const handleNodeMgmtIpChange = (event) => {
    setNodeMgmtIp(event.target.value);
  };

  // Add handlers
  const handleNodeKindChange = (event) => {
    setNodeKind(event.target.value);
  };

  const handleNodeImageChange = (event) => {
    setNodeImage(event.target.value);
  };

  // Handle modal submit
  const handleModalSubmit = () => {
    if (!nodeName.trim() || !nodeKind.trim()) {
      setNodeModalWarning(true);
      return;
    }

    const newNodeWithData = {
      ...newNode,
      data: {
        ...newNode.data,
        label: nodeName,
        kind: nodeKind,
        image: nodeImage,
        binds: nodeBinds,
        mgmtIp: nodeMgmtIp,
      },
    };

    if (isModifying) {
      setNodes((nds) => 
        nds.map((node) => 
          node.id === newNode.id ? newNodeWithData : node
        )
      );
      setIsModifying(false);
    } else {
      setNodes((nds) => [...nds, newNodeWithData]);
    }

    updateYaml([...nodes, newNodeWithData], edges);
    setIsModalOpen(false);
    setNodeName("");
    setNodeKind("");
    setNodeImage("");
    setNodeBinds([""]);
    setNodeMgmtIp("");
    setNodeModalWarning(false);
  };

  // Handle modal cancel
  const handleModalCancel = () => {
    setIsModalOpen(false);
    setNodeName("");
    setNodeBinds([""]);
    setNodeMgmtIp("");
  };

  // Define isValidConnection function to allow all connections
  const isValidConnection = () => true;

  // Handle download YAML button click
  const handleDownloadYaml = () => {
    const blob = new Blob([yamlOutput], { type: "text/yaml;charset=utf-8" });
    saveAs(blob, `${topologyName}.yml`);
  };

  // Add the handleDeploy function near your other handlers
  const handleDeploy = () => {
    setIsDeployModalOpen(true);
  };

  const handleServerDeploy = async (serverIp) => {
    try {
      if (!topologyName.trim()) {
        alert("Please enter a topology name before deploying");
        return;
      }

      setDeployLoading(prev => ({ ...prev, [serverIp]: true }));
      setOperationTitle('Deploying Topology');
      setOperationLogs('');
      setIsDeployModalOpen(false); // Close the server selection modal first
      setShowLogModal(true);

      // Create a Blob from the YAML content
      const fileName = `${topologyName}.yaml`;
      const yamlBlob = new Blob([yamlOutput], { type: 'text/yaml;charset=utf-8' });
      const yamlFile = new File([yamlBlob], fileName, { type: 'text/yaml' });

      const formData = new FormData();
      formData.append('file', yamlFile);
      formData.append('serverIp', serverIp);
      formData.append('username', user.username);

      const response = await fetch(`http://${serverIp}:3001/api/containerlab/deploy`, {
        method: 'POST',
        body: formData
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalJsonStr = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        buffer += text;

        // Split by newlines to process each line
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          try {
            // Try to parse as JSON to see if it's the final message
            const parsed = JSON.parse(line);
            finalJsonStr = line;
          } catch {
            // If not JSON, it's a log line
            setOperationLogs(prevLogs => prevLogs + line + '\n');
          }
        }
      }

      // Process any remaining buffer
      if (buffer) {
        try {
          JSON.parse(buffer);
          finalJsonStr = buffer;
        } catch {
          setOperationLogs(prevLogs => prevLogs + buffer + '\n');
        }
      }

      // Parse the final JSON message
      const result = JSON.parse(finalJsonStr);
      
      if (result.success) {
        setTimeout(() => {
          setShowLogModal(true);
          alert('Topology deployed successfully');
        }, 2000);
      } else {
        alert(`Failed to deploy topology: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deploying topology:', error);
      alert(`Error deploying topology: ${error.message}`);
      setShowLogModal(false);
    } finally {
      setDeployLoading(prev => ({ ...prev, [serverIp]: false }));
    }
  };

  // Handle right-click on node to show context menu
  const onNodeContextMenu = (event, node) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      element: node,
      type: 'node',
    });
  };

  // Handle right-click on edge to show context menu
  const onEdgeContextMenu = (event, edge) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      element: edge,
      type: 'edge',
    });
  };

  // Handle context menu close
  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  // Handle node removal from context menu
  const handleRemoveNode = () => {
    const nodeToRemove = contextMenu.element;
    const updatedNodes = nodes.filter((n) => n.id !== nodeToRemove.id);
    const updatedEdges = edges.filter((e) => e.source !== nodeToRemove.id && e.target !== nodeToRemove.id);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    updateYaml(updatedNodes, updatedEdges);
    handleContextMenuClose();
  };

  // Handle edge removal from context menu
  const handleRemoveEdge = () => {
    const edgeToRemove = contextMenu.element;
    const updatedEdges = edges.filter((e) => e.id !== edgeToRemove.id);
    setEdges(updatedEdges);
    updateYaml(nodes, updatedEdges);
    handleContextMenuClose();
  };

  // Update reset handler to include YAML reset
  const handleReset = () => {
    // Reset all state
    setTopologyName("");
    setShowMgmt(false);
    setMgmtNetwork("");
    setIpv4Subnet("");
    setShowIpv6(false);
    setIpv6Subnet("");
    setShowKind(false);
    setKinds([{
      name: '',
      config: {
        showStartupConfig: false,
        startupConfig: '',
        showImage: false,
        image: '',
        showExec: false,
        exec: [''],
        showBinds: false,
        binds: ['']
      }
    }]);
    setShowDefault(false);
    setDefaultKind("");
    
    // Reset nodes and edges
    setNodes([]);
    setEdges([]);
    
    // Reset YAML
    setYamlOutput("");
    setEditableYaml("");
    setIsYamlValid(true);
    setYamlParseError("");
  };

  // Update handleEdgeModalSubmit function
  const handleEdgeModalSubmit = () => {
    if (!sourceInterface.trim() || !targetInterface.trim()) {
      setEdgeModalWarning(true);
      return;
    }
  
    // Generate a unique ID for the edge that includes interfaces
    const edgeId = isModifyingEdge 
      ? newEdgeData.id 
      : `edge_${newEdgeData.source}_${newEdgeData.target}_${sourceInterface}_${targetInterface}`;
  
    const newEdge = {
      ...newEdgeData,
      id: edgeId,
      data: {
        sourceInterface,
        targetInterface
      }
    };
  
    if (isModifyingEdge) {
      setEdges((eds) => {
        const updatedEdges = eds.map((edge) => 
          edge.id === newEdge.id ? newEdge : edge
        );
        updateYaml(nodes, updatedEdges);
        return updatedEdges;
      });
      setIsModifyingEdge(false);
    } else {
      // Check if this exact edge (same source, target, and interfaces) already exists
      setEdges((eds) => {
        // Check for duplicate edge with same interfaces
        const duplicateEdge = eds.find(edge => 
          edge.source === newEdge.source && 
          edge.target === newEdge.target &&
          edge.data.sourceInterface === sourceInterface &&
          edge.data.targetInterface === targetInterface
        );
        
        if (duplicateEdge) {
          // If a duplicate is found, don't add it
          console.log("Duplicate edge not added:", newEdge);
          return eds;
        }
        
        // Otherwise add the new edge
        const updatedEdges = [...eds, newEdge];
        updateYaml(nodes, updatedEdges);
        return updatedEdges;
      });
    }
  
    setIsEdgeModalOpen(false);
    setSourceInterface("");
    setTargetInterface("");
    setNewEdgeData(null);
    setEdgeModalWarning(false);
  };

  // Update checkbox handlers
  const handleCheckboxChange = (setter, checked) => {
    if (!validateTopologyName()) {
      return;
    }
    setter(checked);
    updateYaml(nodes, edges);
  };

  // Add handleMgmtCheckbox function
  const handleMgmtCheckbox = (e) => {
    if (!validateTopologyName()) {
      return;
    }
    setShowMgmt(e.target.checked);
    // Reset management values when unchecked
    if (!e.target.checked) {
      setMgmtNetwork('');
      setIpv4Subnet('');
      setIpv6Subnet('');
      setShowIpv6(false);
    }
    updateYaml(nodes, edges);
  };

  // Update checkbox handlers
  const handleKindCheckbox = (e) => {
    if (!validateTopologyName()) {
      return;
    }
    setShowKind(e.target.checked);
    // Reset kinds when unchecked
    if (!e.target.checked) {
      setKinds([{
        name: '',
        config: {
          showStartupConfig: false,
          startupConfig: '',
          showImage: false,
          image: '',
          showExec: false,
          exec: [''],
          showBinds: false,
          binds: ['']
        }
      }]);
    }
    updateYaml(nodes, edges);
  };

  const handleDefaultCheckbox = (e) => {
    if (!validateTopologyName()) {
      return;
    }
    setShowDefault(e.target.checked);
    // Reset default kind when unchecked
    if (!e.target.checked) {
      setDefaultKind('');
    }
    updateYaml(nodes, edges);
  };

  // Add handler for IPv6 checkbox
  const handleIpv6Checkbox = (e) => {
    setShowIpv6(e.target.checked);
    updateYaml(nodes, edges);
  };

  // Add handler for modify action
  const handleModifyNode = () => {
    const nodeToModify = contextMenu.element;
    setNodeName(nodeToModify.data.label);
    setNodeKind(nodeToModify.data.kind || "");
    setNodeImage(nodeToModify.data.image || "");
    setNodeBinds(nodeToModify.data.binds || [""]);
    setNodeMgmtIp(nodeToModify.data.mgmtIp || "");
    setNewNode(nodeToModify);
    setIsModifying(true);
    setIsModalOpen(true);
    setContextMenu(null);
  };

  // Add handler for modify edge
  const handleModifyEdge = () => {
    const edgeToModify = contextMenu.element;
    setSourceInterface(edgeToModify.data.sourceInterface || "");
    setTargetInterface(edgeToModify.data.targetInterface || "");
    setNewEdgeData({
      ...edgeToModify,
      sourceNodeName: nodes.find(n => n.id === edgeToModify.source).data.label,
      targetNodeName: nodes.find(n => n.id === edgeToModify.target).data.label
    });
    setIsEdgeModalOpen(true);
    setIsModifyingEdge(true);
    setContextMenu(null);
  };

  // Add new handler for kind binds
  const handleAddKindBind = () => {
    const newKinds = [...kinds];
    newKinds[currentKindIndex].config.binds.push('');
    setKinds(newKinds);
  };

  // Add handleKindModalDone function
  const handleKindModalDone = () => {
    setShowKindModal(false);
    updateYaml(nodes, edges);
  };

  const handleYamlChange = (event) => {
    const newYaml = event.target.value;
    setEditableYaml(newYaml);
  
    try {
      // Parse the YAML input
      const parsedYaml = yaml.load(newYaml);
  
      // Validate and update nodes and edges based on parsed YAML
      if (parsedYaml?.topology?.nodes) {
        const newNodes = Object.entries(parsedYaml.topology.nodes).map(([nodeName, nodeData], index) => ({
          id: nodeName,
          type: 'default',
          position: { x: 100 + (index % 3) * 200, y: 100 + Math.floor(index / 3) * 150 }, // Grid layout
          data: {
            label: nodeName,
            kind: nodeData.kind || '',
            image: nodeData.image || '',
            binds: nodeData.binds || [],
            mgmtIp: nodeData['mgmt-ipv4'] || ''
          }
        }));
  
        const newEdges = (parsedYaml.topology.links || []).map((link, index) => {
          const [source, sourceInterface] = link.endpoints[0].split(':');
          const [target, targetInterface] = link.endpoints[1].split(':');
  
          return {
            id: `edge_${index}`,
            source,
            target,
            data: {
              sourceInterface,
              targetInterface
            }
          };
        });
  
        // Update state with new nodes and edges
        setNodes(newNodes);
        setEdges(newEdges);
        setIsYamlValid(true);
        setYamlParseError('');
      } else {
        throw new Error('Invalid YAML structure');
      }
    } catch (error) {
      console.error('Failed to parse YAML:', error);
      setIsYamlValid(false);
      setYamlParseError(`Error parsing YAML: ${error.message}`);
    }
  };

  // Update the handler to check for nodes
  const handleSshPortForwardingCheckbox = (e) => {
    if (!validateTopologyName()) {
      return;
    }

    // Check if there are any nodes in the topology
    const hasNodes = nodes.length > 0;

    if (!hasNodes && e.target.checked) {
      setErrorMessage('There are no nodes in the topology. Please create nodes first.');
      setShowErrorModal(true);
      return;
    }

    setShowSshPortForwarding(e.target.checked);
    updateYaml(nodes, edges);
  };

  // Add handler for server selection
  const handleSshServerChange = (e) => {
    setSelectedSshServer(e.target.value);
  };

  // Update the submit handler
  const handleSshPortForwardingSubmit = async () => {
    try {
      setIsLoadingPorts(true);
      const response = await fetch(`http://${selectedSshServer}:3001/api/ports/free?serverIp=${selectedSshServer}`);
      const data = await response.json();
      
      if (data.success && data.freePorts.length > 0) {
        setFreePorts(data.freePorts);
        
        // Update YAML with port mappings
        const updatedYaml = yaml.load(yamlOutput);
        let portIndex = 0;
        
        // Add ports to each node
        Object.keys(updatedYaml.topology.nodes).forEach(nodeName => {
          if (portIndex < data.freePorts.length) {
            const node = updatedYaml.topology.nodes[nodeName];
            node.ports = [`${data.freePorts[portIndex]}:22/tcp`];
            portIndex++;
          }
        });
        
        // Update the YAML output
        const newYamlOutput = yaml.dump(updatedYaml);
        setYamlOutput(newYamlOutput);
        setEditableYaml(newYamlOutput);
        
        // Show success message
        setOperationTitle('SSH Port Forwarding');
        setOperationLogs('Successfully added SSH port forwarding to all nodes');
        setShowLogModal(true);
      } else {
        throw new Error('No free ports available');
      }
    } catch (error) {
      setErrorMessage(`Failed to get free ports: ${error.message}`);
      setShowErrorModal(true);
    } finally {
      setIsLoadingPorts(false);
    }
  };
  
  // Update the handleImport function
  const handleImport = () => {
    setShowImportModal(true);
  };

  // Add this new function to handle the imported content
  const handleImportedContent = (content) => {
    console.log(content);
    setEditableYaml(content);
    setYamlOutput(content);
    handleYamlChange({ target: { value: content } });
  };

  return (
    <ReactFlowProvider>
      <div className="app">
        <div className="dndflow">
          {mode === 'containerlab' ? (
            // Existing ContainerLab Layout
            <>
              <div className="node-panel">
                <Sidebar />
                <div className="input-group">
                  <label>Name of the topology:</label>
                  <input
                    type="text"
                    value={topologyName}
                    onChange={handleTopologyNameChange}
                  />
                </div>

                <h3 className="settings-heading">
                  Global Settings
                  <span className="info-icon">ⓘ</span>
                </h3>

                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={showMgmt}
                      onChange={handleMgmtCheckbox}
                    />
                    Add Management
                  </label>
                </div>

                {showMgmt && (
                  <div className="management-section">
                    <div className="input-group">
                      <label>Network:</label>
                      <input
                        type="text"
                        value={mgmtNetwork}
                        onChange={(e) => setMgmtNetwork(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label>IPv4 Subnet:</label>
                      <input
                        type="text"
                        value={ipv4Subnet}
                        onChange={(e) => setIpv4Subnet(e.target.value)}
                      />
                    </div>
                    <div className="checkbox-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={showIpv6}
                          onChange={(e) => setShowIpv6(e.target.checked)}
                        />
                        Add IPv6 Subnet
                      </label>
                    </div>
                    {showIpv6 && (
                      <div className="input-group">
                        <label>IPv6 Subnet:</label>
                        <input
                          type="text"
                          value={ipv6Subnet}
                          onChange={(e) => setIpv6Subnet(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={showKind}
                      onChange={handleKindCheckbox}
                    />
                    Add Kinds
                  </label>
                </div>
                {showKind && (
                  <div className="kinds-section">
                    {kinds.map((kind, index) => (
                      <div key={index} className="kind-input-group">
                        <label htmlFor={`kind-name-${index}`}>Kind Name</label>
                        <select
                          id={`kind-name-${index}`}
                          value={kind.name}
                          onChange={(e) => handleKindNameChange(index, e.target.value)}
                        >
                          <option value="">Select a kind</option>
                          {kindOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button onClick={() => {
                          setShowKindModal(true);
                          setCurrentKindIndex(index);
                        }}>Configure</button>
                      </div>
                    ))}
                    <button onClick={handleAddKind}>Add More Kinds</button>
                  </div>
                )}
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={showDefault}
                      onChange={handleDefaultCheckbox}
                    />
                    Add Default
                  </label>
                </div>
                {showDefault && (
                  <div className="default-input-group">
                    <label htmlFor="default-kind">Default Kind:</label>
                    <select
                      id="default-kind"
                      value={defaultKind}
                      onChange={handleDefaultKindChange}
                      className="image-select"
                    >
                      <option value="">Select a kind</option>
                      {kindOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={showSshPortForwarding}
                      onChange={handleSshPortForwardingCheckbox}
                    />
                    Add SSH Port Forwarding
                  </label>
                </div>
                {showSshPortForwarding && (
                  <div className="ssh-forwarding-section">
                    <div className="input-group">
                      <label>Select Server:</label>
                      <select
                        value={selectedSshServer}
                        onChange={handleSshServerChange}
                        className="image-select"
                      >
                        <option value="">Select a server</option>
                        {serverOptions.map((server) => (
                          <option key={server.value} value={server.value}>
                            {server.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button 
                      className="submit-button"
                      onClick={handleSshPortForwardingSubmit}
                      disabled={!selectedSshServer || isLoadingPorts}
                    >
                      {isLoadingPorts ? 'Loading Ports...' : 'Submit'}
                    </button>
                  </div>
                )}
                <button className="reset-button" onClick={handleReset}>
                  Reset All Fields
                </button>
              </div>
              <div
                className="reactflow-wrapper"
                ref={reactFlowWrapper}
                onDrop={onDrop}
                onDragOver={onDragOver}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onElementsRemove={onElementsRemove}
                  isValidConnection={isValidConnection}
                  fitView
                  onNodeContextMenu={onNodeContextMenu}
                  onEdgeContextMenu={onEdgeContextMenu}
                  connectionMode={ConnectionMode.LOOSE}
                />
              </div>
              <div className="yaml-output">
              <h3>YAML Editor</h3>
                <textarea 
                  value={editableYaml} 
                  onChange={handleYamlChange}
                  spellCheck="false"
                />
                <div className="button-group">
                  <button onClick={handleDownloadYaml} disabled={!yamlOutput.trim()}>Download YAML</button>
                  <button className="deploy-button" onClick={handleDeploy} disabled={!yamlOutput.trim()}>Deploy</button>
                  <button onClick={handleImport}>Import</button>
                </div>
              </div>
            </>
          ) : (
            // ACT Layout
            <>
              <div className="yaml-output">
                <h3>YAML Output</h3>
                <pre>{yamlOutput}</pre>
              </div>
            </>
          )}
        </div>
        {isModalOpen && (
          <div className="modal">
            <div className="modal-content">
              <h2>Enter Node Details</h2>
              <div className="form-content">
                {nodeModalWarning && (
                  <div className="warning-message">
                    Node Name and Kind are required fields
                  </div>
                )}
                <div className="input-group">
                  <label>Name of the node: *</label>
                  <input
                    type="text"
                    value={nodeName}
                    placeholder="e.g., spine1"
                    onChange={handleNodeNameChange}
                    className={nodeModalWarning && !nodeName.trim() ? 'input-error' : ''}
                  />
                </div>
                <div className="input-group">
                  <label>Kind: *</label>
                  <select
                    value={nodeKind}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setNodeKind(newValue);
                      handleNodeKindChange({ target: { value: newValue } });
                    }}
                    className={`image-select ${nodeModalWarning && !nodeKind.trim() ? 'input-error' : ''}`}
                  >
                    <option value="">Select a kind</option>
                    {kindOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Image:</label>
                  <select
                    value={nodeImage}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setNodeImage(newValue);
                      handleNodeImageChange({ target: { value: newValue } });
                    }}
                    className="image-select"
                  >
                    <option value="">Select an image</option>
                    {imageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Binds:</label>
                  {nodeBinds.map((bind, index) => (
                    <input
                      key={index}
                      type="text"
                      value={bind}
                      onChange={(e) => {
                        const newBinds = [...nodeBinds];
                        newBinds[index] = e.target.value;
                        setNodeBinds(newBinds);
                      }}
                      placeholder="Enter bind path"
                    />
                  ))}
                  <button type="button" onClick={handleAddBind}>Add Bind</button>
                </div>
                <div className="input-group">
                  <label>Management IP:</label>
                  <input
                    type="text"
                    value={nodeMgmtIp}
                    onChange={handleNodeMgmtIpChange}
                  />
                </div>
              </div>
              <div className="actions">
                <button onClick={handleModalSubmit}>Submit</button>
                <button onClick={handleModalCancel}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {showKindModal && (
          <div className="modal">
            <div className="modal-content kind-config-modal">
              <h2>Configure Kind: {kinds[currentKindIndex].name}</h2>
              
              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showStartupConfig}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showStartupConfig', e.target.checked)}
                  />
                  Startup Config
                </label>
                {kinds[currentKindIndex].config.showStartupConfig && (
                  <input
                    type="text"
                    value={kinds[currentKindIndex].config.startupConfig}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'startupConfig', e.target.value)}
                    placeholder="Enter startup config path"
                  />
                )}
              </div>

              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showImage}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showImage', e.target.checked)}
                  />
                  Image
                </label>
                {kinds[currentKindIndex].config.showImage && (
                  <select
                    value={kinds[currentKindIndex].config.image}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'image', e.target.value)}
                    className="image-select"
                  >
                    <option value="">Select an image</option>
                    {imageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showExec}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showExec', e.target.checked)}
                  />
                  Exec Commands
                </label>
                {kinds[currentKindIndex].config.showExec && (
                  <div className="exec-commands">
                    {kinds[currentKindIndex].config.exec.map((cmd, index) => (
                      <input
                        key={index}
                        type="text"
                        value={cmd}
                        onChange={(e) => {
                          const newExec = [...kinds[currentKindIndex].config.exec];
                          newExec[index] = e.target.value;
                          handleKindConfigChange(currentKindIndex, 'exec', newExec);
                        }}
                        placeholder="Enter exec command"
                      />
                    ))}
                    <button onClick={handleAddExec}>Add Exec Command</button>
                  </div>
                )}
              </div>

              <div className="kind-config-item">
                <label>
                  <input
                    type="checkbox"
                    checked={kinds[currentKindIndex].config.showBinds}
                    onChange={(e) => handleKindConfigChange(currentKindIndex, 'showBinds', e.target.checked)}
                  />
                  Binds
                </label>
                {kinds[currentKindIndex].config.showBinds && (
                  <div className="binds">
                    {kinds[currentKindIndex].config.binds.map((bind, index) => (
                      <input
                        key={index}
                        type="text"
                        value={bind}
                        onChange={(e) => {
                          const newBinds = [...kinds[currentKindIndex].config.binds];
                          newBinds[index] = e.target.value;
                          handleKindConfigChange(currentKindIndex, 'binds', newBinds);
                        }}
                        placeholder="Enter bind path"
                      />
                    ))}
                    <button onClick={handleAddKindBind}>Add Bind</button>
                  </div>
                )}
              </div>

              <div className="actions">
                <button onClick={() => setShowKindModal(false)}>Cancel</button>
                <button onClick={handleKindModalDone}>Done</button>
              </div>
            </div>
          </div>
        )}
        {contextMenu && (
          <div
            className="context-menu"
            style={{
              position: 'absolute',
              top: contextMenu.mouseY,
              left: contextMenu.mouseX,
              backgroundColor: 'white',
              boxShadow: '0px 0px 5px rgba(0,0,0,0.3)',
              zIndex: 1000,
            }}
          >
            {contextMenu.type === 'node' && (
              <>
                <button onClick={handleModifyNode}>Modify</button>
                <button onClick={handleRemoveNode}>Remove Node</button>
                <button onClick={handleContextMenuClose}>Cancel</button>
              </>
            )}
            {contextMenu.type === 'edge' && (
              <>
                <button onClick={handleModifyEdge}>Modify</button>
                <button onClick={handleRemoveEdge}>Remove Edge</button>
                <button onClick={handleContextMenuClose}>Cancel</button>
              </>
            )}
          </div>
        )}
        {isEdgeModalOpen && (
          <div className="modal">
            <div className="modal-content">
              <h2>Configure Link Interfaces</h2>
              {edgeModalWarning && (
                <div className="warning-message">
                  Please enter both source and target interface details
                </div>
              )}
              <div className="input-group">
                <label>{newEdgeData.sourceNodeName} Interface:</label>
                <input
                  type="text"
                  value={sourceInterface}
                  onChange={(e) => setSourceInterface(e.target.value)}
                  className={edgeModalWarning && !sourceInterface.trim() ? 'input-error' : ''}
                />
              </div>
              <div className="input-group">
                <label>{newEdgeData.targetNodeName} Interface:</label>
                <input
                  type="text"
                  value={targetInterface}
                  onChange={(e) => setTargetInterface(e.target.value)}
                  className={edgeModalWarning && !targetInterface.trim() ? 'input-error' : ''}
                />
              </div>
              <div className="actions">
                <button onClick={handleEdgeModalSubmit}>Submit</button>
                <button onClick={() => {
                  setIsEdgeModalOpen(false);
                  setSourceInterface("");
                  setTargetInterface("");
                  setNewEdgeData(null);
                  setEdgeModalWarning(false);
                }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {showWarning && (
          <div className="modal warning-modal">
            <div className="modal-content">
              <h3>Warning</h3>
              <p>Please enter the topology name first</p>
              <button onClick={() => setShowWarning(false)}>OK</button>
            </div>
          </div>
        )}
        {isDeployModalOpen && (
          <div className="modal">
            <div className="modal-content" style={{ width: '80%', maxWidth: '800px' }}>
              <h2>Select Server to Deploy</h2>
              <div className="server-list">
                <table className="server-table">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-200 px-4 py-2 text-left">Server Name</th>
                      <th className="border border-gray-200 px-4 py-2 text-left">IP Address</th>
                      <th className="border border-gray-200 px-4 py-2 text-left">Status</th>
                      <th className="border border-gray-200 px-4 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'clab-ire-1', ip: '10.83.12.71', status: 'active' },
                      { name: 'clab-ire-2', ip: '10.83.12.72', status: 'active' },
                      { name: 'clab-ire-3', ip: '10.83.12.73', status: 'active' }
                    ].map((server) => (
                      <tr key={server.name} className="hover:bg-gray-50">
                        <td className="border border-gray-200 px-4 py-2">
                          <div className="server-info">
                            <Server className="server-icon" />
                            <span className="server-name">{server.name}</span>
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-2">{server.ip}</td>
                        <td className="border border-gray-200 px-4 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            server.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {server.status}
                          </span>
                        </td>
                        <td className="border border-gray-200 px-4 py-2">
                          <button 
                            onClick={() => handleServerDeploy(server.ip)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                            disabled={deployLoading[server.ip]}
                          >
                            {deployLoading[server.ip] ? (
                              <div className="flex items-center">
                                <Loader2 className="animate-spin mr-2" size={18} />
                                Deploying...
                              </div>
                            ) : (
                              "Deploy"
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="actions mt-4">
                <button onClick={() => setIsDeployModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        <LogModal
          isOpen={showLogModal}
          onClose={() => setShowLogModal(false)}
          logs={operationLogs}
          title={operationTitle}
        />
        {showErrorModal && (
          <div className="modal warning-modal">
            <div className="modal-content">
              <h3>Error</h3>
              <p>{errorMessage}</p>
              <button onClick={() => setShowErrorModal(false)}>OK</button>
            </div>
          </div>
        )}
        <FileManagerModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImportedContent}
        />
      </div>
    </ReactFlowProvider>
  );
};

export default App;