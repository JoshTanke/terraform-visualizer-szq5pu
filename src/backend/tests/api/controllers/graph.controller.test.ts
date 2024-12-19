// External dependencies
import { jest } from '@jest/globals'; // v29.0.0
import { Request, Response } from 'express'; // v4.18.2
import WebSocket from 'ws'; // v8.13.0
import supertest from 'supertest'; // v6.3.3

// Internal dependencies
import { GraphController } from '../../../src/api/controllers/GraphController';
import { GraphService } from '../../../src/services/GraphService';
import { IGraph, ValidationStatus, NodeType, EdgeType, LayoutType } from '../../../src/interfaces/IGraph';

// Mock dependencies
jest.mock('../../../src/services/GraphService');
jest.mock('winston');

describe('GraphController', () => {
  let mockGraphService: jest.Mocked<GraphService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let mockWebSocket: jest.Mocked<WebSocket>;
  let controller: GraphController;
  let testGraphData: IGraph;

  beforeAll(() => {
    // Initialize test graph data
    testGraphData = {
      nodes: [{
        id: '1',
        type: NodeType.MODULE,
        data: { name: 'test-module' },
        position: { x: 0, y: 0 },
        validationStatus: ValidationStatus.VALID,
        style: {},
        metadata: {
          moduleId: '123',
          description: 'Test Module'
        }
      }],
      edges: [{
        id: '1',
        source: '1',
        target: '2',
        type: EdgeType.DEPENDENCY,
        weight: 1,
        style: {},
        metadata: {
          description: 'Test dependency'
        }
      }],
      layout: LayoutType.HIERARCHICAL,
      layoutConfig: {},
      metadata: {
        id: '123',
        name: 'test-graph',
        level: 'module',
        nodeCount: 1,
        edgeCount: 1,
        validationStatus: ValidationStatus.VALID,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    // Initialize WebSocket mock
    mockWebSocket = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
      ping: jest.fn()
    } as unknown as jest.Mocked<WebSocket>;

    // Initialize GraphService mock
    mockGraphService = {
      getPipelineGraph: jest.fn(),
      getEnvironmentGraph: jest.fn(),
      getModuleGraph: jest.fn(),
      invalidateCache: jest.fn(),
      updateGraph: jest.fn()
    } as unknown as jest.Mocked<GraphService>;

    // Create controller instance
    controller = new GraphController(
      mockGraphService,
      {} as any, // Logger mock
      new WebSocket.Server({ noServer: true })
    );
  });

  beforeEach(() => {
    mockRequest = {
      params: {},
      body: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('getPipelineGraph', () => {
    it('should return pipeline graph within 1 second', async () => {
      // Setup
      mockRequest.params = { projectId: '123' };
      mockGraphService.getPipelineGraph.mockResolvedValue(testGraphData);
      const startTime = Date.now();

      // Execute
      await controller.getPipelineGraph(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: testGraphData
        })
      );
    });

    it('should handle missing project ID with 400 error', async () => {
      // Setup
      mockRequest.params = {};

      // Execute
      await controller.getPipelineGraph(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          code: 'INVALID_REQUEST'
        })
      );
    });

    it('should handle GraphService errors with 500 response', async () => {
      // Setup
      mockRequest.params = { projectId: '123' };
      mockGraphService.getPipelineGraph.mockRejectedValue(new Error('Service error'));

      // Execute
      await controller.getPipelineGraph(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Service error')
        })
      );
    });
  });

  describe('getEnvironmentGraph', () => {
    it('should return environment graph within 1 second', async () => {
      // Setup
      mockRequest.params = { environmentId: '123' };
      mockGraphService.getEnvironmentGraph.mockResolvedValue(testGraphData);
      const startTime = Date.now();

      // Execute
      await controller.getEnvironmentGraph(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: testGraphData
        })
      );
    });

    it('should handle missing environment ID with 400 error', async () => {
      // Setup
      mockRequest.params = {};

      // Execute
      await controller.getEnvironmentGraph(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          code: 'INVALID_REQUEST'
        })
      );
    });
  });

  describe('getModuleGraph', () => {
    it('should return module graph within 1 second', async () => {
      // Setup
      mockRequest.params = { moduleId: '123' };
      mockGraphService.getModuleGraph.mockResolvedValue(testGraphData);
      const startTime = Date.now();

      // Execute
      await controller.getModuleGraph(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: testGraphData
        })
      );
    });

    it('should handle missing module ID with 400 error', async () => {
      // Setup
      mockRequest.params = {};

      // Execute
      await controller.getModuleGraph(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          code: 'INVALID_REQUEST'
        })
      );
    });
  });

  describe('WebSocket handling', () => {
    it('should establish WebSocket connection successfully', () => {
      // Setup
      const mockReq = {
        params: { graphId: '123' }
      } as Partial<Request>;

      // Execute
      controller.handleWebSocketConnection(mockWebSocket, mockReq as Request);

      // Verify
      expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle client disconnection gracefully', () => {
      // Setup
      const mockReq = {
        params: { graphId: '123' }
      } as Partial<Request>;

      // Execute
      controller.handleWebSocketConnection(mockWebSocket, mockReq as Request);
      const closeHandler = mockWebSocket.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeHandler();

      // Verify no errors thrown
      expect(true).toBeTruthy();
    });

    it('should broadcast updates to connected clients', async () => {
      // Setup
      const mockReq = {
        params: { graphId: '123' }
      } as Partial<Request>;
      controller.handleWebSocketConnection(mockWebSocket, mockReq as Request);

      // Execute
      const messageHandler = mockWebSocket.on.mock.calls.find(
        call => call[0] === 'message'
      )[1];
      await messageHandler(JSON.stringify({ type: 'invalidateCache' }));

      // Verify
      expect(mockGraphService.invalidateCache).toHaveBeenCalledWith('123');
    });
  });

  describe('Performance requirements', () => {
    it('should handle concurrent requests efficiently', async () => {
      // Setup
      mockRequest.params = { projectId: '123' };
      mockGraphService.getPipelineGraph.mockResolvedValue(testGraphData);

      // Execute
      const requests = Array(10).fill(null).map(() => 
        controller.getPipelineGraph(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      );

      // Verify
      const startTime = Date.now();
      await Promise.all(requests);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(3000); // Allow 3s for 10 concurrent requests
      expect(mockResponse.status).toHaveBeenCalledTimes(10);
    });

    it('should maintain response time under load', async () => {
      // Setup
      mockRequest.params = { projectId: '123' };
      mockGraphService.getPipelineGraph.mockResolvedValue(testGraphData);

      // Execute multiple requests sequentially
      const startTime = Date.now();
      for (let i = 0; i < 5; i++) {
        await controller.getPipelineGraph(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );
      }
      const endTime = Date.now();

      // Verify average response time
      const avgResponseTime = (endTime - startTime) / 5;
      expect(avgResponseTime).toBeLessThan(200); // Average 200ms per request
    });
  });
});