/**
 * @fileoverview Enhanced service class for managing graph visualization data and real-time updates
 * with improved error handling, caching, and performance optimizations.
 * @version 1.0.0
 */

import { debounce } from 'lodash'; // ^4.17.21
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.11
import { IGraph, LayoutType, isIGraph } from '../interfaces/IGraph';
import { ApiService } from './api.service';
import { WebSocketService } from './websocket.service';
import { DagreLayout } from '../layouts/DagreLayout';

/**
 * Error types specific to graph operations
 */
enum GraphErrorType {
  LAYOUT_ERROR = 'LAYOUT_ERROR',
  UPDATE_ERROR = 'UPDATE_ERROR',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

/**
 * Interface for graph update callback functions
 */
interface UpdateCallback {
  onUpdate: (graph: IGraph) => void;
  onError: (error: Error) => void;
}

/**
 * Enhanced service class for managing graph visualization data and real-time updates
 */
export class GraphService {
  private readonly apiService: ApiService;
  private readonly wsService: WebSocketService;
  private readonly dagreLayout: DagreLayout;
  private readonly updateCallbacks: Map<string, UpdateCallback>;
  private readonly graphCache: Map<string, { graph: IGraph; timestamp: number }>;
  private readonly maxReconnectAttempts: number;
  private reconnectAttempts: number;
  private readonly cacheDuration: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Initializes the graph service with required dependencies and enhanced error handling
   */
  constructor(
    apiService: ApiService,
    wsService: WebSocketService,
    maxReconnectAttempts: number = 5
  ) {
    this.apiService = apiService;
    this.wsService = wsService;
    this.dagreLayout = new DagreLayout({
      enableEdgeBundling: true,
      progressiveRendering: true
    });
    this.updateCallbacks = new Map();
    this.graphCache = new Map();
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.reconnectAttempts = 0;

    // Initialize WebSocket event handlers
    this.initializeWebSocketHandlers();
  }

  /**
   * Retrieves and processes graph data for a module with caching and error handling
   */
  public async getGraph(moduleId: string): Promise<IGraph> {
    try {
      // Check cache first
      const cachedData = this.graphCache.get(moduleId);
      if (cachedData && Date.now() - cachedData.timestamp < this.cacheDuration) {
        return cachedData.graph;
      }

      // Fetch fresh data
      const graph = await this.apiService.getGraph(moduleId);
      
      // Validate graph data
      if (!isIGraph(graph)) {
        throw new Error('Invalid graph data received from API');
      }

      // Apply layout
      const processedGraph = this.dagreLayout.layout(graph);

      // Update cache
      this.graphCache.set(moduleId, {
        graph: processedGraph,
        timestamp: Date.now()
      });

      return processedGraph;
    } catch (error) {
      console.error('Error fetching graph:', error);
      throw new Error(`Failed to fetch graph: ${(error as Error).message}`);
    }
  }

  /**
   * Updates graph layout with debounced calculations for performance
   */
  public updateLayout = debounce(
    (graph: IGraph, layoutType: LayoutType): IGraph => {
      try {
        // Validate input
        if (!isIGraph(graph)) {
          throw new Error('Invalid graph data provided for layout update');
        }

        // Apply new layout
        const updatedGraph = this.dagreLayout.layout({
          ...graph,
          layout: layoutType
        });

        // Update cache if module ID is present
        if (updatedGraph.metadata?.moduleId) {
          this.graphCache.set(updatedGraph.metadata.moduleId, {
            graph: updatedGraph,
            timestamp: Date.now()
          });
        }

        return updatedGraph;
      } catch (error) {
        console.error('Layout update error:', error);
        throw new Error(`Layout update failed: ${(error as Error).message}`);
      }
    },
    250,
    { maxWait: 1000 }
  );

  /**
   * Enhanced subscription to real-time graph updates with error handling
   */
  public subscribeToUpdates(
    moduleId: string,
    onUpdate: (graph: IGraph) => void,
    onError: (error: Error) => void
  ): () => void {
    try {
      // Store callbacks
      this.updateCallbacks.set(moduleId, { onUpdate, onError });

      // Subscribe to WebSocket updates
      const unsubscribe = this.wsService.subscribe(
        'graph.update',
        async (data: any) => {
          try {
            if (data.moduleId === moduleId) {
              const updatedGraph = await this.processGraphUpdate(data);
              onUpdate(updatedGraph);
            }
          } catch (error) {
            onError(error as Error);
          }
        }
      );

      // Return cleanup function
      return () => {
        this.updateCallbacks.delete(moduleId);
        unsubscribe();
      };
    } catch (error) {
      console.error('Subscription error:', error);
      throw new Error(`Failed to subscribe to updates: ${(error as Error).message}`);
    }
  }

  /**
   * Handles WebSocket reconnection with exponential backoff
   */
  private async handleReconnection(moduleId: string): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const error = new Error('Maximum reconnection attempts reached');
      this.updateCallbacks.get(moduleId)?.onError(error);
      return false;
    }

    this.reconnectAttempts++;
    const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);

    try {
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      await this.wsService.connect();
      this.reconnectAttempts = 0;
      return true;
    } catch (error) {
      console.error('Reconnection failed:', error);
      return this.handleReconnection(moduleId);
    }
  }

  /**
   * Initializes WebSocket event handlers with error handling
   */
  private initializeWebSocketHandlers(): void {
    this.wsService.subscribe('graph.error', (error: any) => {
      console.error('Graph WebSocket error:', error);
      this.updateCallbacks.forEach(callback => {
        callback.onError(new Error(error.message || 'Unknown graph error'));
      });
    });

    this.wsService.subscribe('disconnect', async () => {
      this.updateCallbacks.forEach(async (callback, moduleId) => {
        try {
          const reconnected = await this.handleReconnection(moduleId);
          if (!reconnected) {
            callback.onError(new Error('WebSocket connection lost'));
          }
        } catch (error) {
          callback.onError(error as Error);
        }
      });
    });
  }

  /**
   * Processes incoming graph updates with validation and layout optimization
   */
  private async processGraphUpdate(data: any): Promise<IGraph> {
    try {
      if (!isIGraph(data.graph)) {
        throw new Error('Invalid graph data received in update');
      }

      const updatedGraph = this.dagreLayout.layout(data.graph);

      // Update cache
      if (data.moduleId) {
        this.graphCache.set(data.moduleId, {
          graph: updatedGraph,
          timestamp: Date.now()
        });
      }

      return updatedGraph;
    } catch (error) {
      console.error('Graph update processing error:', error);
      throw new Error(`Failed to process graph update: ${(error as Error).message}`);
    }
  }

  /**
   * Cleans up resources and subscriptions
   */
  public dispose(): void {
    this.updateCallbacks.clear();
    this.graphCache.clear();
    this.reconnectAttempts = 0;
  }
}

export default GraphService;