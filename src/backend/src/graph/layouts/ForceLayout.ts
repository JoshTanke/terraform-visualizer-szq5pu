import { GraphLayout } from '../GraphLayout';
import { IGraph, INode, IEdge, NodeType, ValidationStatus } from '../../interfaces/IGraph';
import { 
  forceSimulation, 
  forceManyBody, 
  forceLink, 
  forceCollide, 
  forceCenter,
  forceX,
  forceY,
  Simulation
} from 'd3-force';

/**
 * Configuration options for force-directed layout
 */
export interface ForceLayoutOptions {
  /** Force strength between nodes */
  strength?: number;
  /** Ideal distance between nodes */
  distance?: number;
  /** Number of simulation iterations */
  iterations?: number;
  /** Repulsive force between nodes */
  charge?: number;
  /** Current view type */
  viewType: 'pipeline' | 'environment' | 'module';
  /** Simulation damping factor */
  damping?: number;
  /** Node collision detection radius */
  collisionRadius?: number;
  /** Strength of clustering force */
  clusterStrength?: number;
}

/**
 * Default configuration values for force layout
 */
const DEFAULT_FORCE_OPTIONS: ForceLayoutOptions = {
  strength: -30,
  distance: 100,
  iterations: 300,
  charge: -400,
  viewType: 'module',
  damping: 0.3,
  collisionRadius: 30,
  clusterStrength: 0.5
};

/**
 * Implements an optimized force-directed graph layout algorithm using D3-force
 * with view-specific configurations and enhanced performance features.
 */
export class ForceLayout extends GraphLayout {
  private options: ForceLayoutOptions;
  private simulation: Simulation<INode, IEdge>;
  private layoutCache: Map<string, IGraph>;

  /**
   * Initializes the force layout with enhanced options
   * @param options - Force layout configuration options
   */
  constructor(options: Partial<ForceLayoutOptions>) {
    super({ width: 1200, height: 800, fitView: true });
    this.options = { ...DEFAULT_FORCE_OPTIONS, ...options };
    this.layoutCache = new Map();
  }

  /**
   * Applies optimized force-directed layout to the graph
   * @param graph - Input graph to be laid out
   * @returns Promise resolving to graph with updated node positions
   */
  public async layout(graph: IGraph): Promise<IGraph> {
    // Validate input graph
    this.validateGraph(graph);

    // Check cache for existing layout
    const cacheKey = this.getCacheKey(graph);
    if (this.layoutCache.has(cacheKey)) {
      return this.layoutCache.get(cacheKey)!;
    }

    // Initialize simulation with nodes and edges
    this.simulation = this.initializeSimulation(graph.nodes, graph.edges);

    // Apply view-specific configurations
    this.applyViewConfigurations(graph);

    // Run simulation
    await this.runSimulation();

    // Update node positions
    graph.nodes.forEach(node => {
      if (node.position && !isNaN(node.position.x) && !isNaN(node.position.y)) {
        node.position = {
          x: Math.max(0, Math.min(this.options.width!, node.position.x)),
          y: Math.max(0, Math.min(this.options.height!, node.position.y))
        };
      }
    });

    // Cache the layout result
    this.layoutCache.set(cacheKey, graph);

    return graph;
  }

  /**
   * Initializes the D3 force simulation with optimized parameters
   * @param nodes - Array of graph nodes
   * @param edges - Array of graph edges
   * @returns Configured D3 force simulation
   */
  private initializeSimulation(nodes: INode[], edges: IEdge[]): Simulation<INode, IEdge> {
    const simulation = forceSimulation<INode>(nodes)
      .force('charge', forceManyBody()
        .strength(this.options.charge!)
        .distanceMax(300)
      )
      .force('link', forceLink<INode, IEdge>(edges)
        .id(d => d.id)
        .distance(this.options.distance!)
        .strength(this.options.strength!)
      )
      .force('collide', forceCollide<INode>()
        .radius(this.options.collisionRadius!)
        .strength(0.7)
      )
      .force('center', forceCenter(
        this.options.width! / 2,
        this.options.height! / 2
      ))
      .force('x', forceX().strength(0.05))
      .force('y', forceY().strength(0.05))
      .alphaDecay(this.options.damping!)
      .alphaMin(0.001);

    return simulation;
  }

  /**
   * Applies view-specific force configurations
   * @param graph - Input graph
   */
  private applyViewConfigurations(graph: IGraph): void {
    switch (this.options.viewType) {
      case 'pipeline':
        this.applyPipelineForces(graph);
        break;
      case 'environment':
        this.applyEnvironmentForces(graph);
        break;
      case 'module':
        this.applyModuleForces(graph);
        break;
    }
  }

  /**
   * Applies pipeline-specific force configurations
   * @param graph - Input graph
   */
  private applyPipelineForces(graph: IGraph): void {
    this.simulation
      .force('charge', forceManyBody().strength(-600))
      .force('link', forceLink<INode, IEdge>(graph.edges)
        .distance(200)
        .strength(1)
      );
  }

  /**
   * Applies environment-specific force configurations
   * @param graph - Input graph
   */
  private applyEnvironmentForces(graph: IGraph): void {
    this.simulation
      .force('charge', forceManyBody().strength(-400))
      .force('link', forceLink<INode, IEdge>(graph.edges)
        .distance(150)
        .strength(0.7)
      );
  }

  /**
   * Applies module-specific force configurations
   * @param graph - Input graph
   */
  private applyModuleForces(graph: IGraph): void {
    this.simulation
      .force('charge', forceManyBody().strength(-300))
      .force('link', forceLink<INode, IEdge>(graph.edges)
        .distance(100)
        .strength(0.5)
      );
  }

  /**
   * Runs the force simulation with optimized iterations
   */
  private async runSimulation(): Promise<void> {
    return new Promise((resolve) => {
      // Warm-up phase
      this.simulation.alpha(0.3).restart();

      // Main simulation phase
      this.simulation
        .on('tick', () => {
          // Check convergence
          if (this.simulation.alpha() < this.simulation.alphaMin()) {
            this.simulation.stop();
            resolve();
          }
        })
        .on('end', () => {
          resolve();
        });

      // Force simulation to run specified iterations
      for (let i = 0; i < this.options.iterations!; ++i) {
        this.simulation.tick();
      }
    });
  }

  /**
   * Generates a cache key for layout results
   * @param graph - Input graph
   * @returns Cache key string
   */
  private getCacheKey(graph: IGraph): string {
    return `${this.options.viewType}-${graph.nodes.length}-${graph.edges.length}`;
  }
}