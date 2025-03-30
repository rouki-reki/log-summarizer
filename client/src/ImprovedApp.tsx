import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node as FlowNode,
  Edge,
  Position,
  Panel,
  ConnectionLineType,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

// Define our Node types (matching server-side models)
interface BaseNode {
  id: string;
  level: number;
  content: string;
  timestamp: string;
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

// Custom node data interface
interface NodeData {
  label: string;
  nodeType: 'log' | 'summary';
  level: number;
  timestamp: string;
  content: string;
}

// Backend API and WebSocket URLs
const API_URL = 'http://localhost:52382/logs';
const WS_URL = 'ws://localhost:52382';

// Custom node component for better visualization
const CustomNode: React.FC<{ data: NodeData }> = ({ data }) => {
  const isLog = data.nodeType === 'log';
  const bgColor = isLog ? '#d4f7d4' : '#ffd8b3';
  const borderColor = isLog ? '#4caf50' : '#ff9800';
  const icon = isLog ? '📝' : '📊';
  
  return (
    <div 
      style={{
        padding: '10px',
        borderRadius: '5px',
        background: bgColor,
        border: `2px solid ${borderColor}`,
        width: '220px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '5px',
        fontWeight: 'bold',
        borderBottom: `1px solid ${borderColor}`,
        paddingBottom: '5px'
      }}>
        <span style={{ marginRight: '5px' }}>{icon}</span>
        {isLog ? 'Log Entry' : `Summary Level ${data.level}`}
      </div>
      <div style={{ 
        fontSize: '0.9em', 
        wordBreak: 'break-word',
        maxHeight: '80px',
        overflow: 'auto'
      }}>
        {data.content}
      </div>
      <div style={{ 
        fontSize: '0.8em', 
        marginTop: '5px',
        color: '#666',
        textAlign: 'right'
      }}>
        {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  );
};

// Define node types
const nodeTypes: NodeTypes = {
  customNode: CustomNode,
};

// Function to convert our AppNode to React Flow Node
const nodeToFlowNode = (node: AppNode, allNodes: Map<string, AppNode>): FlowNode => {
  const isSummary = node.type === 'summary';
  
  // Calculate position based on level and a more organized layout
  // For logs, position them in columns based on their creation order
  // For summaries, position them to the right of their children
  
  // Get timestamp for ordering
  const timestamp = new Date(node.timestamp).getTime();
  
  // Basic positioning logic - can be improved
  let xPosition = node.level * 350; // Horizontal spacing based on level
  
  // For y-position, use timestamp but with some grouping
  // This helps to visually organize nodes of the same level
  let yPosition = 0;
  
  if (isSummary) {
    // For summary nodes, try to position them at the average y-position of their children
    const summaryNode = node as SummaryNode;
    if (summaryNode.childIds && summaryNode.childIds.length > 0) {
      let totalY = 0;
      let count = 0;
      
      summaryNode.childIds.forEach(childId => {
        const childNode = allNodes.get(childId);
        if (childNode) {
          // Get the child's position (this is recursive but should be fine with our data structure)
          const childFlowNode = nodeToFlowNode(childNode, allNodes);
          totalY += childFlowNode.position.y;
          count++;
        }
      });
      
      if (count > 0) {
        yPosition = totalY / count;
      } else {
        yPosition = timestamp % 1000; // Fallback
      }
    } else {
      yPosition = timestamp % 1000; // Fallback
    }
  } else {
    // For log nodes, spread them vertically based on timestamp
    yPosition = timestamp % 1000;
  }
  
  return {
    id: node.id,
    position: { x: xPosition, y: yPosition },
    data: { 
      label: `${isSummary ? 'Summary L' + node.level : 'Log'}: ${node.content}`,
      nodeType: node.type,
      level: node.level,
      timestamp: node.timestamp,
      content: node.content
    },
    type: 'customNode',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
};

// Function to create edges between nodes
const createEdges = (nodes: Map<string, AppNode>): Edge[] => {
  const edges: Edge[] = [];
  
  // Process each node
  nodes.forEach(node => {
    if (node.type === 'summary') {
      const summaryNode = node as SummaryNode;
      
      // Create edges from summary to its children
      summaryNode.childIds.forEach(childId => {
        if (nodes.has(childId)) {
          edges.push({
            id: `e-${node.id}-${childId}`,
            source: node.id,
            target: childId,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#ff9800', strokeWidth: 2 }
          });
        }
      });
    }
    
    // Create edge from node to its parent (if it exists)
    // This ensures logs have only one edge (to their parent)
    if (node.parentId && nodes.has(node.parentId)) {
      // We don't need to create this edge as it's already created from the parent side
      // This prevents duplicate edges
    }
  });
  
  return edges;
};

function ImprovedApp() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [logInput, setLogInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const allNodesRef = useRef<Map<string, AppNode>>(new Map());

  // Function to update flow nodes and edges based on allNodesRef
  const updateFlow = useCallback(() => {
    const nodesMap = allNodesRef.current;
    const flowNodes = Array.from(nodesMap.values()).map(node => 
      nodeToFlowNode(node, nodesMap)
    );
    const flowEdges = createEdges(nodesMap);
    
    setNodes(flowNodes);
    setEdges(flowEdges);
    setIsLoading(false);
  }, [setNodes, setEdges]);

  // WebSocket connection effect
  useEffect(() => {
    ws.current = new WebSocket(WS_URL);
    console.log('Attempting to connect WebSocket...');

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      setError(null);
    };

    ws.current.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      setError('WebSocket connection closed. Server might be down.');
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket Error:', error);
      setError('Failed to connect to WebSocket server.');
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
        setError('Failed to process data from server.');
      }
    };

    // Cleanup function
    return () => {
      ws.current?.close();
    };
  }, [updateFlow]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLogInput(event.target.value);
  };

