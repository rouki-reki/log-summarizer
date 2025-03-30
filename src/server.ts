import express from 'express';
import logRoutes from './routes/logRoutes';
import cors from 'cors'; // Need to install cors: npm install cors @types/cors

const app = express();
const port = parseInt(process.env.PORT || '52381', 10); // Ensure port is a number

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/logs', logRoutes);

// Basic root route
app.get('/', (req, res) => {
  res.send('Log Summarizer API is running!');
});

// Start the server
if (process.env.NODE_ENV !== 'test') { // Don't start server during tests
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server listening on port ${port}`);
    });
}


export default app; // Export app for testing purposes