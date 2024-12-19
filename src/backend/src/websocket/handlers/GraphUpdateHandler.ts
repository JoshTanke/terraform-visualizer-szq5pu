import WebSocket from 'ws'; // v8.0.0
import { Logger } from 'winston'; // v3.8.2
import { createGzip, createGunzip } from 'zlib'; // v1.0.0
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

import { IGraph } from '../../interfaces/IGraph';
import { GraphService } from '../../services/GraphService';
import { BaseError } from '../../utils/errors';

/**
 * Custom error class for graph update related errors
 */
class GraphUpdateError extends BaseError {
  constructor(message: string, code: string, metadata?: Record<string, any>) {
    super(message, code, 500, metadata);
  }
}

/**
 * Interface for client subscription metadata
 */
interface ClientMetadata {
  id: string;
  subscriptions: Set<string>;
  lastUpdate: number;
  updateCount: number;
  compressionEnabled: boolean;
}

/**
 * Handles real-time graph updates and client subscriptions with optimized performance
 * and enhanced security controls
 * @version 1.0.0
 */
export class GraphUpdateHandler {
  private static instance: GraphUpdateHandler;
  private readonly graphSubscriptions: Map<string, Set<WebSocket>>;
  private readonly clientMetadata: Map<WebSocket, ClientMetadata>;
  private readonly graphService: GraphService;
  private readonly logger: Logger;

  // Performance and security configurations
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly UPDATE_RATE_LIMIT = 50; // Updates per minute
  private readonly BATCH_UPDATE_INTERVAL = 100; // Milliseconds
  private readonly MAX_MESSAGE_SIZE = 1024 * 1024 * 5; // 5MB
  private readonly COMPRESSION_THRESHOLD = 1024 * 10; // 10KB

  private constructor() {
    this.graphSubscriptions = new Map();
    this.clientMetadata = new Map();
    this.graphService = GraphService.getInstance();
    this.logger = Logger.getInstance();

    // Initialize periodic cleanup
    setInterval(() => this.cleanupStaleConnections(), 60000);
  }

  /**
   * Gets or creates the singleton instance of GraphUpdateHandler
   */
  public static getInstance(): GraphUpdateHandler {
    if (!GraphUpdateHandler.instance) {
      GraphUpdateHandler.instance = new GraphUpdateHandler();
    }
    return GraphUpdateHandler.instance;
  }

  /**
   * Processes graph update events with optimized performance and security checks
   * @param graphId - Unique identifier of the graph
   * @param updatedGraph - Updated graph data
   */
  public async handleGraphUpdate(graphId: string, updatedGraph: IGraph): Promise<void> {
    const correlationId = uuidv4();
    
    try {
      this.logger.info('Processing graph update', {
        correlationId,
        graphId,
        nodeCount: updatedGraph.nodes.length
      });

      // Validate graph data
      this.validateGraphUpdate(updatedGraph);

      // Update graph in service
      await this.graphService.updateGraph(graphId, updatedGraph);

      // Get subscribed clients
      const subscribers = this.graphSubscriptions.get(graphId) || new Set();

      if (subscribers.size === 0) {
        return;
      }

      // Prepare update message
      const message = await this.prepareUpdateMessage(graphId, updatedGraph);

      // Broadcast to subscribers with batching
      await this.batchBroadcast(subscribers, message, correlationId);

    } catch (error) {
      this.logger.error('Failed to handle graph update', {
        correlationId,
        graphId,
        error
      });
      throw new GraphUpdateError(
        'Failed to process graph update',
        'GRAPH_UPDATE_ERROR',
        { correlationId, graphId }
      );
    }
  }

  /**
   * Manages client subscriptions with security and resource checks
   * @param graphId - Graph identifier to subscribe to
   * @param client - WebSocket client
   */
  public subscribeToGraph(graphId: string, client: WebSocket): void {
    try {
      // Initialize client metadata if not exists
      if (!this.clientMetadata.has(client)) {
        this.clientMetadata.set(client, {
          id: uuidv4(),
          subscriptions: new Set(),
          lastUpdate: Date.now(),
          updateCount: 0,
          compressionEnabled: true
        });
      }

      // Get or create subscription set for graph
      if (!this.graphSubscriptions.has(graphId)) {
        this.graphSubscriptions.set(graphId, new Set());
      }

      // Add client to subscribers
      this.graphSubscriptions.get(graphId)!.add(client);
      this.clientMetadata.get(client)!.subscriptions.add(graphId);

      // Setup client event handlers
      this.setupClientHandlers(client, graphId);

      this.logger.info('Client subscribed to graph', {
        clientId: this.clientMetadata.get(client)!.id,
        graphId
      });

    } catch (error) {
      this.logger.error('Subscription failed', { graphId, error });
      throw new GraphUpdateError(
        'Failed to subscribe to graph',
        'GRAPH_SUBSCRIPTION_ERROR',
        { graphId }
      );
    }
  }

