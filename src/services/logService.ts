import { v4 as uuidv4 } from 'uuid'; // Need to install uuid: npm install uuid @types/uuid
import { db } from '../database/memoryDb';
import { Node, LogNode, SummaryNode, isLogNode, isSummaryNode } from '../models/node';

const SUMMARY_THRESHOLD = 5;

// Function to generate pseudo-summary content
function generatePseudoSummary(childNodes: Node[]): string {
  let summaryContent = '';
  childNodes.forEach((node, index) => {
    const prefix = `${index + 1}st one:`; // Simple prefix
    const contentSnippet = node.content.substring(0, 10); // First 10 chars
    summaryContent += `${prefix}(${contentSnippet}) `;
  });
  // Trim trailing space and ensure max length (though unlikely needed with 10 chars * 5)
  return summaryContent.trim().substring(0, 50 * 2); // Generous max length
}

// Recursive function to check and create summaries
async function checkAndSummarize(level: number): Promise<void> {
  const unsummarizedNodes = db.findUnsummarizedNodes(level);

  if (unsummarizedNodes.length >= SUMMARY_THRESHOLD) {
    // Take the first 5 oldest unsummarized nodes
    const nodesToSummarize = unsummarizedNodes.slice(0, SUMMARY_THRESHOLD);
    const childIds = nodesToSummarize.map(node => node.id);

    // Generate pseudo-summary content
    const summaryContent = generatePseudoSummary(nodesToSummarize);

    // Create the new summary node
    const newSummaryNode: SummaryNode = {
      id: uuidv4(),
      type: 'summary',
      level: level + 1,
      content: summaryContent,
      timestamp: new Date(), // Summary creation time
      childIds: childIds,
      parentId: null, // Will be set if this node gets summarized later
    };

    // Add the new summary node to the DB
    db.addNode(newSummaryNode);
    console.log(`Created Summary Node ${newSummaryNode.id} (Level ${newSummaryNode.level}) summarizing ${childIds.length} Level ${level} nodes.`);

    // Broadcast the new summary node
    require('./websocketService').websocketService.broadcastNodeUpdate(newSummaryNode);


    // Update the parentId of the summarized nodes and get the updated nodes
    db.setParentIdForNodes(childIds, newSummaryNode.id);
    const updatedChildNodes = childIds.map(id => db.getNodeById(id)).filter(node => node !== undefined) as Node[];
    console.log(`Updated parentId for nodes: ${childIds.join(', ')}`);

    // Broadcast the updated child nodes (their parentId changed)
    require('./websocketService').websocketService.broadcastNodeUpdate(updatedChildNodes);


    // Recursively check if this new summary node triggers further summarization
    await checkAndSummarize(level + 1);
  }
}

export const logService = {
  addLog: async (logContent: string): Promise<LogNode> => {
    if (!logContent || typeof logContent !== 'string') {
        throw new Error('Invalid log content');
    }

    const newLogNode: LogNode = {
      id: uuidv4(),
      type: 'log',
      level: 0,
      content: logContent,
      timestamp: new Date(),
      parentId: null,
    };

    // Add the new log node to the DB
    db.addNode(newLogNode);
    console.log(`Added Log Node ${newLogNode.id}: "${logContent}"`);

    // Broadcast the new log node
    require('./websocketService').websocketService.broadcastNodeUpdate(newLogNode);


    // Check if summarization is needed starting from level 0
    await checkAndSummarize(0);

    return newLogNode;
  },

  // Optional: Function to get all nodes (for debugging/testing)
  getAllNodes: (): Node[] => {
    return db.getAllNodes();
  },

  // Optional: Function to get a node by ID (for debugging/testing)
  getNodeById: (id: string): Node | undefined => {
    return db.getNodeById(id);
  }
};