import dagre from 'dagre';
import { GraphLayout, LayoutOptions } from '../GraphLayout';
import { IGraph, INode, IEdge, NodeType, ValidationStatus } from '../../interfaces/IGraph';

/**
 * Configuration options specific to Dagre layout algorithm
 */
export interface DagreOptions extends LayoutOptions {
  /** Horizontal spacing between nodes (px) */
  nodeSeparation?: number;
  /** Vertical spacing between ranks (px) */
  rankSeparation?: number;
  /** Direction of layout flow */
  rankDirection?: 'TB' | 'BT' | 'LR' | 'RL';
  /** Whether to center the graph in the viewport */
  centerGraph?: boolean;
  /** View-specific settings for layout optimization */
  viewSpecificSettings?: {
    /** Pipeline view settings */
    pipeline?: {
      rankAlignment: 'UL' | 'UR' | 'DL' | 'DR';
      minLevelSeparation: number;
    };
    /** Environment view settings */
    environment?: {
      moduleSpacing: number;
      serviceAlignment: 'center' | 'distributed';
    };
    /** Module view settings */
    module?: {
      resourceSpacing: number;
      providerAlignment: 'top' | 'left';
      variableAlignment: 'left' | 'right';
    };
  };
}

/**
 * Default Dagre layout configuration
 */
const DEFAULT_DAGRE_OPTIONS: Partial<DagreOptions> = {
  nodeSeparation: 50,
  rankSeparation: 75,
  rankDirection: 'TB',
  centerGraph: true,
  viewSpecificSettings: {
    pipeline: {
      rankAlignment: 'UL',
      minLevelSeparation: 100
    },
    environment: {
      moduleSpacing: 75,
      serviceAlignment: 'distributed'
    },
    module: {
      resourceSpacing: 50,
      providerAlignment: 'top',
      variableAlignment: 'left'
    }
  }
};

/**
 * Implements Dagre layout algorithm for directed acyclic graph visualization
 * with optimizations for different infrastructure view types.
 */
export class DagreLayout extends GraphLayout {
  private dagreGraph: dagre.graphlib.Graph;
  private options: DagreOptions;
  private performanceMetrics: {
    startTime: number;
    layoutDuration?: number;
    nodeCount: number;
    edgeCount: number;
  };

  /**
   * Initializes the Dagre layout with configuration options
   * @param options - Layout configuration options
   */
  constructor(options: Partial<DagreOptions> = {}) {
    super(options);
    this.options = {
      ...DEFAULT_DAGRE_OPTIONS,
      ...options
    } as DagreOptions;
    
    this.performanceMetrics = {
      startTime: 0,
      nodeCount: 0,
      edgeCount: 0
    };

    this.initializeDagreGraph();
  }

  /**
   * Applies Dagre layout algorithm to position graph nodes with view-specific optimizations
   * @param graph - Input graph to be laid out
   * @returns Promise resolving to graph with updated node positions
   */
  public async layout(graph: IGraph): Promise<IGraph> {
    try {
      this.performanceMetrics.startTime = Date.now();
      
      // Validate input graph
      this.validateGraph(graph);
      
      // Reset Dagre graph for new layout
      this.initializeDagreGraph();
      
      // Apply view-specific preprocessing
      this.preprocessGraphForView(graph);
      
      // Add nodes to Dagre graph with dimensions
      graph.nodes.forEach(node => {
        this.dagreGraph.setNode(node.id, {
          width: node.style.width || 150,
          height: node.style.height || 50,
          type: node.type,
          validationStatus: node.validationStatus
        });
      });
      
      // Add edges to Dagre graph with weights
      graph.edges.forEach(edge => {
        this.dagreGraph.setEdge(edge.source, edge.target, {
          weight: edge.weight || 1,
          minlen: this.calculateEdgeLength(edge)
        });
      });
      
      // Run Dagre layout algorithm
      dagre.layout(this.dagreGraph);
      
      // Update node positions from Dagre layout
      graph.nodes.forEach(node => {
        const dagreNode = this.dagreGraph.node(node.id);
        node.position = {
          x: dagreNode.x,
          y: dagreNode.y
        };
      });
      
      // Apply view-specific post-processing
      this.postprocessGraphForView(graph);
      
      // Center graph if specified
      if (this.options.centerGraph) {
        graph = this.fitToView(graph);
      }
      
      // Update performance metrics
      this.performanceMetrics.layoutDuration = Date.now() - this.performanceMetrics.startTime;
      this.performanceMetrics.nodeCount = graph.nodes.length;
      this.performanceMetrics.edgeCount = graph.edges.length;
      
      return graph;
    } catch (error) {
      throw new Error(`Dagre layout failed: ${error.message}`);
    }
  }

  /**
   * Initializes Dagre graph with view-specific optimizations
   */
  private initializeDagreGraph(): void {
    this.dagreGraph = new dagre.graphlib.Graph({
      directed: true,
      multigraph: false,
      compound: false
    });

    this.dagreGraph.setGraph({
      rankdir: this.options.rankDirection,
      nodesep: this.options.nodeSeparation,
      ranksep: this.options.rankSeparation,
      align: this.getViewSpecificAlignment(),
      acyclicer: 'greedy',
      ranker: 'network-simplex'
    });
  }

  /**
   * Applies view-specific preprocessing to graph
   * @param graph - Graph to preprocess
   */
  private preprocessGraphForView(graph: IGraph): void {
    switch (this.options.viewType) {
      case 'pipeline':
        this.preprocessPipelineView(graph);
        break;
      case 'environment':
        this.preprocessEnvironmentView(graph);
        break;
      case 'module':
        this.preprocessModuleView(graph);
        break;
    }
  }

