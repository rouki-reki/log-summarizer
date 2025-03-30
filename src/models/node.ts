export interface LogNode {
  id: string;
  type: 'log';
  level: 0;
  content: string;
  timestamp: Date;
  parentId: string | null; // ID of the summary node this log belongs to, null if not summarized yet
}

export interface SummaryNode {
  id: string;
  type: 'summary';
  level: number; // 1, 2, 3, ...
  content: string; // Generated summary content
  timestamp: Date; // Timestamp of summary creation
  childIds: string[]; // IDs of the 5 child nodes (either LogNode or lower-level SummaryNode)
  parentId: string | null; // ID of the higher-level summary node, null if it's the highest level reached so far for its children
}

export type Node = LogNode | SummaryNode;

// Helper type guard functions
export function isLogNode(node: Node): node is LogNode {
  return node.type === 'log';
}

export function isSummaryNode(node: Node): node is SummaryNode {
  return node.type === 'summary';
}