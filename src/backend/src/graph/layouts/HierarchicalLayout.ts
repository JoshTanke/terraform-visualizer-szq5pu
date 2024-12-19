import { GraphLayout, LayoutOptions } from '../GraphLayout';
import { IGraph, INode, IEdge, NodeType, ValidationStatus } from '../../interfaces/IGraph';
import * as dagre from 'dagre';

/**
 * Performance optimization constants for hierarchical layout
 */
const PERFORMANCE_CONSTANTS = {
  DEFAULT_NODE_SEPARATION: 100,
  DEFAULT_RANK_SEPARATION: 150,
  DEFAULT_MAX_NODES_PER_RANK: 20,
  BATCH_SIZE: 25,
  LAYOUT_TIMEOUT_MS: 1000,
  CACHE_EXPIRY_MS: 5000
};

/**
 * Interface for enhanced hierarchical layout configuration options
 */
export interface HierarchicalLayoutOptions extends LayoutOptions {
  /** Horizontal spacing between nodes */
  nodeSeparation?: number;
  /** Vertical spacing between ranks */
  rankSeparation?: number;
  /** Whether to center the graph after layout */
  centerGraph?: boolean;
  /** Maximum nodes per rank for performance optimization */
  maxNodesPerRank?: number;
  /** Current view type for layout optimization */
  viewType: 'pipeline' | 'environment' | 'module';
  /** Enable graph compaction for dense layouts */
  enableCompaction?: boolean;
}

/**
 * Implements a performance-optimized hierarchical layout algorithm for Terraform infrastructure visualization
 */
export class HierarchicalLayout extends GraphLayout {
  private nodeSeparation: number;
  private rankSeparation: number;
  private centerGraph: boolean;
  private maxNodesPerRank: number;
  private enableCompaction: boolean;
  private layoutCache: Map<string, { positions: Map<string, { x: number, y: number }>, timestamp: number }>;

  /**
   * Initializes the hierarchical layout with enhanced configuration options
   * @param options - Layout configuration options including performance settings
   */
  constructor(options: Partial<HierarchicalLayoutOptions>) {
    super(options);
    
    this.nodeSeparation = options.nodeSeparation || PERFORMANCE_CONSTANTS.DEFAULT_NODE_SEPARATION;
    this.rankSeparation = options.rankSeparation || PERFORMANCE_CONSTANTS.DEFAULT_RANK_SEPARATION;
    this.centerGraph = options.centerGraph !== undefined ? options.centerGraph : true;
    this.maxNodesPerRank = options.maxNodesPerRank || PERFORMANCE_CONSTANTS.DEFAULT_MAX_NODES_PER_RANK;
    this.enableCompaction = options.enableCompaction !== undefined ? options.enableCompaction : true;
    this.layoutCache = new Map();

    // Adjust layout parameters based on view type
    this.optimizeForViewType(options.viewType || 'module');
  }

  /**
   * Applies optimized hierarchical layout algorithm to position nodes
   * @param graph - Graph to be laid out
   * @returns Promise resolving to graph with updated node positions
   */
  public async layout(graph: IGraph): Promise<IGraph> {
    try {
      // Validate input graph
      this.validateGraph(graph);

      // Check cache for recent layout
      const cacheKey = this.generateCacheKey(graph);
      const cachedLayout = this.layoutCache.get(cacheKey);
      if (this.isCacheValid(cachedLayout)) {
        return this.applyCachedLayout(graph, cachedLayout.positions);
      }

      // Initialize dagre graph with optimized settings
      const g = new dagre.graphlib.Graph();
      g.setGraph({
        rankdir: 'TB',
        nodesep: this.nodeSeparation,
        ranksep: this.rankSeparation,
        rankLimit: this.maxNodesPerRank,
        acyclicer: 'greedy',
        ranker: 'network-simplex'
      });
      g.setDefaultEdgeLabel(() => ({}));

      // Add nodes in batches for performance
      for (let i = 0; i < graph.nodes.length; i += PERFORMANCE_CONSTANTS.BATCH_SIZE) {
        const batch = graph.nodes.slice(i, i + PERFORMANCE_CONSTANTS.BATCH_SIZE);
        this.addNodeBatch(g, batch);
        await this.yieldToMainThread();
      }

      // Add edges with optimized weight calculation
      this.addEdgesWithWeights(g, graph.edges);

      // Apply layout with timeout protection
      const layoutPromise = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Layout calculation timeout'));
        }, PERFORMANCE_CONSTANTS.LAYOUT_TIMEOUT_MS);

