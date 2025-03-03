import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  Controls
} from "react-flow-renderer";
import Sidebar from "../Sidebar";
import yaml from "js-yaml";
import { saveAs } from "file-saver";
import "../styles.css";
import ELK from 'elkjs/lib/elk.bundled.js';

const ContainerLab = () => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yamlOutput, setYamlOutput] = useState("");
  const [topologyName, setTopologyName] = useState('');
  const [showMgmt, setShowMgmt] = useState(false);
  const [mgmtNetwork, setMgmtNetwork] = useState('');
  const [ipv4Subnet, setIpv4Subnet] = useState('');
  const [showIpv6, setShowIpv6] = useState(false);
  const [ipv6Subnet, setIpv6Subnet] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState('');
  const [nodeImage, setNodeImage] = useState('');
  const [nodeGroup, setNodeGroup] = useState('');
  const [nodePosition, setNodePosition] = useState({ x: 0, y: 0 });
  const [nodeConfig, setNodeConfig] = useState('');
  const [nodeInterfaces, setNodeInterfaces] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [showEdgeModal, setShowEdgeModal] = useState(false);
  const [showYamlModal, setShowYamlModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedYaml, setImportedYaml] = useState('');
  const [elk, setElk] = useState(new ELK());

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const type = event.dataTransfer.getData('application/reactflow');
    const position = {
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    };

    const newNode = {
      id: `node_${nodes.length + 1}`,
      type,
      position,
      data: { label: `${type} node` },
    };

    setNodes((nds) => [...nds, newNode]);
  }, [nodes]);

  const handleTopologyNameChange = (event) => {
    setTopologyName(event.target.value);
  };

  const handleMgmtCheckbox = (e) => {
    setShowMgmt(e.target.checked);
  };

  const handleIpv6Checkbox = (e) => {
    setShowIpv6(e.target.checked);
  };

  const handleNodeNameChange = (e) => {
    setNodeName(e.target.value);
  };

  const handleNodeTypeChange = (e) => {
    setNodeType(e.target.value);
  };

  const handleNodeImageChange = (e) => {
    setNodeImage(e.target.value);
  };

  const handleNodeGroupChange = (e) => {
    setNodeGroup(e.target.value);
  };

  const handleNodeConfigChange = (e) => {
    setNodeConfig(e.target.value);
  };

  const handleNodePositionChange = (e) => {
    const { name, value } = e.target;
    setNodePosition((prevPosition) => ({
      ...prevPosition,
      [name]: parseFloat(value),
    }));
  };

  const handleNodeInterfacesChange = (e, index) => {
    const { name, value } = e.target;
    setNodeInterfaces((prevInterfaces) => {
      const newInterfaces = [...prevInterfaces];
      newInterfaces[index] = {
        ...newInterfaces[index],
        [name]: value,
      };
      return newInterfaces;
    });
  };

  const handleAddInterface = () => {
    setNodeInterfaces((prevInterfaces) => [
      ...prevInterfaces,
      { name: '', type: '', bridge: '' },
    ]);
  };

  const handleRemoveInterface = (index) => {
    setNodeInterfaces((prevInterfaces) => {
      const newInterfaces = [...prevInterfaces];
      newInterfaces.splice(index, 1);
      return newInterfaces;
    });
  };

  const handleSaveNode = () => {
    const updatedNodes = nodes.map((node) => {
      if (node.id === selectedNode.id) {
        return {
          ...node,
          data: {
            ...node.data,
            label: nodeName,
            type: nodeType,
            image: nodeImage,
            group: nodeGroup,
            config: nodeConfig,
            interfaces: nodeInterfaces,
          },
          position: nodePosition,
        };
      }
      return node;
    });
    setNodes(updatedNodes);
    setShowNodeModal(false);
  };

  const handleDeleteNode = () => {
    const updatedNodes = nodes.filter((node) => node.id !== selectedNode.id);
    setNodes(updatedNodes);
    setShowNodeModal(false);
  };

  const handleSaveEdge = () => {
    const updatedEdges = edges.map((edge) => {
      if (edge.id === selectedEdge.id) {
        return {
          ...edge,
          data: {
            ...edge.data,
            label: selectedEdge.data.label,
          },
        };
      }
      return edge;
    });
    setEdges(updatedEdges);
    setShowEdgeModal(false);
  };

  const handleDeleteEdge = () => {
    const updatedEdges = edges.filter((edge) => edge.id !== selectedEdge.id);
    setEdges(updatedEdges);
    setShowEdgeModal(false);
  };

  const handleExportYaml = () => {
    const topology = {
      name: topologyName,
      mgmt_network: showMgmt ? mgmtNetwork : undefined,
      ipv4_subnet: ipv4Subnet,
      ipv6_subnet: showIpv6 ? ipv6Subnet : undefined,
      nodes: nodes.map((node) => ({
        name: node.data.label,
        type: node.data.type,
        image: node.data.image,
        group: node.data.group,
        config: node.data.config,
        interfaces: node.data.interfaces,
        position: node.position,
      })),
      links: edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        label: edge.data.label,
      })),
    };
    const yamlStr = yaml.dump(topology);
    setYamlOutput(yamlStr);
    setShowYamlModal(true);
  };

  const handleImportYaml = () => {
    try {
      const importedTopology = yaml.load(importedYaml);
      setTopologyName(importedTopology.name);
      setShowMgmt(!!importedTopology.mgmt_network);
      setMgmtNetwork(importedTopology.mgmt_network || '');
      setIpv4Subnet(importedTopology.ipv4_subnet);
      setShowIpv6(!!importedTopology.ipv6_subnet);
      setIpv6Subnet(importedTopology.ipv6_subnet || '');
      setNodes(
        importedTopology.nodes.map((node, index) => ({
          id: `node_${index + 1}`,
          type: node.type,
          position: node.position,
          data: {
            label: node.name,
            type: node.type,
            image: node.image,
            group: node.group,
            config: node.config,
            interfaces: node.interfaces,
          },
        }))
      );
      setEdges(
        importedTopology.links.map((link, index) => ({
          id: `edge_${index + 1}`,
          source: link.source,
          target: link.target,
          data: { label: link.label },
        }))
      );
      setShowImportModal(false);
    } catch (error) {
      console.error('Error importing YAML:', error);
    }
  };

  const handleSaveToFile = () => {
    const blob = new Blob([yamlOutput], { type: 'text/yaml;charset=utf-8' });
    saveAs(blob, `${topologyName}.yaml`);
  };

  useEffect(() => {
    const layoutNodes = async () => {
      const graph = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
        },
        children: nodes.map((node) => ({
          id: node.id,
          width: 100,
          height: 50,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      };

      const layout = await elk.layout(graph);
      const updatedNodes = nodes.map((node) => {
        const layoutNode = layout.children.find((n) => n.id === node.id);
        return {
          ...node,
          position: {
            x: layoutNode.x,
            y: layoutNode.y,
          },
        };
      });
      setNodes(updatedNodes);
    };

    layoutNodes();
  }, [nodes, edges, elk]);

  return (
    <ReactFlowProvider>
      <div className="dndflow">
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
          <div className="input-group">
            <label>
              <input
                type="checkbox"
                checked={showMgmt}
                onChange={handleMgmtCheckbox}
              />
              Management Network
            </label>
            {showMgmt && (
              <input
                type="text"
                value={mgmtNetwork}
                onChange={(e) => setMgmtNetwork(e.target.value)}
              />
            )}
          </div>
          <div className="input-group">
            <label>IPv4 Subnet:</label>
            <input
              type="text"
              value={ipv4Subnet}
              onChange={(e) => setIpv4Subnet(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>
              <input
                type="checkbox"
                checked={showIpv6}
                onChange={handleIpv6Checkbox}
              />
              IPv6 Subnet
            </label>
            {showIpv6 && (
              <input
                type="text"
                value={ipv6Subnet}
                onChange={(e) => setIpv6Subnet(e.target.value)}
              />
            )}
          </div>
        </div>
        <div className="reactflow-wrapper" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onDrop={onDrop}
            onDragOver={onDragOver}
            fitView
          >
            <Controls />
          </ReactFlow>
        </div>
        <div className="yaml-output">
          <h3>YAML Output</h3>
          <pre>{yamlOutput}</pre>
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default ContainerLab;