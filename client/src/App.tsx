import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { // Change default import to named import
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node as FlowNode, // Rename to avoid conflict with our Node type
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

// Define our Node types (matching server-side models)
interface BaseNode {
    id: string;
    level: number;
    content: string;
    timestamp: string; // Use string for simplicity in frontend
    parentId: string | null;
}
interface LogNode extends BaseNode {
    type: 'log';
}
interface SummaryNode extends BaseNode {
    type: 'summary';
    childIds: string[];
}
type AppNode = LogNode | SummaryNode;

// Backend API and WebSocket URLs
const API_URL = 'http://localhost:52381/logs'; // Make sure this matches your server port
const WS_URL = 'ws://localhost:52381'; // WebSocket URL

// Function to convert our AppNode to React Flow Node
const nodeToFlowNode = (node: AppNode): FlowNode => {
    const isSummary = node.type === 'summary';
    return {
        id: node.id,
        // Position nodes based on level and timestamp (simple layout)
        // This layout is very basic and might need improvement for large graphs
        position: { x: node.level * 250, y: new Date(node.timestamp).getTime() % 800 }, // Example positioning
        data: { label: `${isSummary ? 'Summary L' + node.level : 'Log'}: ${node.content.substring(0, 30)}${node.content.length > 30 ? '...' : ''}` },
        type: 'default', // Use default node type or create custom nodes
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
            background: isSummary ? '#FFCCaa' : '#CCFFdd',
            width: 200,
        },
    };
};

// Function to create edges between nodes
const createEdges = (nodes: AppNode[]): Edge[] => {
    const edges: Edge[] = [];
    nodes.forEach(node => {
        if (node.type === 'summary' && node.childIds) {
            node.childIds.forEach(childId => {
                // Check if child node exists before creating edge
                if (nodes.some(n => n.id === childId)) {
                    edges.push({
                        id: `e-${node.id}-${childId}`,
                        source: node.id,
                        target: childId,
                        type: 'smoothstep', // Or 'step', 'straight'
                        animated: false, // Optional animation
                    });
                }
            });
        } else if (node.type === 'log' && node.parentId) {
             // Edges are primarily drawn from summary to log, but could add reverse if needed
             // Or ensure edges are only created once from the summary node side
        }
    });
    return edges;
};


function App() {
  // Provide explicit types for the state hooks
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]); // Remove []
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]); // Remove []
  const [logInput, setLogInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const allNodesRef = useRef<Map<string, AppNode>>(new Map()); // Ref to store all nodes

  // Function to update flow nodes and edges based on allNodesRef
  const updateFlow = useCallback(() => {
      const currentNodes = Array.from(allNodesRef.current.values());
      const flowNodes = currentNodes.map(nodeToFlowNode);
      const flowEdges = createEdges(currentNodes);
      setNodes(flowNodes);
      setEdges(flowEdges);
  }, [setNodes, setEdges]);


  // WebSocket connection effect
  useEffect(() => {
    ws.current = new WebSocket(WS_URL);
    console.log('Attempting to connect WebSocket...');

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
    };

    ws.current.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      // Optional: Implement reconnection logic here
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Message from server:', message);

        if (message.type === 'initial_nodes' && Array.isArray(message.payload)) {
            const initialNodesMap = new Map<string, AppNode>();
            message.payload.forEach((node: AppNode) => initialNodesMap.set(node.id, node));
            allNodesRef.current = initialNodesMap;
            updateFlow();
        } else if (message.type === 'nodes_updated' && Array.isArray(message.payload)) {
            let updated = false;
            message.payload.forEach((node: AppNode) => {
                allNodesRef.current.set(node.id, node);
                updated = true;
            });
            if (updated) {
                updateFlow();
            }
        }
      } catch (error) {
        console.error('Failed to parse message or update state:', error);
      }
    };

    // Cleanup function
    return () => {
      ws.current?.close();
    };
  }, [updateFlow]); // Add updateFlow dependency

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLogInput(event.target.value);
  };

  const handleAddLog = async () => {
    if (!logInput.trim()) return;
    try {
      const response = await axios.post(API_URL, { content: logInput });
      console.log('Log added:', response.data);
      // No need to manually add node here, WebSocket update should handle it
      setLogInput(''); // Clear input field
    } catch (error) {
      console.error('Failed to add log:', error);
      alert('Failed to add log. Check console for details.');
    }
  };

  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  return (
    <div className="App">
      <h1>Log Summarizer GUI</h1>
      <div className="controls">
        <input
          type="text"
          value={logInput}
          onChange={handleInputChange}
          placeholder="Enter log message"
        />
        <button onClick={handleAddLog} disabled={!isConnected}>
          Add Log
        </button>
        <span> WebSocket Status: {isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
      <div style={{ height: '80vh', width: '100%', border: '1px solid #ccc' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          attributionPosition="bottom-left"
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}

export default App;
