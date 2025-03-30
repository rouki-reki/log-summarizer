import { Router } from 'express';
import { logController } from '../controllers/logController';

const router = Router();

// POST /logs - Add a new log entry
router.post('/', logController.addLog);

// GET /logs - Get all nodes (for debugging/testing)
router.get('/', logController.getAllNodes);

// GET /logs/:id - Get a specific node by ID (for debugging/testing)
router.get('/:id', logController.getNodeById);


export default router;