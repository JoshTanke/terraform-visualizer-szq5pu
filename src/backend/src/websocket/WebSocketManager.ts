// External dependencies
import WebSocket from 'ws'; // v8.0.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import CircuitBreaker from 'opossum'; // v6.0.0
import rateLimit from 'express-rate-limit'; // v6.0.0

// Internal dependencies
import { CodeUpdateHandler } from './handlers/CodeUpdateHandler';
import { GraphUpdateHandler } from './handlers/GraphUpdateHandler';
import { ValidationHandler } from './handlers/ValidationHandler';
import { Logger } from '../utils/logger';

// Message type constants
const MESSAGE_TYPES = {
  CODE_UPDATE: 'code_update',
  GRAPH_UPDATE: 'graph_update',
  VALIDATION_REQUEST: 'validation_request',
  GRAPH_SUBSCRIPTION: 'graph_subscription',
  HEARTBEAT: 'heartbeat',
  ERROR: 'error'
} as const;

// Default configuration
const DEFAULT_CONFIG = {
  MAX_CONNECTIONS: 1000,
  MESSAGE_RATE_LIMIT: 100,
  HEARTBEAT_INTERVAL: 30000,
  CIRCUIT_BREAKER_TIMEOUT: 10000
};

/**
 * Manages WebSocket connections and message routing with production-ready features
 * including connection pooling, rate limiting, and circuit breaker patterns.
 */
export class WebSocketManager {
  private static instance: WebSocketManager;
  private readonly clients: Map<string, WebSocket>;
  private readonly codeUpdateHandler: CodeUpdateHandler;
  private readonly graphUpdateHandler: GraphUpdateHandler;
  private readonly validationHandler: ValidationHandler;
  private readonly logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly maxConnections: number;
  private readonly messageRateLimit: number;
  private readonly clientMessageCounts: Map<string, number>;

  /**
   * Private constructor implementing singleton pattern
   */
  private constructor(maxConnections: number = DEFAULT_CONFIG.MAX_CONNECTIONS, 
                     messageRateLimit: number = DEFAULT_CONFIG.MESSAGE_RATE_LIMIT) {
    this.clients = new Map();
    this.clientMessageCounts = new Map();
    this.maxConnections = maxConnections;
    this.messageRateLimit = messageRateLimit;
    this.logger = Logger.getInstance();

    // Initialize handlers
    this.codeUpdateHandler = new CodeUpdateHandler();
    this.graphUpdateHandler = GraphUpdateHandler.getInstance();
    this.validationHandler = new ValidationHandler();

    // Configure circuit breaker for message handling
    this.circuitBreaker = new CircuitBreaker(
      async (data: any) => this.routeMessage(data.clientId, data.message),
      {
        timeout: DEFAULT_CONFIG.CIRCUIT_BREAKER_TIMEOUT,
        errorThresholdPercentage: 50,
        resetTimeout: 30000
      }
    );

    this.setupCircuitBreakerEvents();
    this.startPeriodicCleanup();
  }

  /**
   * Gets or creates the singleton instance
   */
  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Handles new WebSocket connections with validation and rate limiting
   */
  public async handleConnection(socket: WebSocket): Promise<void> {
    try {
      // Check connection limit
      if (this.clients.size >= this.maxConnections) {
        socket.close(1013, 'Maximum connections reached');
        return;
      }

      // Generate client ID and add to clients map
      const clientId = uuidv4();
      this.clients.set(clientId, socket);
      this.clientMessageCounts.set(clientId, 0);

      // Set up client event handlers
      this.setupClientHandlers(socket, clientId);

      // Start heartbeat monitoring
      this.startHeartbeat(socket, clientId);

      this.logger.info('New WebSocket connection established', { clientId });

    } catch (error) {
      this.logger.error('Failed to handle connection', { error });
      socket.close(1011, 'Internal server error');
    }
  }

