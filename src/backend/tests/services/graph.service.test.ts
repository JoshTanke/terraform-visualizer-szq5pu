import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { MockInstance } from 'jest-mock';
import WebSocket from 'ws';

// Internal imports
import { GraphService } from '../../src/services/GraphService';
import { CacheService } from '../../src/services/CacheService';
import { IGraph, ValidationStatus, LayoutType } from '../../src/interfaces/IGraph';

// Mock WebSocket and CacheService
jest.mock('ws');
jest.mock('../../src/services/CacheService');

describe('GraphService', () => {
  let graphService: GraphService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockWebSocket: jest.Mocked<typeof WebSocket>;
  let mockClients: Set<WebSocket>;
  let performanceTimer: { start: number; end: () => number };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
    } as any;

    // Setup mock WebSocket
    mockWebSocket = {
      Server: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        clients: new Set(),
      })),
    } as any;

    // Setup mock clients
    mockClients = new Set();

    // Setup performance timer
    performanceTimer = {
      start: Date.now(),
      end: () => Date.now() - performanceTimer.start,
    };

    // Initialize GraphService instance
    graphService = GraphService.getInstance();

    // Mock internal WebSocket server
    (graphService as any).wsServer = {
      on: jest.fn(),
      clients: mockClients,
    };
  });

  afterEach(() => {
    // Clear cache and reset instance
    mockCacheService.clear();
    (GraphService as any).instance = undefined;
  });

  describe('getInstance', () => {
    test('should return singleton instance', () => {
      const instance1 = GraphService.getInstance();
      const instance2 = GraphService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should initialize with correct configuration', () => {
      const instance = GraphService.getInstance();
      expect(instance).toBeInstanceOf(GraphService);
      expect((instance as any).cacheService).toBeDefined();
      expect((instance as any).wsServer).toBeDefined();
    });
  });

  describe('getPipelineGraph', () => {
    const projectId = 'test-project';
    const mockPipelineGraph: IGraph = {
      nodes: [
        {
          id: 'env1',
          type: 'environment',
          data: { name: 'Development' },
          position: { x: 0, y: 0 },
          validationStatus: ValidationStatus.VALID,
          style: {},
        },
      ],
      edges: [],
      layout: LayoutType.HIERARCHICAL,
      layoutConfig: {},
      metadata: {
        id: 'test',
        name: 'pipeline-graph',
        level: 'pipeline',
        nodeCount: 1,
        edgeCount: 0,
        validationStatus: ValidationStatus.VALID,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    test('should return cached pipeline graph if available', async () => {
      mockCacheService.get.mockResolvedValue(mockPipelineGraph);
      
      const result = await graphService.getPipelineGraph(projectId);
      
      expect(result).toEqual(mockPipelineGraph);
      expect(mockCacheService.get).toHaveBeenCalledWith(`pipeline:${projectId}`);
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    test('should generate and cache pipeline graph if not cached', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(undefined);
      
      const result = await graphService.getPipelineGraph(projectId);
      
      expect(result).toBeDefined();
      expect(result.nodes).toBeInstanceOf(Array);
      expect(result.edges).toBeInstanceOf(Array);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    test('should meet performance requirements', async () => {
      performanceTimer.start = Date.now();
      await graphService.getPipelineGraph(projectId);
      const duration = performanceTimer.end();
      
      expect(duration).toBeLessThan(3000); // < 3 seconds requirement
    });
  });

  describe('getEnvironmentGraph', () => {
    const environmentId = 'test-env';
    const mockEnvironmentGraph: IGraph = {
      nodes: [
        {
          id: 'module1',
          type: 'module',
          data: { name: 'VPC' },
          position: { x: 0, y: 0 },
          validationStatus: ValidationStatus.VALID,
          style: {},
        },
      ],
      edges: [],
      layout: LayoutType.DAGRE,
      layoutConfig: {},
      metadata: {
        id: 'test',
        name: 'environment-graph',
        level: 'environment',
        nodeCount: 1,
        edgeCount: 0,
        validationStatus: ValidationStatus.VALID,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    test('should return cached environment graph if available', async () => {
      mockCacheService.get.mockResolvedValue(mockEnvironmentGraph);
      
      const result = await graphService.getEnvironmentGraph(environmentId);
      
      expect(result).toEqual(mockEnvironmentGraph);
      expect(mockCacheService.get).toHaveBeenCalledWith(`environment:${environmentId}`);
    });

    test('should generate and cache environment graph if not cached', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      const result = await graphService.getEnvironmentGraph(environmentId);
      
      expect(result).toBeDefined();
      expect(result.layout).toBe(LayoutType.DAGRE);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    test('should meet performance requirements', async () => {
      performanceTimer.start = Date.now();
      await graphService.getEnvironmentGraph(environmentId);
      const duration = performanceTimer.end();
      
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('getModuleGraph', () => {
    const moduleId = 'test-module';
    const mockModuleGraph: IGraph = {
      nodes: [
        {
          id: 'resource1',
          type: 'resource',
          data: { name: 'aws_instance' },
          position: { x: 0, y: 0 },
          validationStatus: ValidationStatus.VALID,
          style: {},
        },
      ],
      edges: [],
      layout: LayoutType.FORCE,
      layoutConfig: {},
      metadata: {
        id: 'test',
        name: 'module-graph',
        level: 'module',
        nodeCount: 1,
        edgeCount: 0,
        validationStatus: ValidationStatus.VALID,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    test('should return cached module graph if available', async () => {
      mockCacheService.get.mockResolvedValue(mockModuleGraph);
      
      const result = await graphService.getModuleGraph(moduleId);
      
      expect(result).toEqual(mockModuleGraph);
      expect(mockCacheService.get).toHaveBeenCalledWith(`module:${moduleId}`);
    });

    test('should generate and cache module graph if not cached', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      const result = await graphService.getModuleGraph(moduleId);
      
      expect(result).toBeDefined();
      expect(result.layout).toBe(LayoutType.FORCE);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    test('should meet performance requirements', async () => {
      performanceTimer.start = Date.now();
      await graphService.getModuleGraph(moduleId);
      const duration = performanceTimer.end();
      
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('updateGraph', () => {
    const graphId = 'test-graph';
    const mockUpdatedGraph: IGraph = {
      nodes: [],
      edges: [],
      layout: LayoutType.FORCE,
      layoutConfig: {},
      metadata: {
        id: 'test',
        name: 'updated-graph',
        level: 'module',
        nodeCount: 0,
        edgeCount: 0,
        validationStatus: ValidationStatus.VALID,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    test('should update cache and broadcast to clients', async () => {
      const mockClient = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
      } as any;
      mockClients.add(mockClient);

      await graphService.updateGraph(graphId, mockUpdatedGraph);

      expect(mockCacheService.set).toHaveBeenCalled();
      expect(mockClient.send).toHaveBeenCalled();
      const broadcastMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(broadcastMessage.type).toBe('graphUpdate');
      expect(broadcastMessage.graphId).toBe(graphId);
    });

    test('should meet performance requirements for updates', async () => {
      performanceTimer.start = Date.now();
      await graphService.updateGraph(graphId, mockUpdatedGraph);
      const duration = performanceTimer.end();
      
      expect(duration).toBeLessThan(1000); // < 1 second requirement
    });
  });

  describe('invalidateCache', () => {
    const graphId = 'test-graph';

    test('should remove cached graph and notify clients', async () => {
      const mockClient = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
      } as any;
      mockClients.add(mockClient);

      await graphService.invalidateCache(graphId);

      expect(mockCacheService.delete).toHaveBeenCalled();
      expect(mockClient.send).toHaveBeenCalled();
      const notificationMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(notificationMessage.type).toBe('cacheInvalidated');
      expect(notificationMessage.graphId).toBe(graphId);
    });

    test('should handle invalid graph IDs', async () => {
      await expect(graphService.invalidateCache('invalid-format'))
        .rejects
        .toThrow('Invalid graph ID format');
    });
  });
});