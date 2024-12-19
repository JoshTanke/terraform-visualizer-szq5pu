/**
 * @fileoverview Advanced hierarchical layout implementation optimized for Terraform infrastructure visualization
 * with specific support for Pipeline > Environment > Module hierarchy and performance optimizations.
 * @version 1.0.0
 */

import { Position } from 'reactflow'; // v11.x
import * as dagre from 'dagre'; // v0.8.x
import { IGraph, INode, IEdge, NodeType } from '../interfaces/IGraph';
import { calculateNodePosition, optimizeEdgeRouting } from '../utils/graphHelpers';

/**
 * Configuration interface for hierarchical layout
 */
interface HierarchicalLayoutConfig {
    levelSeparation?: number;
    nodeSeparation?: number;
    rankDirection?: 'TB' | 'LR';
    padding?: number;
    alignmentIterations?: number;
}

/**
 * Performance metrics tracking interface
 */
interface PerformanceMetrics {
    layoutStartTime: number;
    levelCalculationTime: number;
    positioningTime: number;
    edgeRoutingTime: number;
    totalTime: number;
}

/**
 * Advanced hierarchical layout implementation for Terraform infrastructure visualization
 */
export class HierarchicalLayout {
    private readonly levelSeparation: number;
    private readonly nodeSeparation: number;
    private readonly dimensions: { width: number; height: number };
    private readonly levelCache: Map<string, number>;
    private readonly performanceMetrics: PerformanceMetrics;

    /**
     * Initialize hierarchical layout with configuration
     * @param config - Layout configuration options
     */
    constructor(config: HierarchicalLayoutConfig = {}) {
        this.levelSeparation = config.levelSeparation || 150;
        this.nodeSeparation = config.nodeSeparation || 100;
        this.dimensions = { width: 1000, height: 800 };
        this.levelCache = new Map<string, number>();
        this.performanceMetrics = {
            layoutStartTime: 0,
            levelCalculationTime: 0,
            positioningTime: 0,
            edgeRoutingTime: 0,
            totalTime: 0
        };
    }

    /**
     * Apply hierarchical layout to the graph
     * @param graph - Input graph structure
     * @returns Graph with optimized layout
     */
    public layout(graph: IGraph): IGraph {
        this.performanceMetrics.layoutStartTime = performance.now();

        // Create DAG representation
        const g = new dagre.graphlib.Graph();
        g.setGraph({
            rankdir: 'TB',
            nodesep: this.nodeSeparation,
            ranksep: this.levelSeparation,
            marginx: 50,
            marginy: 50
        });

        // Calculate node levels with hierarchy awareness
        const levels = this.calculateLevels(graph.nodes, graph.edges);
        this.performanceMetrics.levelCalculationTime = performance.now() - this.performanceMetrics.layoutStartTime;

        // Optimize node positions
        const startPositioning = performance.now();
        const positionedNodes = this.optimizeNodePositions(graph.nodes, levels);
        this.performanceMetrics.positioningTime = performance.now() - startPositioning;

        // Optimize edge routing
        const startEdgeRouting = performance.now();
        const optimizedEdges = optimizeEdgeRouting(graph.edges, positionedNodes, graph.layout);
        this.performanceMetrics.edgeRoutingTime = performance.now() - startEdgeRouting;

        this.performanceMetrics.totalTime = performance.now() - this.performanceMetrics.layoutStartTime;

        return {
            ...graph,
            nodes: positionedNodes,
            edges: optimizedEdges,
            metadata: {
                ...graph.metadata,
                layoutPerformance: this.performanceMetrics
            }
        };
    }

    /**
     * Calculate node levels with Pipeline > Environment > Module hierarchy support
     * @param nodes - Array of nodes
     * @param edges - Array of edges
     * @returns Map of node IDs to their calculated levels
     */
    private calculateLevels(nodes: INode[], edges: IEdge[]): Map<string, number> {
        const levels = new Map<string, number>();
        
        // Check cache first
        const cacheKey = this.generateCacheKey(nodes, edges);
        if (this.levelCache.has(cacheKey)) {
            return new Map(this.levelCache.get(cacheKey));
        }

        // Process nodes by type hierarchy
        const pipelineNodes = nodes.filter(node => node.type === NodeType.ENVIRONMENT);
        const environmentNodes = nodes.filter(node => node.type === NodeType.MODULE);
        const moduleNodes = nodes.filter(node => 
            !pipelineNodes.includes(node) && !environmentNodes.includes(node));

        // Assign levels based on hierarchy
        pipelineNodes.forEach(node => levels.set(node.id, 0));
        environmentNodes.forEach(node => {
            const parentLevel = this.findParentLevel(node, edges, levels);
            levels.set(node.id, parentLevel + 1);
        });
        moduleNodes.forEach(node => {
            const parentLevel = this.findParentLevel(node, edges, levels);
            levels.set(node.id, parentLevel + 1);
        });

        // Cache results
        this.levelCache.set(cacheKey, Array.from(levels.entries()));

        return levels;
    }

    /**
     * Optimize node positions with performance enhancements
     * @param nodes - Array of nodes
     * @param levels - Map of node levels
     * @returns Nodes with optimized positions
     */
    private optimizeNodePositions(nodes: INode[], levels: Map<string, number>): INode[] {
        // Group nodes by level
        const nodesByLevel = new Map<number, INode[]>();
        nodes.forEach(node => {
            const level = levels.get(node.id) || 0;
            if (!nodesByLevel.has(level)) {
                nodesByLevel.set(level, []);
            }
            nodesByLevel.get(level)!.push(node);
        });

        // Calculate positions level by level
        const positionedNodes: INode[] = [];
        nodesByLevel.forEach((levelNodes, level) => {
            const levelWidth = this.dimensions.width;
            const nodeSpacing = levelWidth / (levelNodes.length + 1);

            levelNodes.forEach((node, index) => {
                const position = {
                    x: nodeSpacing * (index + 1),
                    y: level * this.levelSeparation
                };

                positionedNodes.push({
                    ...node,
                    position,
                    // Add metadata for animation
                    data: {
                        ...node.data,
                        layoutLevel: level,
                        layoutIndex: index
                    }
                });
            });
        });

        return positionedNodes;
    }

    /**
     * Find parent level for a node
     * @param node - Node to find parent level for
     * @param edges - Array of edges
     * @param levels - Map of calculated levels
     * @returns Parent level number
     */
    private findParentLevel(
        node: INode,
        edges: IEdge[],
        levels: Map<string, number>
    ): number {
        const parentEdges = edges.filter(edge => edge.target === node.id);
        if (parentEdges.length === 0) return 0;

        return Math.max(...parentEdges.map(edge => {
            const parentLevel = levels.get(edge.source);
            return parentLevel !== undefined ? parentLevel : 0;
        }));
    }

    /**
     * Generate cache key for level calculations
     * @param nodes - Array of nodes
     * @param edges - Array of edges
     * @returns Cache key string
     */
    private generateCacheKey(nodes: INode[], edges: IEdge[]): string {
        return `${nodes.map(n => n.id).join('-')}_${edges.map(e => `${e.source}-${e.target}`).join('-')}`;
    }
}