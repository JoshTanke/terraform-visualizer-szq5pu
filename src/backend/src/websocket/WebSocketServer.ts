// External dependencies
import WebSocket from 'ws'; // v8.13.0
import { Server } from 'http'; // built-in

// Internal dependencies
import { WebSocketManager } from './WebSocketManager';
import { websocketConfig } from '../config/websocket.config';
import { Logger } from '../utils/logger';

/**
 * Enhanced WebSocket server implementation for secure and performant real-time communication
 * between clients and server for Terraform visualization updates.
 * @version 1.0.0
 */
export class WebSocketServer {
  private wss: WebSocket.Server;
  private readonly manager: WebSocketManager;
  private readonly logger: Logger;
  private readonly httpServer: Server;
  private readonly connectionPool: Map<string, WebSocket>;
  private readonly metricsCollector: Map<string, any>;
  private readonly securityContext: Map<string, any>;
  private readonly circuitBreaker: {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
  };

  // Constants for configuration
  private readonly HEARTBEAT_INTERVAL = websocketConfig.heartbeatInterval;
  private readonly MAX_CONNECTIONS = websocketConfig.maxConnections;
  private readonly RATE_LIMIT = websocketConfig.security.rateLimit;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_TIME = 30000;

  /**
   * Initializes the WebSocket server with enhanced security and monitoring features
   * @param httpServer - HTTP server instance for WebSocket upgrade
   */
  constructor(httpServer: Server) {
    this.httpServer = httpServer;
    this.logger = Logger.getInstance();
    this.manager = WebSocketManager.getInstance();
    this.connectionPool = new Map();
    this.metricsCollector = new Map();
    this.securityContext = new Map();
    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      isOpen: false
    };

    // Initialize WebSocket server with security configurations
    this.wss = new WebSocket.Server({
      server: httpServer,
      path: websocketConfig.path,
      maxPayload: websocketConfig.maxPayloadSize,
      clientTracking: true,
      perMessageDeflate: websocketConfig.performance.compression ? {
        zlibDeflateOptions: {
          level: websocketConfig.performance.compressionLevel
        }
      } : false
    });

