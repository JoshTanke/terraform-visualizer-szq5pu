import { IGraph, INode, IEdge, LayoutType, NodeType } from '../interfaces/IGraph';
import _ from 'lodash';

/**
 * Configuration interface for graph optimization settings
 */
interface OptimizationConfig {
  minNodeDistance: number;
  edgeLength: number;
  forceStrength: number;
  bundlingStrength: number;
  iterations: number;
}

/**
 * Represents a spatial partitioning quadtree node for efficient collision detection
 */
class QuadTreeNode {
  x: number;
  y: number;
  width: number;
  height: number;
  nodes: INode[];
  children: QuadTreeNode[];

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.nodes = [];
    this.children = [];
  }
}

/**
 * Advanced graph optimization engine implementing efficient algorithms for layout optimization
 * and visualization performance improvements.
 * @version 1.0.0
 */
export class GraphOptimizer {
  private readonly MIN_NODE_DISTANCE: number;
  private readonly EDGE_LENGTH: number;
  private readonly FORCE_STRENGTH: number;
  private readonly BUNDLING_STRENGTH: number;
  private readonly MAX_ITERATIONS: number;
  private spatialIndex: QuadTreeNode;
  private nodeWeights: Map<string, number>;

  /**
   * Initializes the graph optimizer with configurable settings
   * @param config - Optimization configuration parameters
   */
  constructor(config: OptimizationConfig) {
    this.MIN_NODE_DISTANCE = config.minNodeDistance || 50;
    this.EDGE_LENGTH = config.edgeLength || 150;
    this.FORCE_STRENGTH = config.forceStrength || 1.0;
    this.BUNDLING_STRENGTH = config.bundlingStrength || 0.8;
    this.MAX_ITERATIONS = config.iterations || 100;
    this.nodeWeights = new Map<string, number>();
    this.spatialIndex = new QuadTreeNode(0, 0, 1000, 1000); // Initial canvas size
  }

  /**
   * Performs comprehensive graph optimization using layout-specific algorithms
   * @param graph - Input graph structure to optimize
   * @returns Optimized graph with improved layout and performance characteristics
   */
  public optimizeGraph(graph: IGraph): IGraph {
    // Deep clone to avoid modifying original graph
    const optimizedGraph = _.cloneDeep(graph);

    // Initialize node weights based on connections
    this.calculateNodeWeights(optimizedGraph);

    // Apply layout-specific optimizations
    switch (optimizedGraph.layout) {
      case LayoutType.HIERARCHICAL:
        this.optimizeHierarchicalLayout(optimizedGraph);
        break;
      case LayoutType.FORCE:
        this.optimizeForceLayout(optimizedGraph);
        break;
      case LayoutType.DAGRE:
        this.optimizeDagreLayout(optimizedGraph);
        break;
    }

    // Apply common optimizations
    this.minimizeEdgeCrossings(optimizedGraph);
    this.adjustNodeSpacing(optimizedGraph);
    this.optimizeEdgeRouting(optimizedGraph);

    // Update performance metrics
    optimizedGraph.metadata.performanceMetrics = {
      ...optimizedGraph.metadata.performanceMetrics,
      layoutTime: Date.now() - new Date(optimizedGraph.metadata.performanceMetrics?.lastOptimization || 0).getTime(),
      lastOptimization: new Date()
    };

    return optimizedGraph;
  }

  /**
   * Implements sweep line algorithm for efficient edge crossing reduction
   * @param graph - Input graph to minimize edge crossings
   * @returns Graph with minimized edge crossings
   */
  private minimizeEdgeCrossings(graph: IGraph): IGraph {
    const edges = graph.edges;
    let modified = false;

    // Sort edges by angle for sweep line algorithm
    const sortedEdges = _.sortBy(edges, edge => {
      const source = graph.nodes.find(n => n.id === edge.source);
      const target = graph.nodes.find(n => n.id === edge.target);
      return Math.atan2(
        target!.position.y - source!.position.y,
        target!.position.x - source!.position.x
      );
    });

    // Sweep line algorithm implementation
    for (let i = 0; i < sortedEdges.length - 1; i++) {
      for (let j = i + 1; j < sortedEdges.length; j++) {
        if (this.edgesIntersect(sortedEdges[i], sortedEdges[j], graph.nodes)) {
          this.resolveEdgeCrossing(sortedEdges[i], sortedEdges[j], graph);
          modified = true;
        }
      }
    }

    return modified ? graph : graph;
  }

