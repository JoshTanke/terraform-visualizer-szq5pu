/**
 * @fileoverview Utility functions for graph manipulation, node positioning, edge routing,
 * and layout calculations in the Terraform visualization tool frontend.
 * @version 1.0.0
 */

import { Position, Node, Edge } from 'reactflow'; // v11.x
import * as dagre from 'dagre'; // v0.8.x
import { 
    IGraph, 
    INode, 
    IEdge, 
    LayoutType,
    NodeType,
    EdgeType 
} from '../interfaces/IGraph';

// Constants for layout calculations
const LAYOUT_CONFIG = {
    HIERARCHICAL: {
        LEVEL_SEPARATION: 150,
        NODE_SEPARATION: 100,
        EDGE_PADDING: 20
    },
    FORCE: {
        IDEAL_EDGE_LENGTH: 120,
        REPULSION_STRENGTH: 1000,
        ATTRACTION_STRENGTH: 0.01
    },
    DAGRE: {
        RANK_SEPARATION: 100,
        NODE_SEPARATION: 80,
        EDGE_WEIGHT: 1
    }
};

/**
 * Calculates optimal position for a node based on its connections and layout type
 * @param node - Node to position
 * @param edges - Array of edges in the graph
 * @param layoutType - Selected layout algorithm
 * @param viewport - Current viewport configuration
 * @returns Optimized position for the node
 */
export function calculateNodePosition(
    node: INode,
    edges: IEdge[],
    layoutType: LayoutType,
    viewport: { width: number; height: number; zoom: number }
): Position {
    switch (layoutType) {
        case LayoutType.HIERARCHICAL:
            return calculateHierarchicalPosition(node, edges, viewport);
        case LayoutType.FORCE:
            return calculateForceDirectedPosition(node, edges, viewport);
        case LayoutType.DAGRE:
            return calculateDagrePosition(node, edges, viewport);
        default:
            return { x: 0, y: 0 };
    }
}

/**
 * Optimizes edge routing with enhanced algorithms for improved visibility
 * @param edges - Array of edges to optimize
 * @param nodes - Array of nodes in the graph
 * @param layoutType - Selected layout algorithm
 * @returns Optimized edges with enhanced routing paths
 */
export function optimizeEdgeRouting(
    edges: IEdge[],
    nodes: INode[],
    layoutType: LayoutType
): IEdge[] {
    // Create edge bundles for parallel edges
    const bundledEdges = createEdgeBundles(edges);
    
    // Apply layout-specific optimizations
    const optimizedEdges = bundledEdges.map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (!sourceNode || !targetNode) return edge;

        const controlPoints = calculateControlPoints(
            sourceNode.position,
            targetNode.position,
            layoutType
        );

        return {
            ...edge,
            style: {
                ...edge.style,
                ...getEdgeStyle(edge.type, layoutType)
            },
            controlPoints
        };
    });

    return optimizedEdges;
}

/**
 * Calculates graph bounds with viewport awareness
 * @param nodes - Array of nodes in the graph
 * @param viewport - Current viewport configuration
 * @param zoomLevel - Current zoom level
 * @returns Enhanced bounds object with viewport-aware dimensions
 */
export function calculateGraphBounds(
    nodes: INode[],
    viewport: { width: number; height: number },
    zoomLevel: number
): { 
    x: number; 
    y: number; 
    width: number; 
    height: number; 
    padding: number;
} {
    if (nodes.length === 0) {
        return { x: 0, y: 0, width: viewport.width, height: viewport.height, padding: 0 };
    }

    // Calculate raw bounds
    const positions = nodes.map(node => node.position);
    const xs = positions.map(pos => pos.x);
    const ys = positions.map(pos => pos.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Calculate padding based on zoom level
    const padding = calculatePadding(zoomLevel, viewport);

    return {
        x: minX - padding,
        y: minY - padding,
        width: maxX - minX + (padding * 2),
        height: maxY - minY + (padding * 2),
        padding
    };
}

/**
 * Centers graph with animation support
 * @param graph - Graph to center
 * @param viewport - Current viewport configuration
 * @param animationConfig - Animation configuration
 * @returns Centered graph with animation metadata
 */
export function centerGraph(
    graph: IGraph,
    viewport: { width: number; height: number; zoom: number },
    animationConfig: { duration: number; easing: string }
): IGraph {
    const bounds = calculateGraphBounds(graph.nodes, viewport, viewport.zoom);
    const center = {
        x: bounds.x + (bounds.width / 2),
        y: bounds.y + (bounds.height / 2)
    };

    // Calculate required translation
    const translation = {
        x: (viewport.width / 2) - center.x,
        y: (viewport.height / 2) - center.y
    };

    // Apply translation to nodes with animation
    const centeredNodes = graph.nodes.map(node => ({
        ...node,
        position: {
            x: node.position.x + translation.x,
            y: node.position.y + translation.y
        },
        animated: true,
        animationConfig
    }));

    return {
        ...graph,
        nodes: centeredNodes
    };
}

// Private helper functions

function calculateHierarchicalPosition(
    node: INode,
    edges: IEdge[],
    viewport: { width: number; height: number; zoom: number }
): Position {
    const level = calculateNodeLevel(node, edges);
    const siblings = findSiblingNodes(node, edges);
    
    return {
        x: level * LAYOUT_CONFIG.HIERARCHICAL.LEVEL_SEPARATION,
        y: siblings.index * LAYOUT_CONFIG.HIERARCHICAL.NODE_SEPARATION
    };
}

function calculateForceDirectedPosition(
    node: INode,
    edges: IEdge[],
    viewport: { width: number; height: number; zoom: number }
): Position {
    // Implement force-directed positioning using repulsion/attraction forces
    const forces = calculateForces(node, edges);
    
    return {
        x: node.position.x + forces.x,
        y: node.position.y + forces.y
    };
}

function calculateDagrePosition(
    node: INode,
    edges: IEdge[],
    viewport: { width: number; height: number; zoom: number }
): Position {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: 'TB',
        nodesep: LAYOUT_CONFIG.DAGRE.NODE_SEPARATION,
        ranksep: LAYOUT_CONFIG.DAGRE.RANK_SEPARATION
    });

    // Add nodes and edges to dagre graph
    g.setNode(node.id, { width: 150, height: 50 });
    edges.forEach(edge => {
        g.setEdge(edge.source, edge.target, { weight: LAYOUT_CONFIG.DAGRE.EDGE_WEIGHT });
    });

    dagre.layout(g);
    const nodeData = g.node(node.id);

    return {
        x: nodeData.x,
        y: nodeData.y
    };
}

