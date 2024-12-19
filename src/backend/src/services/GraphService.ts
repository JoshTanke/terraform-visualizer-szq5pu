// External dependencies
import WebSocket from 'ws'; // v8.2.3

// Internal dependencies
import { IGraph, ValidationStatus } from '../interfaces/IGraph';
import { GraphBuilder } from '../graph/GraphBuilder';
import { CacheService } from './CacheService';
import { Logger } from '../utils/logger';
import { BaseError } from '../utils/errors';

/**
 * Custom error class for graph-specific errors
 */
class GraphError extends BaseError {
  constructor(message: string, code: string, metadata?: Record<string, any>) {
    super(message, code, 500, metadata);
  }
}

/**
 * Service responsible for managing graph operations, caching, and real-time updates
 * for Terraform infrastructure visualization across multiple view levels.
 * @version 1.0.0
 */
export class GraphService {
  private static instance: GraphService;
  private readonly graphBuilder: GraphBuilder;
  private readonly cacheService: CacheService;
  private readonly wsServer: WebSocket.Server;
  private readonly clients: Set<WebSocket>;
  private readonly logger: Logger;
  private readonly CACHE_TTL_SECONDS = 3600; // 1 hour

  /**
   * Private constructor implementing singleton pattern
   */
  private constructor() {
    this.graphBuilder = new GraphBuilder();
    this.cacheService = CacheService.getInstance();
    this.logger = Logger.getInstance();
    this.clients = new Set();

    // Initialize WebSocket server
    this.wsServer = new WebSocket.Server({
      port: parseInt(process.env.WS_PORT || '8080'),
      perMessageDeflate: true
    });

    this.setupWebSocketHandlers();
    this.logger.info('GraphService initialized successfully');
  }

  /**
   * Gets or creates singleton graph service instance
   */
  public static getInstance(): GraphService {
    if (!GraphService.instance) {
      GraphService.instance = new GraphService();
    }
    return GraphService.instance;
  }

  /**
   * Sets up WebSocket connection handlers
   */
  private setupWebSocketHandlers(): void {
    this.wsServer.on('connection', (client: WebSocket) => {
      this.handleWebSocketConnection(client);
    });

    this.wsServer.on('error', (error: Error) => {
      this.logger.error('WebSocket server error', { error });
    });
  }

