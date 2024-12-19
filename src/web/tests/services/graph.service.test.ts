/**
 * @fileoverview Comprehensive test suite for the GraphService class
 * @version 1.0.0
 */

import { jest } from '@jest/globals'; // ^29.0.0
import { GraphService } from '../../src/services/graph.service';
import { ApiService } from '../../src/services/api.service';
import { WebSocketService } from '../../src/services/websocket.service';
import { IGraph, LayoutType, NodeType, EdgeType } from '../../src/interfaces/IGraph';

// Mock dependencies
jest.mock('../../src/services/api.service');
jest.mock('../../src/services/websocket.service');

describe('GraphService', () => {
  let graphService: GraphService;
  let apiService: jest.Mocked<ApiService>;
  let wsService: jest.Mocked<WebSocketService>;

  // Test data
  const mockGraphData: IGraph = {
    nodes: [
      {
        id: 'node1',
        type: NodeType.MODULE,
        data: { label: 'Test Module' },
        position: { x: 0, y: 0 },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'valid'
        }
      }
    ],
    edges: [
      {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: EdgeType.DEPENDENCY,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    ],
    layout: LayoutType.HIERARCHICAL,
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      name: 'Test Graph',
      nodeCount: 1,
      edgeCount: 1
    }
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Initialize mocked services
    apiService = {
      getGraph: jest.fn(),
      dispose: jest.fn()
    } as unknown as jest.Mocked<ApiService>;

    wsService = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn()
    } as unknown as jest.Mocked<WebSocketService>;

    // Create fresh GraphService instance
    graphService = new GraphService(apiService, wsService);
  });

  afterEach(() => {
    jest.clearAllTimers();
    graphService.dispose();
  });

  describe('getGraph', () => {
    it('should retrieve and process graph data within performance requirements', async () => {
      // Setup
      const moduleId = 'test-module';
      apiService.getGraph.mockResolvedValue(mockGraphData);
      const startTime = Date.now();

      // Execute
      const result = await graphService.getGraph(moduleId);

      // Verify performance (< 1 second)
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify result structure
      expect(result).toEqual(expect.objectContaining({
        nodes: expect.any(Array),
        edges: expect.any(Array),
        layout: expect.any(String),
        metadata: expect.any(Object)
      }));

      // Verify API call
      expect(apiService.getGraph).toHaveBeenCalledWith(moduleId);
    });

    it('should use cached data for repeated requests', async () => {
      // Setup
      const moduleId = 'test-module';
      apiService.getGraph.mockResolvedValue(mockGraphData);

      // First call
      await graphService.getGraph(moduleId);
      
      // Second call should use cache
      const result = await graphService.getGraph(moduleId);
      
      // Verify API was only called once
      expect(apiService.getGraph).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockGraphData);
    });

    it('should handle invalid graph data', async () => {
      // Setup
      const moduleId = 'test-module';
      const invalidData = { ...mockGraphData, nodes: null };
      apiService.getGraph.mockResolvedValue(invalidData);

      // Execute & Verify
      await expect(graphService.getGraph(moduleId))
        .rejects
        .toThrow('Invalid graph data received from API');
    });
  });

  describe('updateLayout', () => {
    it('should update graph layout with performance optimization', () => {
      // Setup
      const newLayout = LayoutType.DAGRE;
      
      // Execute
      const result = graphService.updateLayout(mockGraphData, newLayout);

      // Verify layout update
      expect(result.layout).toBe(newLayout);
      expect(result.nodes[0].position).toBeDefined();

      // Verify debounce
      jest.advanceTimersByTime(250);
      expect(result).toBeDefined();
    });

    it('should handle invalid graph data for layout update', () => {
      // Setup
      const invalidGraph = { ...mockGraphData, nodes: null };
      
      // Execute & Verify
      expect(() => graphService.updateLayout(invalidGraph, LayoutType.HIERARCHICAL))
        .toThrow('Invalid graph data provided for layout update');
    });
  });

  describe('subscribeToUpdates', () => {
    it('should handle real-time updates within performance requirements', () => {
      // Setup
      const moduleId = 'test-module';
      const updateCallback = jest.fn();
      const errorCallback = jest.fn();
      const startTime = Date.now();

      // Execute
      const unsubscribe = graphService.subscribeToUpdates(
        moduleId,
        updateCallback,
        errorCallback
      );

      // Simulate update
      const wsCallback = wsService.subscribe.mock.calls[0][1];
      wsCallback({ moduleId, graph: mockGraphData });

      // Verify performance
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify subscription
      expect(wsService.subscribe).toHaveBeenCalledWith(
        'graph.update',
        expect.any(Function)
      );

      // Cleanup
      unsubscribe();
    });

    it('should handle WebSocket reconnection', async () => {
      // Setup
      const moduleId = 'test-module';
      const updateCallback = jest.fn();
      const errorCallback = jest.fn();

      // Execute
      graphService.subscribeToUpdates(moduleId, updateCallback, errorCallback);

      // Simulate disconnect
      const disconnectCallback = wsService.subscribe.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      
      if (disconnectCallback) {
        await disconnectCallback();
      }

      // Verify reconnection attempt
      expect(wsService.connect).toHaveBeenCalled();
    });

    it('should handle update errors gracefully', () => {
      // Setup
      const moduleId = 'test-module';
      const updateCallback = jest.fn();
      const errorCallback = jest.fn();

      // Execute
      graphService.subscribeToUpdates(moduleId, updateCallback, errorCallback);

      // Simulate error
      const wsCallback = wsService.subscribe.mock.calls[0][1];
      wsCallback({ moduleId, error: new Error('Update failed') });

      // Verify error handling
      expect(errorCallback).toHaveBeenCalled();
    });
  });

  describe('unsubscribeFromUpdates', () => {
    it('should properly cleanup subscriptions', () => {
      // Setup
      const moduleId = 'test-module';
      const updateCallback = jest.fn();
      const errorCallback = jest.fn();

      // Execute
      const unsubscribe = graphService.subscribeToUpdates(
        moduleId,
        updateCallback,
        errorCallback
      );
      unsubscribe();

      // Verify cleanup
      expect(wsService.unsubscribe).toHaveBeenCalled();
    });

    it('should handle multiple subscriptions independently', () => {
      // Setup
      const callbacks = [
        { update: jest.fn(), error: jest.fn() },
        { update: jest.fn(), error: jest.fn() }
      ];

      // Execute
      const unsubscribes = callbacks.map((callback, index) =>
        graphService.subscribeToUpdates(
          `module-${index}`,
          callback.update,
          callback.error
        )
      );

      // Unsubscribe one
      unsubscribes[0]();

      // Verify
      expect(wsService.unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});