        try {
          dagre.layout(g);
          clearTimeout(timeoutId);
          resolve();
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      await layoutPromise;

      // Extract and apply node positions
      const positions = new Map<string, { x: number, y: number }>();
      graph.nodes.forEach(node => {
        const dagreNode = g.node(node.id);
        positions.set(node.id, { x: dagreNode.x, y: dagreNode.y });
      });

      // Cache the layout results
      this.layoutCache.set(cacheKey, {
        positions,
        timestamp: Date.now()
      });

      // Apply positions to graph
      this.applyPositions(graph, positions);

      // Apply optional graph compaction
      if (this.enableCompaction) {
        this.compactGraph(graph);
      }

      // Center the graph if enabled
      if (this.centerGraph) {
        this.centerGraphLayout(graph);
      }

      return graph;
    } catch (error) {
      console.error('Hierarchical layout error:', error);
      throw error;
    }
  }

  /**
   * Centers the graph using optimized bounds calculation
   * @param graph - Graph to be centered
   */
  private centerGraphLayout(graph: IGraph): void {
    if (graph.nodes.length === 0) return;

    // Calculate bounds efficiently
    const bounds = graph.nodes.reduce((acc, node) => {
      acc.minX = Math.min(acc.minX, node.position.x);
      acc.minY = Math.min(acc.minY, node.position.y);
      acc.maxX = Math.max(acc.maxX, node.position.x);
      acc.maxY = Math.max(acc.maxY, node.position.y);
      return acc;
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    // Calculate center offset
    const offsetX = (this.options.width - (bounds.maxX - bounds.minX)) / 2 - bounds.minX;
    const offsetY = (this.options.height - (bounds.maxY - bounds.minY)) / 2 - bounds.minY;

    // Apply offset to all nodes
    graph.nodes.forEach(node => {
      node.position.x += offsetX;
      node.position.y += offsetY;
    });
  }

  /**
   * Optimizes layout parameters based on view type
   * @param viewType - Current view type
   */
  private optimizeForViewType(viewType: string): void {
    switch (viewType.toLowerCase()) {
      case 'pipeline':
        this.nodeSeparation = 200;
        this.rankSeparation = 150;
        break;
      case 'environment':
        this.nodeSeparation = 150;
        this.rankSeparation = 200;
        break;
      case 'module':
        this.nodeSeparation = 100;
        this.rankSeparation = 150;
        break;
    }
  }

  /**
   * Adds a batch of nodes to the dagre graph
   * @param g - Dagre graph instance
   * @param nodes - Batch of nodes to add
   */
  private addNodeBatch(g: dagre.graphlib.Graph, nodes: INode[]): void {
    nodes.forEach(node => {
      g.setNode(node.id, {
        width: node.position.width || 50,
        height: node.position.height || 50,
        weight: this.calculateNodeWeight(node)
      });
    });
  }

  /**
   * Adds edges with calculated weights to the dagre graph
   * @param g - Dagre graph instance
   * @param edges - Graph edges
   */
  private addEdgesWithWeights(g: dagre.graphlib.Graph, edges: IEdge[]): void {
    edges.forEach(edge => {
      g.setEdge(edge.source, edge.target, {
        weight: edge.weight || 1,
        minlen: this.calculateEdgeLength(edge)
      });
    });
  }

  /**
   * Calculates node weight based on type and validation status
   * @param node - Graph node
   * @returns Calculated weight
   */
  private calculateNodeWeight(node: INode): number {
    let weight = 1;
    
    // Adjust weight based on node type
    switch (node.type) {
      case NodeType.MODULE:
        weight *= 2;
        break;
      case NodeType.RESOURCE:
        weight *= 1.5;
        break;
    }

    // Adjust weight based on validation status
    if (node.validationStatus === ValidationStatus.ERROR) {
      weight *= 1.5;
    }

    return weight;
  }

  /**
   * Calculates minimum edge length based on edge type
   * @param edge - Graph edge
   * @returns Minimum edge length
   */
  private calculateEdgeLength(edge: IEdge): number {
    return edge.type === 'module_link' ? 2 : 1;
  }

  /**
   * Generates cache key for graph layout
   * @param graph - Input graph
   * @returns Cache key string
   */
  private generateCacheKey(graph: IGraph): string {
    return `${graph.nodes.length}-${graph.edges.length}-${this.options.viewType}`;
  }

  /**
   * Checks if cached layout is still valid
   * @param cache - Cached layout data
   * @returns True if cache is valid
   */
  private isCacheValid(cache: { timestamp: number } | undefined): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < PERFORMANCE_CONSTANTS.CACHE_EXPIRY_MS;
  }

  /**
   * Yields to main thread for performance optimization
   * @returns Promise that resolves after yielding
   */
  private async yieldToMainThread(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }
}