  /**
   * Handles individual WebSocket client connections
   */
  private handleWebSocketConnection(client: WebSocket): void {
    this.clients.add(client);
    this.logger.info('New WebSocket client connected');

    client.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'subscribe' && data.graphId) {
          client.send(JSON.stringify({ type: 'subscribed', graphId: data.graphId }));
        }
      } catch (error) {
        this.logger.error('Error processing WebSocket message', { error });
      }
    });

    client.on('close', () => {
      this.clients.delete(client);
      this.logger.info('WebSocket client disconnected');
    });

    client.on('error', (error: Error) => {
      this.logger.error('WebSocket client error', { error });
      this.clients.delete(client);
    });
  }

  /**
   * Retrieves pipeline-level graph with caching
   */
  public async getPipelineGraph(projectId: string): Promise<IGraph> {
    try {
      const cacheKey = `pipeline:${projectId}`;
      const cachedGraph = await this.cacheService.get(cacheKey);

      if (cachedGraph) {
        return cachedGraph;
      }

      // Fetch environments from database (implementation depends on your data layer)
      const environments = await this.fetchEnvironments(projectId);
      const graph = this.graphBuilder.buildPipelineGraph(environments);

      await this.cacheService.set(cacheKey, graph, this.CACHE_TTL_SECONDS);
      return graph;
    } catch (error) {
      this.logger.error('Failed to get pipeline graph', { error, projectId });
      throw new GraphError(
        'Failed to generate pipeline graph',
        'GRAPH_PIPELINE_ERROR',
        { projectId }
      );
    }
  }

  /**
   * Retrieves environment-level graph with caching
   */
  public async getEnvironmentGraph(environmentId: string): Promise<IGraph> {
    try {
      const cacheKey = `environment:${environmentId}`;
      const cachedGraph = await this.cacheService.get(cacheKey);

      if (cachedGraph) {
        return cachedGraph;
      }

      // Fetch modules from database (implementation depends on your data layer)
      const modules = await this.fetchModules(environmentId);
      const graph = this.graphBuilder.buildEnvironmentGraph(modules);

      await this.cacheService.set(cacheKey, graph, this.CACHE_TTL_SECONDS);
      return graph;
    } catch (error) {
      this.logger.error('Failed to get environment graph', { error, environmentId });
      throw new GraphError(
        'Failed to generate environment graph',
        'GRAPH_ENVIRONMENT_ERROR',
        { environmentId }
      );
    }
  }

  /**
   * Retrieves module-level graph with caching
   */
  public async getModuleGraph(moduleId: string): Promise<IGraph> {
    try {
      const cacheKey = `module:${moduleId}`;
      const cachedGraph = await this.cacheService.get(cacheKey);

      if (cachedGraph) {
        return cachedGraph;
      }

      // Fetch resources from database (implementation depends on your data layer)
      const resources = await this.fetchResources(moduleId);
      const graph = this.graphBuilder.buildModuleGraph(resources);

      await this.cacheService.set(cacheKey, graph, this.CACHE_TTL_SECONDS);
      return graph;
    } catch (error) {
      this.logger.error('Failed to get module graph', { error, moduleId });
      throw new GraphError(
        'Failed to generate module graph',
        'GRAPH_MODULE_ERROR',
        { moduleId }
      );
    }
  }

  /**
   * Updates graph and broadcasts changes to connected clients
   */
  public async updateGraph(graphId: string, updatedGraph: IGraph): Promise<void> {
    try {
      const cacheKey = this.getCacheKeyFromGraphId(graphId);
      await this.cacheService.set(cacheKey, updatedGraph, this.CACHE_TTL_SECONDS);

      const updateMessage = JSON.stringify({
        type: 'graphUpdate',
        graphId,
        graph: updatedGraph
      });

      // Broadcast update to all connected clients
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(updateMessage);
        }
      });

      this.logger.info('Graph updated and broadcast', { graphId });
    } catch (error) {
      this.logger.error('Failed to update graph', { error, graphId });
      throw new GraphError(
        'Failed to update and broadcast graph',
        'GRAPH_UPDATE_ERROR',
        { graphId }
      );
    }
  }

  /**
   * Invalidates cached graph data
   */
  public async invalidateCache(graphId: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKeyFromGraphId(graphId);
      await this.cacheService.delete(cacheKey);

      // Notify clients about cache invalidation
      const invalidationMessage = JSON.stringify({
        type: 'cacheInvalidated',
        graphId
      });

      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(invalidationMessage);
        }
      });

      this.logger.info('Graph cache invalidated', { graphId });
    } catch (error) {
      this.logger.error('Failed to invalidate graph cache', { error, graphId });
      throw new GraphError(
        'Failed to invalidate graph cache',
        'GRAPH_CACHE_ERROR',
        { graphId }
      );
    }
  }

  /**
   * Helper method to determine cache key from graph ID
   */
  private getCacheKeyFromGraphId(graphId: string): string {
    const [type, id] = graphId.split(':');
    if (!type || !id) {
      throw new GraphError(
        'Invalid graph ID format',
        'GRAPH_ID_ERROR',
        { graphId }
      );
    }
    return graphId;
  }

  // Note: These methods should be implemented based on your data layer
  private async fetchEnvironments(projectId: string): Promise<any[]> {
    // Implementation depends on your data access layer
    return [];
  }

  private async fetchModules(environmentId: string): Promise<any[]> {
    // Implementation depends on your data access layer
    return [];
  }

  private async fetchResources(moduleId: string): Promise<any[]> {
    // Implementation depends on your data access layer
    return [];
  }
}

// Export singleton instance
export default GraphService.getInstance();