  /**
   * Handles client disconnection with cleanup
   */
  public handleDisconnection(clientId: string): void {
    try {
      const client = this.clients.get(clientId);
      if (client) {
        // Clean up subscriptions and handlers
        this.graphUpdateHandler.unsubscribeFromGraph(clientId, client);
        this.clients.delete(clientId);
        this.clientMessageCounts.delete(clientId);
      }

      this.logger.info('Client disconnected', { clientId });
    } catch (error) {
      this.logger.error('Error handling disconnection', { clientId, error });
    }
  }

  /**
   * Routes incoming messages to appropriate handlers with rate limiting
   */
  private async routeMessage(clientId: string, data: WebSocket.Data): Promise<void> {
    try {
      // Check rate limit
      if (!this.checkRateLimit(clientId)) {
        throw new Error('Rate limit exceeded');
      }

      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);

      if (!client) {
        throw new Error('Client not found');
      }

      switch (message.type) {
        case MESSAGE_TYPES.CODE_UPDATE:
          await this.codeUpdateHandler.handleCodeUpdate(
            client,
            clientId,
            message.content
          );
          break;

        case MESSAGE_TYPES.GRAPH_UPDATE:
          await this.graphUpdateHandler.handleGraphUpdate(
            message.graphId,
            message.graph
          );
          break;

        case MESSAGE_TYPES.VALIDATION_REQUEST:
          await this.validationHandler.handleValidationRequest(
            client,
            message
          );
          break;

        case MESSAGE_TYPES.GRAPH_SUBSCRIPTION:
          this.graphUpdateHandler.subscribeToGraph(message.graphId, client);
          break;

        case MESSAGE_TYPES.HEARTBEAT:
          client.send(JSON.stringify({ type: MESSAGE_TYPES.HEARTBEAT }));
          break;

        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }

      // Update message count
      this.updateMessageCount(clientId);

    } catch (error) {
      this.logger.error('Error routing message', { clientId, error });
      this.sendErrorMessage(clientId, error.message);
    }
  }

  /**
   * Sets up WebSocket client event handlers
   */
  private setupClientHandlers(socket: WebSocket, clientId: string): void {
    socket.on('message', async (data) => {
      try {
        await this.circuitBreaker.fire({ clientId, message: data });
      } catch (error) {
        this.logger.error('Circuit breaker error', { clientId, error });
        this.sendErrorMessage(clientId, 'Service temporarily unavailable');
      }
    });

    socket.on('close', () => {
      this.handleDisconnection(clientId);
    });

    socket.on('error', (error) => {
      this.logger.error('WebSocket error', { clientId, error });
      this.handleDisconnection(clientId);
    });
  }

  /**
   * Implements heartbeat mechanism for connection monitoring
   */
  private startHeartbeat(socket: WebSocket, clientId: string): void {
    const interval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.ping();
      } else {
        clearInterval(interval);
        this.handleDisconnection(clientId);
      }
    }, DEFAULT_CONFIG.HEARTBEAT_INTERVAL);

    socket.on('pong', () => {
      // Reset client's inactivity timer
      this.clientMessageCounts.set(clientId, 0);
    });
  }

  /**
   * Checks if client has exceeded rate limit
   */
  private checkRateLimit(clientId: string): boolean {
    const count = this.clientMessageCounts.get(clientId) || 0;
    return count < this.messageRateLimit;
  }

  /**
   * Updates client message count for rate limiting
   */
  private updateMessageCount(clientId: string): void {
    const count = this.clientMessageCounts.get(clientId) || 0;
    this.clientMessageCounts.set(clientId, count + 1);
  }

  /**
   * Sends error message to client
   */
  private sendErrorMessage(clientId: string, message: string): void {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: MESSAGE_TYPES.ERROR,
        message
      }));
    }
  }

  /**
   * Sets up circuit breaker event handlers
   */
  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Circuit breaker half-open');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Circuit breaker closed');
    });
  }

  /**
   * Starts periodic cleanup of inactive connections
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (client.readyState !== WebSocket.OPEN) {
          this.handleDisconnection(clientId);
        }
      }
    }, DEFAULT_CONFIG.HEARTBEAT_INTERVAL);
  }
}

export default WebSocketManager.getInstance();