  /**
   * Preprocesses graph for pipeline view
   * @param graph - Graph to preprocess
   */
  private preprocessPipelineView(graph: IGraph): void {
    const settings = this.options.viewSpecificSettings?.pipeline;
    if (!settings) return;

    // Ensure minimum separation between pipeline stages
    this.dagreGraph.setGraph({
      ranksep: Math.max(
        this.options.rankSeparation || 0,
        settings.minLevelSeparation
      )
    });
  }

  /**
   * Preprocesses graph for environment view
   * @param graph - Graph to preprocess
   */
  private preprocessEnvironmentView(graph: IGraph): void {
    const settings = this.options.viewSpecificSettings?.environment;
    if (!settings) return;

    // Adjust module spacing and alignment
    this.dagreGraph.setGraph({
      nodesep: settings.moduleSpacing,
      align: settings.serviceAlignment === 'center' ? 'UL' : 'DL'
    });
  }

  /**
   * Preprocesses graph for module view
   * @param graph - Graph to preprocess
   */
  private preprocessModuleView(graph: IGraph): void {
    const settings = this.options.viewSpecificSettings?.module;
    if (!settings) return;

    // Position providers and variables according to settings
    graph.nodes.forEach(node => {
      if (node.type === NodeType.PROVIDER) {
        node.position = settings.providerAlignment === 'top' ? 
          { x: 0, y: 0 } : { x: 0, y: this.options.height / 2 };
      }
      if (node.type === NodeType.VARIABLE) {
        node.position = settings.variableAlignment === 'left' ?
          { x: 0, y: 0 } : { x: this.options.width, y: 0 };
      }
    });
  }

  /**
   * Calculates edge length based on node types and validation status
   * @param edge - Edge to calculate length for
   * @returns Minimum edge length
   */
  private calculateEdgeLength(edge: IEdge): number {
    const sourceNode = this.dagreGraph.node(edge.source);
    const targetNode = this.dagreGraph.node(edge.target);
    
    // Increase length for warning/error connections
    if (sourceNode.validationStatus === ValidationStatus.WARNING ||
        targetNode.validationStatus === ValidationStatus.WARNING) {
      return 2;
    }
    if (sourceNode.validationStatus === ValidationStatus.ERROR ||
        targetNode.validationStatus === ValidationStatus.ERROR) {
      return 3;
    }
    
    return 1;
  }

  /**
   * Gets view-specific alignment setting
   * @returns Dagre alignment setting
   */
  private getViewSpecificAlignment(): 'UL' | 'UR' | 'DL' | 'DR' {
    switch (this.options.viewType) {
      case 'pipeline':
        return this.options.viewSpecificSettings?.pipeline?.rankAlignment || 'UL';
      case 'environment':
        return this.options.viewSpecificSettings?.environment?.serviceAlignment === 'center' ? 'UL' : 'DL';
      case 'module':
        return 'UL';
      default:
        return 'UL';
    }
  }

  /**
   * Applies view-specific post-processing to graph
   * @param graph - Graph to post-process
   */
  private postprocessGraphForView(graph: IGraph): void {
    // Apply any view-specific position adjustments
    switch (this.options.viewType) {
      case 'pipeline':
        this.adjustPipelinePositions(graph);
        break;
      case 'environment':
        this.adjustEnvironmentPositions(graph);
        break;
      case 'module':
        this.adjustModulePositions(graph);
        break;
    }
  }

  /**
   * Adjusts node positions for pipeline view
   * @param graph - Graph to adjust positions for
   */
  private adjustPipelinePositions(graph: IGraph): void {
    // Ensure pipeline stages are evenly distributed horizontally
    const stageGroups = new Map<number, INode[]>();
    graph.nodes.forEach(node => {
      const stage = Math.floor(node.position.x / this.options.rankSeparation!);
      if (!stageGroups.has(stage)) {
        stageGroups.set(stage, []);
      }
      stageGroups.get(stage)!.push(node);
    });

    stageGroups.forEach((nodes, stage) => {
      const stageX = stage * this.options.rankSeparation!;
      nodes.forEach((node, index) => {
        node.position.x = stageX;
        node.position.y = (index * this.options.nodeSeparation!) + 
          (this.options.height - (nodes.length - 1) * this.options.nodeSeparation!) / 2;
      });
    });
  }

  /**
   * Adjusts node positions for environment view
   * @param graph - Graph to adjust positions for
   */
  private adjustEnvironmentPositions(graph: IGraph): void {
    // Group modules and ensure proper spacing
    const moduleNodes = graph.nodes.filter(node => node.type === NodeType.MODULE);
    const moduleSpacing = this.options.viewSpecificSettings?.environment?.moduleSpacing || 75;
    
    moduleNodes.forEach((node, index) => {
      node.position.x = index * moduleSpacing;
    });
  }

  /**
   * Adjusts node positions for module view
   * @param graph - Graph to adjust positions for
   */
  private adjustModulePositions(graph: IGraph): void {
    // Adjust resource positions based on dependencies
    const resourceNodes = graph.nodes.filter(node => node.type === NodeType.RESOURCE);
    const resourceSpacing = this.options.viewSpecificSettings?.module?.resourceSpacing || 50;
    
    resourceNodes.forEach(node => {
      const incomingEdges = graph.edges.filter(edge => edge.target === node.id);
      const outgoingEdges = graph.edges.filter(edge => edge.source === node.id);
      
      // Adjust position based on dependency count
      node.position.y += (incomingEdges.length - outgoingEdges.length) * resourceSpacing;
    });
  }
}