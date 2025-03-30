import { Request, Response } from 'express';
import { logService } from '../services/logService';

export const logController = {
  addLog: async (req: Request, res: Response): Promise<void> => {
    try {
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: 'Log content is required and must be a string.' });
        return;
      }

      const newLog = await logService.addLog(content);
      res.status(201).json(newLog);
    } catch (error) {
      console.error('Error adding log:', error);
      // Check if error is an instance of Error to safely access message
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ error: errorMessage });
    }
  },

  // Optional: Endpoint to get all nodes (for debugging/testing)
  getAllNodes: (req: Request, res: Response): void => {
    try {
      const nodes = logService.getAllNodes();
      res.status(200).json(nodes);
    } catch (error) {
      console.error('Error getting all nodes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ error: errorMessage });
    }
  },

    // Optional: Endpoint to get a node by ID (for debugging/testing)
    getNodeById: (req: Request, res: Response): void => {
        try {
            const { id } = req.params;
            const node = logService.getNodeById(id);
            if (node) {
                res.status(200).json(node);
            } else {
                res.status(404).json({ error: `Node with id ${id} not found.` });
            }
        } catch (error) {
            console.error(`Error getting node by id ${req.params.id}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ error: errorMessage });
        }
    }
};