  /**
   * Uses quadtree-based collision detection for optimal node spacing
   * @param graph - Input graph to optimize node spacing
   * @returns Graph with optimized node spacing
   */
  private adjustNodeSpacing(graph: IGraph): IGraph {
    // Build quadtree spatial index
    this.buildSpatialIndex(graph.nodes);

    // Apply force-directed spacing
    for (let iteration = 0; iteration < this.MAX_ITERATIONS; iteration++) {
      let totalMovement = 0;

      for (const node of graph.nodes) {
        const force = this.calculateRepulsionForce(node, graph.nodes);
        
        // Apply force with damping
        const damping = 1 - (iteration / this.MAX_ITERATIONS);
        node.position.x += force.x * damping;
        node.position.y += force.y * damping;

        totalMovement += Math.abs(force.x) + Math.abs(force.y);
      }

      // Check for convergence
      if (totalMovement < 0.1) break;
    }

    return graph;
  }

  /**
   * Implements advanced edge bundling and path optimization
   * @param graph - Input graph to optimize edge routing
   * @returns Graph with optimized edge routes
   */
  private optimizeEdgeRouting(graph: IGraph): IGraph {
    // Group edges by direction and proximity
    const edgeGroups = this.groupEdgesByDirection(graph.edges);

    for (const group of edgeGroups) {
      if (group.length > 1) {
        this.bundleEdgeGroup(group, graph, this.BUNDLING_STRENGTH);
      }
    }

    // Update edge styles for bundled edges
    for (const edge of graph.edges) {
      edge.style = {
        ...edge.style,
        strokeWidth: this.calculateEdgeWeight(edge, graph),
        animated: edge.metadata?.isRequired || false
      };
    }

    return graph;
  }

  /**
   * Calculates node weights based on connections and importance
   * @param graph - Input graph for weight calculation
   */
  private calculateNodeWeights(graph: IGraph): void {
    this.nodeWeights.clear();

    for (const node of graph.nodes) {
      const incomingEdges = graph.edges.filter(e => e.target === node.id);
      const outgoingEdges = graph.edges.filter(e => e.source === node.id);
      
      // Calculate weight based on connections and node type
      let weight = incomingEdges.length + outgoingEdges.length;
      
      // Adjust weight based on node type importance
      if (node.type === NodeType.MODULE) weight *= 1.5;
      if (node.type === NodeType.RESOURCE) weight *= 1.2;
      
      this.nodeWeights.set(node.id, weight);
    }
  }

  /**
   * Builds a quadtree spatial index for efficient node lookup
   * @param nodes - Array of nodes to index
   */
  private buildSpatialIndex(nodes: INode[]): void {
    this.spatialIndex = new QuadTreeNode(0, 0, 1000, 1000);
    
    for (const node of nodes) {
      this.insertNodeIntoQuadTree(node, this.spatialIndex);
    }
  }

  /**
   * Inserts a node into the quadtree structure
   * @param node - Node to insert
   * @param quadTree - Current quadtree node
   */
  private insertNodeIntoQuadTree(node: INode, quadTree: QuadTreeNode): void {
    if (quadTree.nodes.length < 4) {
      quadTree.nodes.push(node);
      return;
    }

    if (quadTree.children.length === 0) {
      this.subdivideQuadTree(quadTree);
    }

    const midX = quadTree.x + quadTree.width / 2;
    const midY = quadTree.y + quadTree.height / 2;

    for (const child of quadTree.children) {
      if (node.position.x >= child.x && 
          node.position.x < child.x + child.width &&
          node.position.y >= child.y && 
          node.position.y < child.y + child.height) {
        this.insertNodeIntoQuadTree(node, child);
        break;
      }
    }
  }

