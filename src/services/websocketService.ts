import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import { Node } from '../models/node';

let wss: WebSocketServer;
const clients = new Set<WebSocket>();

export const websocketService = {
  initialize: (server: http.Server): void => {
    wss = new WebSocketServer({ server });
    console.log('WebSocket server initialized');

    wss.on('connection', (ws) => {
      console.log('Client connected');
      clients.add(ws);

      // Send all current nodes to the newly connected client
      try {
          const initialNodes = require('../database/memoryDb').db.getAllNodes();
          ws.send(JSON.stringify({ type: 'initial_nodes', payload: initialNodes }));
      } catch (error) {
          console.error("Error sending initial nodes:", error);
      }


      ws.on('message', (message) => {
        // Handle incoming messages if needed (e.g., client requests)
        console.log('received: %s', message);
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
      });

       ws.on('error', (error) => {
           console.error('WebSocket error:', error);
           clients.delete(ws); // Remove client on error
       });
    });
     wss.on('error', (error) => {
         console.error('WebSocket Server error:', error);
     });
  },

  // Broadcast message to all connected clients
  broadcast: (message: object): void => {
    if (!wss) {
      console.error('WebSocket server not initialized for broadcast');
      return;
    }
    const data = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, (err) => {
            if (err) {
                console.error('Error sending message to client:', err);
                // Optionally remove the client if sending fails repeatedly
                // clients.delete(client);
            }
        });
      } else if (client.readyState === WebSocket.CLOSING || client.readyState === WebSocket.CLOSED) {
          // Clean up disconnected clients that might not have triggered 'close' event properly
          console.log('Removing stale client connection during broadcast.');
          clients.delete(client);
      }
    });
  },

  // Specific broadcast functions for node updates
   broadcastNodeUpdate: (nodes: Node | Node[]): void => {
       const nodesArray = Array.isArray(nodes) ? nodes : [nodes];
       websocketService.broadcast({ type: 'nodes_updated', payload: nodesArray });
   }
};