function createEdgeBundles(edges: IEdge[]): IEdge[] {
    // Group parallel edges
    const parallelEdges = edges.reduce((groups, edge) => {
        const key = `${edge.source}-${edge.target}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(edge);
        return groups;
    }, {} as Record<string, IEdge[]>);

    // Bundle parallel edges with offset curves
    return Object.values(parallelEdges).flat().map((edge, index, group) => ({
        ...edge,
        bundleOffset: group.length > 1 ? (index - (group.length - 1) / 2) * 20 : 0
    }));
}

function calculateControlPoints(
    source: Position,
    target: Position,
    layoutType: LayoutType
): Position[] {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    
    switch (layoutType) {
        case LayoutType.HIERARCHICAL:
            return [
                { x: source.x + dx / 3, y: source.y },
                { x: source.x + (2 * dx) / 3, y: target.y }
            ];
        case LayoutType.DAGRE:
            return [
                { x: source.x + dx / 2, y: source.y },
                { x: source.x + dx / 2, y: target.y }
            ];
        default:
            return [
                { x: source.x + dx / 2, y: source.y + dy / 2 }
            ];
    }
}

function getEdgeStyle(edgeType: EdgeType, layoutType: LayoutType): Record<string, any> {
    const baseStyle = {
        strokeWidth: 2,
        opacity: 0.8
    };

    switch (edgeType) {
        case EdgeType.DEPENDENCY:
            return {
                ...baseStyle,
                strokeColor: '#007AFF',
                animated: true
            };
        case EdgeType.REFERENCE:
            return {
                ...baseStyle,
                strokeColor: '#34C759',
                animated: false
            };
        default:
            return baseStyle;
    }
}

function calculatePadding(
    zoomLevel: number,
    viewport: { width: number; height: number }
): number {
    const basePadding = Math.min(viewport.width, viewport.height) * 0.1;
    return basePadding / zoomLevel;
}

function calculateNodeLevel(node: INode, edges: IEdge[]): number {
    const incomingEdges = edges.filter(edge => edge.target === node.id);
    if (incomingEdges.length === 0) return 0;
    
    return Math.max(...incomingEdges.map(edge => {
        const sourceNode = { id: edge.source } as INode;
        return calculateNodeLevel(sourceNode, edges) + 1;
    }));
}

function findSiblingNodes(node: INode, edges: IEdge[]): { index: number; total: number } {
    const siblings = edges
        .filter(edge => edge.target === node.id)
        .map(edge => edge.source);
    
    return {
        index: siblings.indexOf(node.id),
        total: siblings.length
    };
}

function calculateForces(node: INode, edges: IEdge[]): { x: number; y: number } {
    let fx = 0, fy = 0;

    // Calculate repulsion forces
    edges.forEach(edge => {
        if (edge.source === node.id || edge.target === node.id) {
            const dx = edge.source === node.id ? 1 : -1;
            const dy = edge.source === node.id ? 1 : -1;
            
            fx += dx * LAYOUT_CONFIG.FORCE.REPULSION_STRENGTH;
            fy += dy * LAYOUT_CONFIG.FORCE.REPULSION_STRENGTH;
        }
    });

    // Apply attraction forces
    edges.forEach(edge => {
        if (edge.source === node.id || edge.target === node.id) {
            fx *= LAYOUT_CONFIG.FORCE.ATTRACTION_STRENGTH;
            fy *= LAYOUT_CONFIG.FORCE.ATTRACTION_STRENGTH;
        }
    });

    return { x: fx, y: fy };
}