    this.logger.info('WebSocket server initialized', {
      path: websocketConfig.path,
      maxConnections: this.MAX_CONNECTIONS
    });
  }

  /**
   * Initializes the WebSocket server with connection handling and monitoring
   */
  public async initialize(): Promise<void> {
    try {
      // Set up connection handler with validation
      this.wss.on('connection', (socket: WebSocket, request) => {
        this.handleConnection(socket, request).catch(error => {
          this.logger.error('Connection handler error', { error });
        });
      });

      // Set up error handler
      this.wss.on('error', (error: Error) => {
        this.handleError(error);
      });

      // Start metrics collection
      this.initializeMetrics();

      this.logger.info('WebSocket server started successfully');
    } catch (error) {
      this.logger.error('Failed to initialize WebSocket server', { error });
      throw error;
    }
  }

  /**
   * Handles new WebSocket connections with security validation and rate limiting
   * @param socket - WebSocket connection
   * @param request - HTTP upgrade request
   */
  private async handleConnection(socket: WebSocket, request: any): Promise<void> {
    const clientIp = request.socket.remoteAddress;
    const connectionId = `${clientIp}_${Date.now()}`;

    try {
      // Check circuit breaker
      if (this.circuitBreaker.isOpen) {
        socket.close(1008, 'Service temporarily unavailable');
        return;
      }

      // Validate connection against security rules
      if (!this.validateConnection(request)) {
        socket.close(1003, 'Connection rejected');
        return;
      }

      // Check rate limiting
      if (!this.checkRateLimit(clientIp)) {
        socket.close(1008, 'Rate limit exceeded');
        return;
      }

      // Check max connections
      if (this.connectionPool.size >= this.MAX_CONNECTIONS) {
        socket.close(1013, 'Maximum connections reached');
        return;
      }

      // Configure socket timeout and keepalive
      socket.on('pong', () => {
        this.updateConnectionMetrics(connectionId);
      });

      // Set up heartbeat interval
      const heartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.ping();
        } else {
          clearInterval(heartbeat);
          this.connectionPool.delete(connectionId);
        }
      }, this.HEARTBEAT_INTERVAL);

      // Add to connection pool
      this.connectionPool.set(connectionId, socket);

      // Initialize connection metrics
      this.initializeConnectionMetrics(connectionId);

      // Forward to WebSocket manager for message handling
      await this.manager.handleConnection(socket);

      this.logger.info('New WebSocket connection established', {
        connectionId,
        clientIp,
        totalConnections: this.connectionPool.size
      });

    } catch (error) {
      this.logger.error('Connection handling failed', {
        connectionId,
        clientIp,
        error
      });
      socket.close(1011, 'Internal server error');
    }
  }

  /**
   * Handles WebSocket server errors with circuit breaker pattern
   * @param error - Error object
   */
  private handleError(error: Error): void {
    this.logger.error('WebSocket server error', { error });

    // Update circuit breaker
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      setTimeout(() => {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
      }, this.CIRCUIT_BREAKER_RESET_TIME);
    }
  }

  /**
   * Gracefully shuts down the WebSocket server
   */
  public async shutdown(): Promise<void> {
    try {
      // Close all client connections
      for (const [connectionId, socket] of this.connectionPool.entries()) {
        socket.close(1001, 'Server shutting down');
        this.connectionPool.delete(connectionId);
      }

      // Close the WebSocket server
      await new Promise<void>((resolve, reject) => {
        this.wss.close(err => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.logger.info('WebSocket server shut down successfully');
    } catch (error) {
      this.logger.error('Error during WebSocket server shutdown', { error });
      throw error;
    }
  }

  /**
   * Initializes server-wide metrics collection
   */
  private initializeMetrics(): void {
    setInterval(() => {
      const metrics = {
        totalConnections: this.connectionPool.size,
        activeConnections: Array.from(this.connectionPool.values())
          .filter(socket => socket.readyState === WebSocket.OPEN).length,
        circuitBreakerStatus: this.circuitBreaker.isOpen ? 'open' : 'closed',
        timestamp: new Date().toISOString()
      };

      this.logger.metric('websocket_metrics', metrics);
    }, websocketConfig.monitoring.metricsEnabled ? 5000 : 0);
  }

  /**
   * Initializes metrics for a new connection
   */
  private initializeConnectionMetrics(connectionId: string): void {
    this.metricsCollector.set(connectionId, {
      messageCount: 0,
      lastActivity: Date.now(),
      errors: 0
    });
  }

  /**
   * Updates connection metrics
   */
  private updateConnectionMetrics(connectionId: string): void {
    const metrics = this.metricsCollector.get(connectionId);
    if (metrics) {
      metrics.lastActivity = Date.now();
    }
  }

  /**
   * Validates incoming connections against security rules
   */
  private validateConnection(request: any): boolean {
    const origin = request.headers.origin;
    return websocketConfig.security.allowedOrigins.some(allowed => 
      origin === allowed || origin.endsWith(allowed.replace('*.', '.'))
    );
  }

  /**
   * Implements rate limiting for connections
   */
  private checkRateLimit(clientIp: string): boolean {
    const key = `rateLimit_${clientIp}`;
    const now = Date.now();
    const connectionCount = this.securityContext.get(key)?.count || 0;
    const lastConnection = this.securityContext.get(key)?.timestamp || 0;

    if (now - lastConnection > 60000) {
      // Reset after 1 minute
      this.securityContext.set(key, { count: 1, timestamp: now });
      return true;
    }

    if (connectionCount >= this.RATE_LIMIT) {
      return false;
    }

    this.securityContext.set(key, {
      count: connectionCount + 1,
      timestamp: lastConnection
    });
    return true;
  }
}

export default WebSocketServer;