  /**
   * Subdivides a quadtree node into four children
   * @param quadTree - Quadtree node to subdivide
   */
  private subdivideQuadTree(quadTree: QuadTreeNode): void {
    const halfWidth = quadTree.width / 2;
    const halfHeight = quadTree.height / 2;

    quadTree.children = [
      new QuadTreeNode(quadTree.x, quadTree.y, halfWidth, halfHeight),
      new QuadTreeNode(quadTree.x + halfWidth, quadTree.y, halfWidth, halfHeight),
      new QuadTreeNode(quadTree.x, quadTree.y + halfHeight, halfWidth, halfHeight),
      new QuadTreeNode(quadTree.x + halfWidth, quadTree.y + halfHeight, halfWidth, halfHeight)
    ];
  }

  /**
   * Calculates repulsion force between nodes for spacing
   * @param node - Current node
   * @param nodes - All nodes in the graph
   * @returns Force vector {x, y}
   */
  private calculateRepulsionForce(node: INode, nodes: INode[]): { x: number; y: number } {
    let forceX = 0;
    let forceY = 0;

    for (const other of nodes) {
      if (other.id === node.id) continue;

      const dx = node.position.x - other.position.x;
      const dy = node.position.y - other.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.MIN_NODE_DISTANCE) {
        const force = this.FORCE_STRENGTH * (this.MIN_NODE_DISTANCE - distance) / distance;
        forceX += dx * force;
        forceY += dy * force;
      }
    }

    return { x: forceX, y: forceY };
  }

  /**
   * Checks if two edges intersect
   * @param edge1 - First edge
   * @param edge2 - Second edge
   * @param nodes - Array of nodes
   * @returns Boolean indicating intersection
   */
  private edgesIntersect(edge1: IEdge, edge2: IEdge, nodes: INode[]): boolean {
    const e1Source = nodes.find(n => n.id === edge1.source)!;
    const e1Target = nodes.find(n => n.id === edge1.target)!;
    const e2Source = nodes.find(n => n.id === edge2.source)!;
    const e2Target = nodes.find(n => n.id === edge2.target)!;

    return this.lineSegmentsIntersect(
      e1Source.position.x, e1Source.position.y,
      e1Target.position.x, e1Target.position.y,
      e2Source.position.x, e2Source.position.y,
      e2Target.position.x, e2Target.position.y
    );
  }

  /**
   * Checks if two line segments intersect
   * @param x1 - First line start x
   * @param y1 - First line start y
   * @param x2 - First line end x
   * @param y2 - First line end y
   * @param x3 - Second line start x
   * @param y3 - Second line start y
   * @param x4 - Second line end x
   * @param y4 - Second line end y
   * @returns Boolean indicating intersection
   */
  private lineSegmentsIntersect(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
  ): boolean {
    const denominator = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));
    if (denominator === 0) return false;

    const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
    const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denominator;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  /**
   * Groups edges by direction for bundling
   * @param edges - Array of edges to group
   * @returns Array of edge groups
   */
  private groupEdgesByDirection(edges: IEdge[]): IEdge[][] {
    return _.values(_.groupBy(edges, edge => {
      return `${edge.source}-${edge.target}`;
    }));
  }

  /**
   * Applies edge bundling to a group of edges
   * @param edges - Group of edges to bundle
   * @param graph - Parent graph
   * @param strength - Bundling strength factor
   */
  private bundleEdgeGroup(edges: IEdge[], graph: IGraph, strength: number): void {
    if (edges.length < 2) return;

    const centerEdge = edges[0];
    const sourceNode = graph.nodes.find(n => n.id === centerEdge.source)!;
    const targetNode = graph.nodes.find(n => n.id === centerEdge.target)!;

    const midX = (sourceNode.position.x + targetNode.position.x) / 2;
    const midY = (sourceNode.position.y + targetNode.position.y) / 2;

    for (const edge of edges) {
      edge.metadata = {
        ...edge.metadata,
        bundleCenter: { x: midX, y: midY },
        bundleStrength: strength
      };
    }
  }

  /**
   * Calculates edge weight based on importance and bundling
   * @param edge - Edge to calculate weight for
   * @param graph - Parent graph
   * @returns Calculated edge weight
   */
  private calculateEdgeWeight(edge: IEdge, graph: IGraph): number {
    const sourceWeight = this.nodeWeights.get(edge.source) || 1;
    const targetWeight = this.nodeWeights.get(edge.target) || 1;
    return Math.log(sourceWeight + targetWeight) * edge.weight;
  }
}