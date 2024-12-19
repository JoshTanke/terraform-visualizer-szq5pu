/**
 * @fileoverview Enhanced Dagre layout implementation for hierarchical Terraform infrastructure visualization
 * with optimized performance and advanced layout features.
 * @version 1.0.0
 */

import dagre from 'dagre'; // v1.0.0
import { Edge, Node } from 'reactflow'; // v11.x
import { IGraph, NodeType, EdgeType } from '../interfaces/IGraph';

/**
 * Enhanced configuration options for Dagre layout algorithm
 */
export interface DagreOptions {
    // Core layout configuration
    nodeSeparation: number;
    rankSeparation: number;
    rankDirection: 'TB' | 'BT' | 'LR' | 'RL';
    centerGraph: boolean;

    // Advanced layout features
    nodeTypeSpacing: Record<NodeType, { horizontal: number; vertical: number }>;
    enableEdgeBundling: boolean;
    layoutAnimationDuration: number;
    progressiveRendering: boolean;
    subgraphPadding: number;
}

/**
 * Default layout configuration
 */
const DEFAULT_OPTIONS: DagreOptions = {
    nodeSeparation: 100,
    rankSeparation: 150,
    rankDirection: 'TB',
    centerGraph: true,
    nodeTypeSpacing: {
        [NodeType.ENVIRONMENT]: { horizontal: 200, vertical: 200 },
        [NodeType.MODULE]: { horizontal: 150, vertical: 150 },
        [NodeType.RESOURCE]: { horizontal: 100, vertical: 100 }
    },
    enableEdgeBundling: true,
    layoutAnimationDuration: 300,
    progressiveRendering: true,
    subgraphPadding: 50
};

/**
 * Enhanced Dagre layout implementation for hierarchical infrastructure visualization
 */
export class DagreLayout {
    private dagreGraph: dagre.graphlib.Graph;
    private options: DagreOptions;
    private layoutCache: Map<string, IGraph>;
    private nodeTypeConfig: Map<NodeType, { width: number; height: number }>;
    private progressiveRenderState: {
        isRendering: boolean;
        currentBatch: number;
        totalBatches: number;
    };

    /**
     * Initializes the enhanced Dagre layout with configuration options
     * @param options - Layout configuration options
     */
    constructor(options: Partial<DagreOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.layoutCache = new Map();
        this.progressiveRenderState = {
            isRendering: false,
            currentBatch: 0,
            totalBatches: 0
        };

        // Initialize Dagre graph with enhanced options
        this.dagreGraph = new dagre.graphlib.Graph({
            directed: true,
            multigraph: false,
            compound: true
        });

        // Set default graph properties
        this.dagreGraph.setGraph({
            rankdir: this.options.rankDirection,
            nodesep: this.options.nodeSeparation,
            ranksep: this.options.rankSeparation,
            edgesep: 50,
            marginx: 20,
            marginy: 20
        });

        // Initialize node type configurations
        this.nodeTypeConfig = new Map([
            [NodeType.ENVIRONMENT, { width: 300, height: 200 }],
            [NodeType.MODULE, { width: 250, height: 150 }],
            [NodeType.RESOURCE, { width: 200, height: 100 }]
        ]);
    }

    /**
     * Applies enhanced Dagre layout algorithm with optimizations
     * @param graph - Input graph to layout
     * @returns Graph with optimized node positions and enhanced layout
     */
    public layout(graph: IGraph): IGraph {
        // Check layout cache
        const cacheKey = this.generateCacheKey(graph);
        const cachedLayout = this.layoutCache.get(cacheKey);
        if (cachedLayout) {
            return cachedLayout;
        }

        // Reset Dagre graph
        this.dagreGraph.setGraph({});
        this.dagreGraph.setDefaultEdgeLabel(() => ({}));

        // Add nodes with type-specific dimensions
        graph.nodes.forEach(node => {
            const dimensions = this.nodeTypeConfig.get(node.type as NodeType);
            if (dimensions) {
                this.dagreGraph.setNode(node.id, {
                    width: dimensions.width,
                    height: dimensions.height,
                    nodeType: node.type
                });
            }
        });

        // Add edges with optimized bundling
        if (this.options.enableEdgeBundling) {
            this.addEdgesWithBundling(graph.edges);
        } else {
            graph.edges.forEach(edge => {
                this.dagreGraph.setEdge(edge.source, edge.target);
            });
        }

        // Run Dagre layout algorithm
        dagre.layout(this.dagreGraph);

        // Apply optimized layout
        const optimizedGraph = this.optimizeLayout(graph);

        // Cache the result
        this.layoutCache.set(cacheKey, optimizedGraph);

        return optimizedGraph;
    }

    /**
     * Applies performance optimizations to layout calculation
     * @param graph - Input graph to optimize
     * @returns Optimized graph layout
     */
    private optimizeLayout(graph: IGraph): IGraph {
        const optimizedGraph = { ...graph };
        const graphBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

        // Update node positions with type-specific spacing
        optimizedGraph.nodes = graph.nodes.map(node => {
            const dagNode = this.dagreGraph.node(node.id);
            if (!dagNode) return node;

            const position = {
                x: dagNode.x,
                y: dagNode.y
            };

            // Apply node type-specific spacing
            const typeSpacing = this.options.nodeTypeSpacing[node.type as NodeType];
            if (typeSpacing) {
                position.x += typeSpacing.horizontal;
                position.y += typeSpacing.vertical;
            }

            // Update bounds
            graphBounds.minX = Math.min(graphBounds.minX, position.x);
            graphBounds.minY = Math.min(graphBounds.minY, position.y);
            graphBounds.maxX = Math.max(graphBounds.maxX, position.x);
            graphBounds.maxY = Math.max(graphBounds.maxY, position.y);

            return {
                ...node,
                position
            };
        });

        // Center the graph if enabled
        if (this.options.centerGraph) {
            const centerX = (graphBounds.maxX + graphBounds.minX) / 2;
            const centerY = (graphBounds.maxY + graphBounds.minY) / 2;

            optimizedGraph.nodes = optimizedGraph.nodes.map(node => ({
                ...node,
                position: {
                    x: node.position.x - centerX,
                    y: node.position.y - centerY
                }
            }));
        }

        return optimizedGraph;
    }

    /**
     * Adds edges to the graph with bundling optimization
     * @param edges - Graph edges to add
     */
    private addEdgesWithBundling(edges: Edge[]): void {
        // Group edges by source and target regions
        const edgeGroups = new Map<string, Edge[]>();
        
        edges.forEach(edge => {
            const key = `${edge.source}-${edge.target}`;
            const group = edgeGroups.get(key) || [];
            group.push(edge);
            edgeGroups.set(key, group);
        });

        // Add bundled edges to the graph
        edgeGroups.forEach((group, key) => {
            const [source, target] = key.split('-');
            this.dagreGraph.setEdge(source, target, {
                weight: group.length,
                minlen: 1
            });
        });
    }

    /**
     * Generates a cache key for a given graph
     * @param graph - Input graph
     * @returns Cache key string
     */
    private generateCacheKey(graph: IGraph): string {
        return `${graph.nodes.length}-${graph.edges.length}-${graph.layout}-${JSON.stringify(this.options)}`;
    }
}

export default DagreLayout;