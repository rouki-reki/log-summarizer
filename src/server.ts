import express from 'express';
import http from 'http'; // Import http module
import logRoutes from './routes/logRoutes';
import cors from 'cors';
import { websocketService } from './services/websocketService'; // Import WebSocket service

const app = express();
const port = parseInt(process.env.PORT || '52381', 10); // Ensure port is a number

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/logs', logRoutes);

// Basic root route
app.get('/', (req, res) => {
  res.send('Log Summarizer API with WebSocket is running!');
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
websocketService.initialize(server);

// Start the server
if (process.env.NODE_ENV !== 'test') { // Don't start server during tests
    server.listen(port, '0.0.0.0', () => { // Use server.listen instead of app.listen
        console.log(`Server (HTTP + WebSocket) listening on port ${port}`);
    });
}

// Export the HTTP server instance for testing or other purposes if needed
// Note: Supertest works with the app instance, so exporting app might still be useful
// If WebSocket testing is needed directly, server export might be required.
export { app, server };