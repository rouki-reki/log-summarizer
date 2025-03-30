import request from 'supertest';
import app from '../../src/server'; // Import the Express app instance
import { db } from '../../src/database/memoryDb'; // Access DB directly for assertions
import { Node, LogNode, SummaryNode, isLogNode, isSummaryNode } from '../../src/models/node';

// Helper function to add a log via API
const addLogApi = (content: string) => {
  return request(app).post('/logs').send({ content });
};

describe('Log Summarization Integration Tests', () => {
  // Clear the database before each test
  beforeEach(() => {
    db.clear();
    // Ensure NODE_ENV is set to test to prevent server from starting listening
    process.env.NODE_ENV = 'test';
  });

  test('TC-LOG-001: Add 1 log, no summary', async () => {
    const response = await addLogApi('Log 1');
    expect(response.status).toBe(201);
    expect(response.body.content).toBe('Log 1');
    expect(response.body.level).toBe(0);

    const allNodes = db.getAllNodes();
    expect(allNodes.length).toBe(1);
    expect(isLogNode(allNodes[0])).toBe(true);
    expect(allNodes[0].parentId).toBeNull();
  });

  test('TC-LOG-002: Add 4 logs, no summary', async () => {
    await addLogApi('Log 1');
    await addLogApi('Log 2');
    await addLogApi('Log 3');
    await addLogApi('Log 4');

    const allNodes = db.getAllNodes();
    expect(allNodes.length).toBe(4);
    allNodes.forEach(node => {
      expect(isLogNode(node)).toBe(true);
      expect(node.parentId).toBeNull();
    });
  });

  test('TC-SUM-001: Add 5 logs, create Level 1 summary', async () => {
    const logContents = ['L1', 'L2', 'L3', 'L4', 'L5'];
    const logNodeIds: string[] = [];
    for (const content of logContents) {
      const res = await addLogApi(content);
      logNodeIds.push(res.body.id);
    }

    const allNodes = db.getAllNodes();
    expect(allNodes.length).toBe(6); // 5 logs + 1 summary

    const summaryNodes = allNodes.filter(isSummaryNode);
    expect(summaryNodes.length).toBe(1);
    const summary = summaryNodes[0];
    expect(summary.level).toBe(1);
    expect(summary.parentId).toBeNull();
    expect(summary.childIds).toEqual(logNodeIds); // Ensure correct children in order
    expect(summary.content).toContain('1st one:(L1)');
    expect(summary.content).toContain('5st one:(L5)');


    const logNodes = allNodes.filter(isLogNode);
    expect(logNodes.length).toBe(5);
    logNodes.forEach(log => {
      expect(log.parentId).toBe(summary.id); // Ensure logs are linked to the summary
    });
  });

  test('TC-SUM-002: Add 6 logs, 1 Level 1 summary, 1 unsummarized log', async () => {
    const logContents = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
    let firstSummaryId: string | null = null;
    for (const content of logContents) {
      await addLogApi(content);
      // Find the summary ID after the 5th log
      if (content === 'L5') {
          const nodes = db.getAllNodes();
          const summary = nodes.find(isSummaryNode);
          if (summary) firstSummaryId = summary.id;
      }
    }

    const allNodes = db.getAllNodes();
    expect(allNodes.length).toBe(7); // 6 logs + 1 summary

    const summaryNodes = allNodes.filter(isSummaryNode);
    expect(summaryNodes.length).toBe(1);
    expect(summaryNodes[0].id).toBe(firstSummaryId);


    const logNodes = allNodes.filter(isLogNode);
    expect(logNodes.length).toBe(6);
    const summarizedLogs = logNodes.filter(log => log.parentId === firstSummaryId);
    const unsummarizedLogs = logNodes.filter(log => log.parentId === null);
    expect(summarizedLogs.length).toBe(5);
    expect(unsummarizedLogs.length).toBe(1);
    expect(unsummarizedLogs[0].content).toBe('L6');
  });

  test('TC-SUM-003: Add 10 logs, create 2 Level 1 summaries', async () => {
    const logContents = Array.from({ length: 10 }, (_, i) => `Log ${i + 1}`);
    for (const content of logContents) {
      await addLogApi(content);
    }

    const allNodes = db.getAllNodes();
    expect(allNodes.length).toBe(12); // 10 logs + 2 summaries

    const summaryNodes = allNodes.filter(isSummaryNode);
    expect(summaryNodes.length).toBe(2);
    expect(summaryNodes[0].level).toBe(1);
    expect(summaryNodes[1].level).toBe(1);
    expect(summaryNodes[0].parentId).toBeNull();
    expect(summaryNodes[1].parentId).toBeNull();


    const logNodes = allNodes.filter(isLogNode);
    expect(logNodes.length).toBe(10);
    const logsWithParent1 = logNodes.filter(log => log.parentId === summaryNodes[0].id);
    const logsWithParent2 = logNodes.filter(log => log.parentId === summaryNodes[1].id);
    expect(logsWithParent1.length).toBe(5);
    expect(logsWithParent2.length).toBe(5);
  });

  test('TC-SUM-004: Add 24 logs, create 4 Level 1 summaries, no Level 2 summary', async () => {
    const logContents = Array.from({ length: 24 }, (_, i) => `L${i + 1}`);
    for (const content of logContents) {
      await addLogApi(content);
    }

    const allNodes = db.getAllNodes();
    expect(allNodes.length).toBe(24 + 4); // 24 logs + 4 L1 summaries

    const summaryNodes = allNodes.filter(isSummaryNode);
    expect(summaryNodes.length).toBe(4);
    summaryNodes.forEach(summary => {
        expect(summary.level).toBe(1);
        expect(summary.parentId).toBeNull(); // No L2 summary yet
    });

    const logNodes = allNodes.filter(isLogNode);
    expect(logNodes.length).toBe(24);
    const unsummarizedLogs = logNodes.filter(log => log.parentId === null);
    expect(unsummarizedLogs.length).toBe(4); // Last 4 logs shouldn't be summarized yet
  });


  test('TC-SUM-005: Add 25 logs, create 5 Level 1 summaries and 1 Level 2 summary', async () => {
    const logContents = Array.from({ length: 25 }, (_, i) => `L${i + 1}`);
    const level1SummaryIds: string[] = [];
    for (const content of logContents) {
      await addLogApi(content);
      // Capture L1 summary IDs as they are created
      const summaries = db.getAllNodes().filter(isSummaryNode);
      summaries.forEach(s => {
          if(s.level === 1 && !level1SummaryIds.includes(s.id)) {
              level1SummaryIds.push(s.id);
          }
      })
    }

    const allNodes = db.getAllNodes();
     // 25 logs + 5 L1 summaries + 1 L2 summary
    expect(allNodes.length).toBe(25 + 5 + 1);

    const level1Summaries = allNodes.filter(node => isSummaryNode(node) && node.level === 1);
    const level2Summaries = allNodes.filter(node => isSummaryNode(node) && node.level === 2);

    expect(level1Summaries.length).toBe(5);
    expect(level2Summaries.length).toBe(1);

    const level2Summary = level2Summaries[0];
    // Type guard to ensure it's a SummaryNode before accessing childIds
    if (!isSummaryNode(level2Summary)) {
        throw new Error('TC-SUM-005: Expected level2Summary to be a SummaryNode');
    }
    expect(level2Summary.parentId).toBeNull();
    // Ensure L2 summary points to the 5 L1 summaries
    expect(level2Summary.childIds.sort()).toEqual(level1SummaryIds.sort());

    // Ensure all L1 summaries now have the L2 summary as their parent
    level1Summaries.forEach(l1Summary => {
      // Type guard for l1Summary as well, although filter should handle it
      if (!isSummaryNode(l1Summary)) {
          throw new Error('TC-SUM-005: Expected l1Summary to be a SummaryNode');
      }
      expect(l1Summary.parentId).toBe(level2Summary.id);
    });

    // Ensure all log nodes have an L1 summary as parent
    const logNodes = allNodes.filter(isLogNode);
    expect(logNodes.length).toBe(25);
    logNodes.forEach(log => {
        expect(log.parentId).not.toBeNull();
        expect(level1SummaryIds).toContain(log.parentId);
    });
  });

   test('TC-SUM-006: Add 26 logs, 1 L2 summary, 1 unsummarized L0 log', async () => {
    const logContents = Array.from({ length: 26 }, (_, i) => `L${i + 1}`);
    for (const content of logContents) {
      await addLogApi(content);
    }

    const allNodes = db.getAllNodes();
    // 26 logs + 5 L1 summaries + 1 L2 summary
    expect(allNodes.length).toBe(26 + 5 + 1);

    const level2Summaries = allNodes.filter(node => isSummaryNode(node) && node.level === 2);
    expect(level2Summaries.length).toBe(1);

    const logNodes = allNodes.filter(isLogNode);
    const unsummarizedLogs = logNodes.filter(log => log.parentId === null);
    expect(unsummarizedLogs.length).toBe(1);
    expect(unsummarizedLogs[0].content).toBe('L26');
  });

  test('TC-SUM-007: Add 125 logs, create L1, L2, and L3 summaries', async () => {
    // This test might take a bit longer
    jest.setTimeout(15000); // Increase timeout for this test if needed

    const logContents = Array.from({ length: 125 }, (_, i) => `Log ${i + 1}`);
    for (const content of logContents) {
      await addLogApi(content);
    }

    const allNodes = db.getAllNodes();
    const expectedL1Count = 125 / 5; // 25
    const expectedL2Count = expectedL1Count / 5; // 5
    const expectedL3Count = expectedL2Count / 5; // 1
    // 125 logs + 25 L1 + 5 L2 + 1 L3
    expect(allNodes.length).toBe(125 + expectedL1Count + expectedL2Count + expectedL3Count);


    const level1Summaries = allNodes.filter(node => isSummaryNode(node) && node.level === 1);
    const level2Summaries = allNodes.filter(node => isSummaryNode(node) && node.level === 2);
    const level3Summaries = allNodes.filter(node => isSummaryNode(node) && node.level === 3);
    const level1Ids = level1Summaries.map(s => s.id); // Define earlier
    const level2Ids = level2Summaries.map(s => s.id); // Define earlier
    const logIds = allNodes.filter(isLogNode).map(l => l.id); // Define earlier


    expect(level1Summaries.length).toBe(expectedL1Count);
    expect(level2Summaries.length).toBe(expectedL2Count);
    expect(level3Summaries.length).toBe(expectedL3Count);

    // Check L3 summary
    const level3Summary = level3Summaries[0];
    if (!isSummaryNode(level3Summary)) {
        throw new Error('TC-SUM-007: Expected level3Summary to be a SummaryNode');
    }
    expect(level3Summary.parentId).toBeNull();
    expect(level3Summary.childIds.length).toBe(5);
    // const level2Ids = level2Summaries.map(s => s.id); // Defined earlier
    expect(level3Summary.childIds.sort()).toEqual(level2Ids.sort());


    // Check L2 summaries
    // const level1Ids = level1Summaries.map(s => s.id); // Defined earlier
    // const level2Ids = level2Summaries.map(s => s.id); // Defined earlier
    level2Summaries.forEach(l2Summary => {
        if (!isSummaryNode(l2Summary)) {
            throw new Error('TC-SUM-007: Expected l2Summary to be a SummaryNode');
        }
        expect(l2Summary.parentId).toBe(level3Summary.id);
        expect(l2Summary.childIds.length).toBe(5);
        l2Summary.childIds.forEach((childId: string) => { // Add type annotation
            expect(level1Ids).toContain(childId);
        });
    });

    // Check L1 summaries
    // const logIds = allNodes.filter(isLogNode).map(l => l.id); // Defined earlier
     level1Summaries.forEach(l1Summary => {
        if (!isSummaryNode(l1Summary)) {
            throw new Error('TC-SUM-007: Expected l1Summary to be a SummaryNode');
        }
        // Explicitly check parentId is not null
        expect(l1Summary.parentId).not.toBeNull();
        // Get the parent node and verify its level is 2
        const parentNode = db.getNodeById(l1Summary.parentId as string);
        expect(parentNode).toBeDefined();
        if (parentNode) { // Check if parentNode is defined before accessing properties
            expect(isSummaryNode(parentNode)).toBe(true);
            expect(parentNode.level).toBe(2);
        }
        expect(l1Summary.childIds.length).toBe(5);
         l1Summary.childIds.forEach((childId: string) => { // Add type annotation
            expect(logIds).toContain(childId);
        });
    });

    // Check all logs are summarized
     const logNodes = allNodes.filter(isLogNode);
     logNodes.forEach(log => {
         expect(log.parentId).not.toBeNull();
         expect(level1Ids).toContain(log.parentId);
     });
  });

});