  const handleAddLog = async () => {
    if (!logInput.trim()) return;
    
    try {
      setIsLoading(true);
      const response = await axios.post(API_URL, { content: logInput });
      console.log('Log added:', response.data);
      setLogInput(''); // Clear input field
    } catch (error) {
      console.error('Failed to add log:', error);
      setError('Failed to add log. Server might be down.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleAddLog();
    }
  };

  return (
    <div className="improved-app">
      <header className="app-header">
        <h1>Log Summarizer</h1>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </header>
      
      <div className="controls-panel">
        <div className="input-group">
          <input
            type="text"
            value={logInput}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Enter log message"
            disabled={!isConnected || isLoading}
            className="log-input"
          />
          <button 
            onClick={handleAddLog} 
            disabled={!isConnected || isLoading || !logInput.trim()}
            className="add-button"
          >
            {isLoading ? 'Adding...' : 'Add Log'}
          </button>
        </div>
        
        {error && <div className="error-message">{error}</div>}
      </div>
      
      <div className="flow-container">
        {isLoading && !nodes.length ? (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading graph data...</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            connectionLineType={ConnectionLineType.SmoothStep}
          >
            <Controls />
            <MiniMap 
              nodeStrokeColor={(n) => {
                return n.data.nodeType === 'log' ? '#4caf50' : '#ff9800';
              }}
              nodeColor={(n) => {
                return n.data.nodeType === 'log' ? '#d4f7d4' : '#ffd8b3';
              }}
            />
            <Background color="#f8f8f8" gap={16} />
            <Panel position="top-right" className="legend-panel">
              <div className="legend">
                <div className="legend-item">
                  <div className="legend-color" style={{ backgroundColor: '#d4f7d4', border: '1px solid #4caf50' }}></div>
                  <span>Log Node</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ backgroundColor: '#ffd8b3', border: '1px solid #ff9800' }}></div>
                  <span>Summary Node</span>
                </div>
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>
    </div>
  );
}

export default ImprovedApp;
