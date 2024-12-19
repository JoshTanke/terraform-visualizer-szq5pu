import { IGraph, INode, IEdge, ValidationStatus } from '../interfaces/IGraph';

/**
 * Default values for layout configuration
 */
const DEFAULT_OPTIONS = {
  width: 1200,
  height: 800,
  fitView: true,
  padding: 50,
  aspectRatio: 16/9,
  viewType: 'module'
};

/**
 * Performance constraints for graph layouts
 */
const PERFORMANCE_CONSTRAINTS = {
  MAX_NODES: 100,
  MIN_NODE_SPACING: 50,
  MAX_RENDER_TIME_MS: 1000,
  BATCH_SIZE: 25
};

/**
 * Interface defining enhanced configuration options for graph layout algorithms
 */
export interface LayoutOptions {
  /** Width of the layout area in pixels */
  width: number;
  
  /** Height of the layout area in pixels */
  height: number;
  
  /** Whether to fit the graph to the view */
  fitView: boolean;
  
  /** Optional padding around the graph layout */
  padding?: number;
  
  /** Optional aspect ratio to maintain during layout */
  aspectRatio?: number;
  
  /** Type of view (Pipeline, Environment, Module) */
  viewType: string;
}

/**
 * Enhanced abstract base class for graph layout algorithms with optimized performance features.
 * Provides core layout capabilities and validation for infrastructure visualization.
 */
export abstract class GraphLayout {
  protected options: LayoutOptions;
  protected maxNodes: number;
  
  /**
   * Initializes the layout with enhanced configuration options
   * @param options - Layout configuration options
   */
  constructor(options: Partial<LayoutOptions>) {
    // Initialize layout options with defaults
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    };
    
    // Set performance constraints
    this.maxNodes = PERFORMANCE_CONSTRAINTS.MAX_NODES;
    
    // Validate initial options
    this.validateOptions();
  }
  
  /**
   * Abstract method to be implemented by specific layout algorithms
   * @param graph - Input graph to be laid out
   * @returns Graph with updated node positions
   */
  abstract layout(graph: IGraph): Promise<IGraph>;
  
  /**
   * Enhanced graph validation with performance optimizations
   * @param graph - Graph to validate
   * @returns True if graph is valid
   * @throws Error if graph is invalid with detailed context
   */
  protected validateGraph(graph: IGraph): boolean {
    // Check if graph is defined
    if (!graph) {
      throw new Error('Graph is undefined');
    }
    
    // Validate nodes array exists and check performance limits
    if (!Array.isArray(graph.nodes)) {
      throw new Error('Graph nodes must be an array');
    }
    
    if (graph.nodes.length > this.maxNodes) {
      throw new Error(
        `Graph exceeds maximum node limit of ${this.maxNodes}. ` +
        `Current nodes: ${graph.nodes.length}`
      );
    }
    
    // Validate edges array exists
    if (!Array.isArray(graph.edges)) {
      throw new Error('Graph edges must be an array');
    }
    
    // Use Set for efficient duplicate node ID detection
    const nodeIds = new Set<string>();
    for (const node of graph.nodes) {
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate node ID found: ${node.id}`);
      }
      nodeIds.add(node.id);
    }
    
    // Validate edge references and collect validation errors
    const validationErrors: string[] = [];
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.source)) {
        validationErrors.push(`Edge ${edge.id} references non-existent source node: ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        validationErrors.push(`Edge ${edge.id} references non-existent target node: ${edge.target}`);
      }
    }
    
    if (validationErrors.length > 0) {
      throw new Error(`Graph validation failed:\n${validationErrors.join('\n')}`);
    }
    
    // Check node positions within bounds
    for (const node of graph.nodes) {
      if (node.position) {
        if (node.position.x < 0 || node.position.x > this.options.width ||
            node.position.y < 0 || node.position.y > this.options.height) {
          node.validationStatus = ValidationStatus.WARNING;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Optimized graph fitting with enhanced options
   * @param graph - Graph to fit to view
   * @returns Graph with adjusted node positions
   */
  protected fitToView(graph: IGraph): IGraph {
    if (!this.options.fitView) {
      return graph;
    }
    
    // Calculate current graph bounds efficiently
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const node of graph.nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x);
      maxY = Math.max(maxY, node.position.y);
    }
    
    // Apply padding if specified
    const padding = this.options.padding || 0;
    const availableWidth = this.options.width - (2 * padding);
    const availableHeight = this.options.height - (2 * padding);
    
    // Calculate graph dimensions
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    
    // Maintain aspect ratio if required
    let scale = 1;
    if (this.options.aspectRatio) {
      const targetRatio = this.options.aspectRatio;
      const currentRatio = graphWidth / graphHeight;
      
      if (currentRatio > targetRatio) {
        scale = availableWidth / graphWidth;
      } else {
        scale = availableHeight / graphHeight;
      }
    } else {
      // Calculate optimal scale factors
      const scaleX = availableWidth / graphWidth;
      const scaleY = availableHeight / graphHeight;
      scale = Math.min(scaleX, scaleY);
    }
    
    // Apply scaling and centering to node positions
    const centerX = this.options.width / 2;
    const centerY = this.options.height / 2;
    
    for (const node of graph.nodes) {
      node.position.x = ((node.position.x - minX) * scale) + padding;
      node.position.y = ((node.position.y - minY) * scale) + padding;
    }
    
    return graph;
  }
  
  /**
   * Validates layout options
   * @throws Error if options are invalid
   */
  private validateOptions(): void {
    if (this.options.width <= 0 || this.options.height <= 0) {
      throw new Error('Layout dimensions must be positive numbers');
    }
    
    if (this.options.padding && this.options.padding < 0) {
      throw new Error('Padding must be a non-negative number');
    }
    
    if (this.options.aspectRatio && this.options.aspectRatio <= 0) {
      throw new Error('Aspect ratio must be a positive number');
    }
    
    const validViewTypes = ['pipeline', 'environment', 'module'];
    if (!validViewTypes.includes(this.options.viewType.toLowerCase())) {
      throw new Error(`Invalid view type. Must be one of: ${validViewTypes.join(', ')}`);
    }
  }
}