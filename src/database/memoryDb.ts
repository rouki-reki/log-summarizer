import { Node, LogNode, SummaryNode, isLogNode, isSummaryNode } from '../models/node';

// Simple in-memory store
const nodes = new Map<string, Node>();

export const db = {
  addNode: (node: Node): void => {
    nodes.set(node.id, node);
  },

  getNodeById: (id: string): Node | undefined => {
    return nodes.get(id);
  },

  getAllNodes: (): Node[] => {
    return Array.from(nodes.values());
  },

  // Find nodes that are not yet part of a summary (parentId is null) at a specific level
  findUnsummarizedNodes: (level: number): Node[] => {
    const unsummarized: Node[] = [];
    for (const node of nodes.values()) {
      if (node.level === level && node.parentId === null) {
        unsummarized.push(node);
      }
    }
    // Sort by timestamp to ensure chronological order for summarization
    unsummarized.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return unsummarized;
  },

  // Update the parentId of multiple nodes (used when creating a summary)
  setParentIdForNodes: (nodeIds: string[], parentId: string): void => {
    nodeIds.forEach(id => {
      const node = nodes.get(id);
      if (node) {
        node.parentId = parentId;
        nodes.set(id, node); // Update the node in the map
      }
    });
  },

  // Helper to clear the DB for testing
  clear: (): void => {
    nodes.clear();
  }
};