  /**
   * Handles client unsubscription with cleanup
   * @param graphId - Graph identifier to unsubscribe from
   * @param client - WebSocket client
   */
  public unsubscribeFromGraph(graphId: string, client: WebSocket): void {
    try {
      // Remove client from graph subscribers
      const subscribers = this.graphSubscriptions.get(graphId);
      if (subscribers) {
        subscribers.delete(client);
        if (subscribers.size === 0) {
          this.graphSubscriptions.delete(graphId);
        }
      }

      // Update client metadata
      const metadata = this.clientMetadata.get(client);
      if (metadata) {
        metadata.subscriptions.delete(graphId);
        if (metadata.subscriptions.size === 0) {
          this.clientMetadata.delete(client);
        }
      }

      this.logger.info('Client unsubscribed from graph', {
        clientId: metadata?.id,
        graphId
      });

    } catch (error) {
      this.logger.error('Unsubscription failed', { graphId, error });
    }
  }

  /**
   * Validates graph update data for security and integrity
   * @param graph - Graph data to validate
   */
  private validateGraphUpdate(graph: IGraph): void {
    if (!graph || !graph.nodes || !graph.edges) {
      throw new GraphUpdateError(
        'Invalid graph data structure',
        'GRAPH_VALIDATION_ERROR'
      );
    }

    // Validate data size
    const dataSize = JSON.stringify(graph).length;
    if (dataSize > this.MAX_MESSAGE_SIZE) {
      throw new GraphUpdateError(
        'Graph data exceeds maximum size limit',
        'GRAPH_SIZE_ERROR',
        { size: dataSize, maxSize: this.MAX_MESSAGE_SIZE }
      );
    }
  }

  /**
   * Prepares update message with optional compression
   * @param graphId - Graph identifier
   * @param graph - Updated graph data
   */
  private async prepareUpdateMessage(graphId: string, graph: IGraph): Promise<Buffer> {
    const message = JSON.stringify({
      type: 'graphUpdate',
      graphId,
      data: graph,
      timestamp: Date.now()
    });

    if (message.length > this.COMPRESSION_THRESHOLD) {
      const gzip = promisify(createGzip);
      return await gzip(Buffer.from(message));
    }

    return Buffer.from(message);
  }

  /**
   * Broadcasts updates to subscribers in batches
   * @param subscribers - Set of subscribed clients
   * @param message - Prepared message buffer
   * @param correlationId - Correlation ID for tracking
   */
  private async batchBroadcast(
    subscribers: Set<WebSocket>,
    message: Buffer,
    correlationId: string
  ): Promise<void> {
    const batchSize = 50;
    const subscriberArray = Array.from(subscribers);

    for (let i = 0; i < subscriberArray.length; i += batchSize) {
      const batch = subscriberArray.slice(i, i + batchSize);
      await Promise.all(
        batch.map(client => this.sendToClient(client, message, correlationId))
      );
      await new Promise(resolve => setTimeout(resolve, this.BATCH_UPDATE_INTERVAL));
    }
  }

  /**
   * Sends message to individual client with rate limiting and error handling
   * @param client - WebSocket client
   * @param message - Message buffer
   * @param correlationId - Correlation ID for tracking
   */
  private async sendToClient(
    client: WebSocket,
    message: Buffer,
    correlationId: string
  ): Promise<void> {
    const metadata = this.clientMetadata.get(client);
    if (!metadata || !this.checkRateLimit(metadata)) {
      return;
    }

    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message, { binary: true }, (error) => {
          if (error) {
            this.logger.error('Failed to send update to client', {
              clientId: metadata.id,
              correlationId,
              error
            });
          }
        });
        metadata.lastUpdate = Date.now();
        metadata.updateCount++;
      }
    } catch (error) {
      this.logger.error('Error sending message to client', {
        clientId: metadata.id,
        correlationId,
        error
      });
    }
  }

  /**
   * Checks if client has exceeded rate limit
   * @param metadata - Client metadata
   */
  private checkRateLimit(metadata: ClientMetadata): boolean {
    const timeWindow = 60000; // 1 minute
    const now = Date.now();
    
    if (now - metadata.lastUpdate < timeWindow) {
      return metadata.updateCount < this.UPDATE_RATE_LIMIT;
    }
    
    metadata.updateCount = 0;
    return true;
  }

  /**
   * Sets up WebSocket client event handlers
   * @param client - WebSocket client
   * @param graphId - Graph identifier
   */
  private setupClientHandlers(client: WebSocket, graphId: string): void {
    client.on('error', (error) => {
      this.logger.error('Client connection error', {
        clientId: this.clientMetadata.get(client)?.id,
        graphId,
        error
      });
      this.unsubscribeFromGraph(graphId, client);
    });

    client.on('close', () => {
      this.unsubscribeFromGraph(graphId, client);
    });
  }

  /**
   * Cleans up stale connections periodically
   */
  private cleanupStaleConnections(): void {
    const staleThreshold = Date.now() - 300000; // 5 minutes

    for (const [client, metadata] of this.clientMetadata.entries()) {
      if (metadata.lastUpdate < staleThreshold) {
        metadata.subscriptions.forEach(graphId => {
          this.unsubscribeFromGraph(graphId, client);
        });
      }
    }
  }
}

// Export singleton instance
export default GraphUpdateHandler.getInstance();