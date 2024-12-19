// External dependencies
import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals'; // v29.0.0
import WebSocket from 'ws'; // v8.13.0
import { Server, createServer } from 'http'; // built-in
import { performance } from 'perf_hooks'; // built-in

// Internal dependencies
import { WebSocketServer } from '../../src/websocket/WebSocketServer';
import { websocketConfig } from '../../src/config/websocket.config';

describe('WebSocketServer Integration Tests', () => {
  let httpServer: Server;
  let wsServer: WebSocketServer;
  let wsClient: WebSocket;
  const TEST_PORT = 3002;
  const TEST_PATH = '/ws';
  const TEST_URL = `ws://localhost:${TEST_PORT}${TEST_PATH}`;

  // Mock implementations
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    metric: jest.fn()
  };

  const mockWebSocketManager = {
    handleConnection: jest.fn(),
    handleDisconnection: jest.fn(),
    handleMessage: jest.fn()
  };

  beforeEach(async () => {
    // Setup HTTP server
    httpServer = createServer();
    httpServer.listen(TEST_PORT);

    // Initialize WebSocket server
    wsServer = new WebSocketServer(httpServer);
    await wsServer.initialize();

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    await wsServer.shutdown();
    httpServer.close();
  });

  describe('Server Lifecycle Tests', () => {
    it('should initialize successfully with valid configuration', async () => {
      expect(wsServer).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WebSocket server initialized',
        expect.any(Object)
      );
    });

    it('should handle graceful shutdown', async () => {
      // Create test client
      wsClient = new WebSocket(TEST_URL);
      await new Promise(resolve => wsClient.on('open', resolve));

      // Shutdown server
      await wsServer.shutdown();
      
      expect(wsClient.readyState).toBe(WebSocket.CLOSED);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WebSocket server shut down successfully'
      );
    });

    it('should handle server restart', async () => {
      await wsServer.shutdown();
      await wsServer.initialize();
      
      wsClient = new WebSocket(TEST_URL);
      await new Promise(resolve => wsClient.on('open', resolve));
      
      expect(wsClient.readyState).toBe(WebSocket.OPEN);
    });
  });

  describe('Connection Management Tests', () => {
    it('should accept valid client connections', async () => {
      wsClient = new WebSocket(TEST_URL);
      await new Promise(resolve => wsClient.on('open', resolve));
      
      expect(wsClient.readyState).toBe(WebSocket.OPEN);
      expect(mockWebSocketManager.handleConnection).toHaveBeenCalled();
    });

    it('should enforce connection limits', async () => {
      const maxConnections = websocketConfig.maxConnections;
      const clients: WebSocket[] = [];

      // Create maximum allowed connections
      for (let i = 0; i < maxConnections; i++) {
        const client = new WebSocket(TEST_URL);
        await new Promise(resolve => client.on('open', resolve));
        clients.push(client);
      }

      // Attempt one more connection
      const extraClient = new WebSocket(TEST_URL);
      await new Promise(resolve => extraClient.on('close', resolve));

      expect(extraClient.readyState).toBe(WebSocket.CLOSED);
      
      // Cleanup
      clients.forEach(client => client.close());
    });

    it('should handle concurrent connections efficiently', async () => {
      const concurrentConnections = 50;
      const clients: WebSocket[] = [];
      const startTime = performance.now();

      // Create concurrent connections
      for (let i = 0; i < concurrentConnections; i++) {
        const client = new WebSocket(TEST_URL);
        await new Promise(resolve => client.on('open', resolve));
        clients.push(client);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should handle 50 connections in under 5 seconds

      // Cleanup
      clients.forEach(client => client.close());
    });
  });

  describe('Message Handling Tests', () => {
    beforeEach(async () => {
      wsClient = new WebSocket(TEST_URL);
      await new Promise(resolve => wsClient.on('open', resolve));
    });

    it('should handle valid messages', async () => {
      const testMessage = {
        type: 'test',
        data: { foo: 'bar' }
      };

      wsClient.send(JSON.stringify(testMessage));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockWebSocketManager.handleMessage).toHaveBeenCalledWith(
        expect.any(WebSocket),
        expect.stringContaining('test')
      );
    });

    it('should handle binary messages', async () => {
      const binaryData = Buffer.from('test binary message');
      wsClient.send(binaryData);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockWebSocketManager.handleMessage).toHaveBeenCalled();
    });

    it('should enforce message size limits', async () => {
      const largeMessage = Buffer.alloc(websocketConfig.maxPayloadSize + 1);
      wsClient.send(largeMessage);

      await new Promise(resolve => wsClient.on('close', resolve));
      expect(wsClient.readyState).toBe(WebSocket.CLOSED);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle invalid message format', async () => {
      wsClient = new WebSocket(TEST_URL);
      await new Promise(resolve => wsClient.on('open', resolve));

      wsClient.send('invalid json');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle connection timeouts', async () => {
      wsClient = new WebSocket(TEST_URL);
      await new Promise(resolve => wsClient.on('open', resolve));

      // Simulate connection timeout
      await new Promise(resolve => setTimeout(resolve, websocketConfig.heartbeatInterval * 2));
      
      expect(wsClient.readyState).toBe(WebSocket.CLOSED);
    });

    it('should handle network interruptions', async () => {
      wsClient = new WebSocket(TEST_URL);
      await new Promise(resolve => wsClient.on('open', resolve));

      // Simulate network error
      wsClient.emit('error', new Error('Network error'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    it('should maintain response times under load', async () => {
      const messageCount = 100;
      const messages: Promise<number>[] = [];
      
      wsClient = new WebSocket(TEST_URL);
      await new Promise(resolve => wsClient.on('open', resolve));

      for (let i = 0; i < messageCount; i++) {
        const startTime = performance.now();
        wsClient.send(JSON.stringify({ type: 'test', id: i }));
        
        messages.push(
          new Promise(resolve => {
            wsClient.once('message', () => resolve(performance.now() - startTime));
          })
        );
      }

      const responseTimes = await Promise.all(messages);
      const averageResponse = responseTimes.reduce((a, b) => a + b) / messageCount;
      
      expect(averageResponse).toBeLessThan(50); // Average response time under 50ms
    });

    it('should handle high message frequency', async () => {
      const messageCount = 1000;
      const interval = 10; // 10ms between messages
      let receivedCount = 0;
      
      wsClient = new WebSocket(TEST_URL);
      await new Promise(resolve => wsClient.on('open', resolve));

      wsClient.on('message', () => receivedCount++);

      // Send messages rapidly
      for (let i = 0; i < messageCount; i++) {
        wsClient.send(JSON.stringify({ type: 'test', id: i }));
        await new Promise(resolve => setTimeout(resolve, interval));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(receivedCount).toBe(messageCount);
    });
  });

  describe('Security Tests', () => {
    it('should validate connection origins', async () => {
      const invalidClient = new WebSocket(TEST_URL, {
        headers: { origin: 'http://invalid-origin.com' }
      });

      await new Promise(resolve => invalidClient.on('close', resolve));
      expect(invalidClient.readyState).toBe(WebSocket.CLOSED);
    });

    it('should enforce rate limiting', async () => {
      wsClient = new WebSocket(TEST_URL);
      await new Promise(resolve => wsClient.on('open', resolve));

      const requests = websocketConfig.security.rateLimit + 1;
      for (let i = 0; i < requests; i++) {
        wsClient.send(JSON.stringify({ type: 'test', id: i }));
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded')
      );
    });

    it('should handle authentication timeout', async () => {
      const client = new WebSocket(TEST_URL);
      
      // Wait for authentication timeout
      await new Promise(resolve => 
        setTimeout(resolve, websocketConfig.security.authTimeout + 100)
      );
      
      expect(client.readyState).toBe(WebSocket.CLOSED);
    });
  });
});