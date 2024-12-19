// External dependencies
import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { Logger } from 'winston'; // v3.8.2
import rateLimit from 'express-rate-limit'; // v6.7.0
import WebSocket from 'ws'; // v8.13.0
import CircuitBreaker from 'opossum'; // v6.0.0
import { v4 as uuidv4 } from 'uuid';

// Internal dependencies
import { IGraph } from '../../interfaces/IGraph';
import { GraphService } from '../../services/GraphService';
import { validateGraphStructure } from '../validators/graph.validator';
import { BaseError } from '../../utils/errors';

/**
 * Controller handling graph-related HTTP requests with enhanced real-time updates
 * and optimized performance for Terraform infrastructure visualization
 */
@Controller('/api/v1/graphs')
export class GraphController {
  private readonly graphService: GraphService;
  private readonly logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly wsServer: WebSocket.Server;
  private readonly subscribers: Map<string, Set<WebSocket>>;

  // Rate limiting configuration
  private static readonly rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
  });

  /**
   * Initializes the graph controller with enhanced dependencies
   */
  constructor(graphService: GraphService, logger: Logger, wsServer: WebSocket.Server) {
    this.graphService = graphService;
    this.logger = logger;
    this.wsServer = wsServer;
    this.subscribers = new Map();

    // Configure circuit breaker for service calls
    this.circuitBreaker = new CircuitBreaker(
      async (fn: Function) => await fn(),
      {
        timeout: 5000, // 5 seconds
        errorThresholdPercentage: 50,
        resetTimeout: 30000 // 30 seconds
      }
    );

    this.setupCircuitBreakerHandlers();
  }

  /**
   * Handles request for pipeline-level graph visualization
   */
  @asyncHandler
  @rateLimit(GraphController.rateLimiter)
  @validate(validateGraphStructure)
  public async getPipelineGraph(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const correlationId = uuidv4();
    this.logger.info('Pipeline graph request received', { correlationId });

    try {
      const projectId = req.params.projectId;
      if (!projectId) {
        throw new BaseError('Project ID is required', 'INVALID_REQUEST', 400);
      }

      const graph = await this.circuitBreaker.fire(
        async () => await this.graphService.getPipelineGraph(projectId)
      );

      // Validate graph structure
      await validateGraphStructure(graph);

      // Set up WebSocket subscription
      this.setupGraphSubscription(projectId, graph);

      res.status(200).json({
        success: true,
        data: graph,
        metadata: {
          correlationId,
          subscriptionEndpoint: `/ws/graphs/pipeline/${projectId}`
        }
      });

    } catch (error) {
      this.logger.error('Failed to get pipeline graph', {
        error,
        correlationId
      });
      next(error);
    }
  }

  /**
   * Handles request for environment-level graph visualization
   */
  @asyncHandler
  @rateLimit(GraphController.rateLimiter)
  @validate(validateGraphStructure)
  public async getEnvironmentGraph(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const correlationId = uuidv4();
    this.logger.info('Environment graph request received', { correlationId });

    try {
      const environmentId = req.params.environmentId;
      if (!environmentId) {
        throw new BaseError('Environment ID is required', 'INVALID_REQUEST', 400);
      }

      const graph = await this.circuitBreaker.fire(
        async () => await this.graphService.getEnvironmentGraph(environmentId)
      );

      // Validate graph structure
      await validateGraphStructure(graph);

      // Set up WebSocket subscription
      this.setupGraphSubscription(environmentId, graph);

      res.status(200).json({
        success: true,
        data: graph,
        metadata: {
          correlationId,
          subscriptionEndpoint: `/ws/graphs/environment/${environmentId}`
        }
      });

    } catch (error) {
      this.logger.error('Failed to get environment graph', {
        error,
        correlationId
      });
      next(error);
    }
  }

  /**
   * Handles request for module-level graph visualization
   */
  @asyncHandler
  @rateLimit(GraphController.rateLimiter)
  @validate(validateGraphStructure)
  public async getModuleGraph(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const correlationId = uuidv4();
    this.logger.info('Module graph request received', { correlationId });

    try {
      const moduleId = req.params.moduleId;
      if (!moduleId) {
        throw new BaseError('Module ID is required', 'INVALID_REQUEST', 400);
      }

      const graph = await this.circuitBreaker.fire(
        async () => await this.graphService.getModuleGraph(moduleId)
      );

      // Validate graph structure
      await validateGraphStructure(graph);

      // Set up WebSocket subscription
      this.setupGraphSubscription(moduleId, graph);

      res.status(200).json({
        success: true,
        data: graph,
        metadata: {
          correlationId,
          subscriptionEndpoint: `/ws/graphs/module/${moduleId}`
        }
      });

    } catch (error) {
      this.logger.error('Failed to get module graph', {
        error,
        correlationId
      });
      next(error);
    }
  }

  /**
   * Handles WebSocket connections for real-time graph updates
   */
  public handleWebSocketConnection(ws: WebSocket, req: Request): void {
    const graphId = req.params.graphId;
    if (!graphId) {
      ws.close(1002, 'Graph ID is required');
      return;
    }

    // Set up heartbeat monitoring
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    // Add subscriber
    if (!this.subscribers.has(graphId)) {
      this.subscribers.set(graphId, new Set());
    }
    this.subscribers.get(graphId)!.add(ws);

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'invalidateCache') {
          await this.graphService.invalidateCache(graphId);
        }
      } catch (error) {
        this.logger.error('WebSocket message handling error', { error });
      }
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      this.subscribers.get(graphId)?.delete(ws);
      if (this.subscribers.get(graphId)?.size === 0) {
        this.subscribers.delete(graphId);
      }
    });

    ws.on('error', (error) => {
      this.logger.error('WebSocket error', { error });
      ws.close(1011, 'Internal WebSocket error');
    });
  }

  /**
   * Sets up circuit breaker event handlers
   */
  private setupCircuitBreakerHandlers(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened - service calls disabled');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Circuit breaker half-open - testing service calls');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Circuit breaker closed - service calls enabled');
    });
  }

  /**
   * Sets up graph subscription for real-time updates
   */
  private setupGraphSubscription(graphId: string, initialGraph: IGraph): void {
    this.graphService.subscribeToUpdates(graphId, (updatedGraph: IGraph) => {
      const subscribers = this.subscribers.get(graphId);
      if (subscribers) {
        const message = JSON.stringify({
          type: 'graphUpdate',
          data: updatedGraph
        });

        subscribers.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }
    });
  }
}

export default GraphController;