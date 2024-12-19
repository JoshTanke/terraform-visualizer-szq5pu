/**
 * @fileoverview Core interface definitions for graph visualization structures
 * supporting multi-level Terraform infrastructure visualization with comprehensive
 * type safety and performance optimizations.
 * @version 1.0.0
 */

import { Position } from './IResource'; // v1.0.0
import { Edge, Node } from 'reactflow'; // v11.x

/**
 * Supported layout algorithms for graph visualization
 */
export enum LayoutType {
    HIERARCHICAL = 'hierarchical',
    FORCE = 'force',
    DAGRE = 'dagre'
}

/**
 * Node types in the visualization hierarchy
 */
export enum NodeType {
    ENVIRONMENT = 'environment',
    MODULE = 'module',
    RESOURCE = 'resource'
}

/**
 * Edge types representing relationships between nodes
 */
export enum EdgeType {
    DEPENDENCY = 'dependency',
    REFERENCE = 'reference'
}

/**
 * Node styling configuration
 */
export interface NodeStyle {
    width?: number;
    height?: number;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    opacity?: number;
    zIndex?: number;
}

/**
 * Edge styling configuration
 */
export interface EdgeStyle {
    strokeWidth?: number;
    strokeColor?: string;
    animated?: boolean;
    opacity?: number;
    zIndex?: number;
}

/**
 * Node-specific metadata
 */
export interface NodeMetadata {
    createdAt: string;
    updatedAt: string;
    version?: string;
    description?: string;
    tags?: Record<string, string>;
    status?: 'valid' | 'warning' | 'error';
}

/**
 * Edge-specific metadata
 */
export interface EdgeMetadata {
    createdAt: string;
    updatedAt: string;
    description?: string;
    weight?: number;
    bidirectional?: boolean;
}

/**
 * Graph-level metadata
 */
export interface GraphMetadata {
    createdAt: string;
    updatedAt: string;
    version: string;
    name: string;
    description?: string;
    owner?: string;
    nodeCount: number;
    edgeCount: number;
}

/**
 * Viewport configuration for graph rendering
 */
export interface ViewportConfig {
    x: number;
    y: number;
    zoom: number;
}

/**
 * Enhanced interface for graph nodes with styling and metadata
 */
export interface INode extends Omit<Node, 'position'> {
    id: string;
    type: NodeType;
    data: Record<string, any>;
    position: Position;
    style?: NodeStyle;
    metadata: NodeMetadata;
}

/**
 * Enhanced interface for graph edges with styling and metadata
 */
export interface IEdge extends Edge {
    id: string;
    source: string;
    target: string;
    type: EdgeType;
    style?: EdgeStyle;
    metadata: EdgeMetadata;
}

/**
 * Main interface representing the complete graph structure
 */
export interface IGraph {
    /** Array of nodes in the graph */
    nodes: INode[];
    
    /** Array of edges connecting the nodes */
    edges: IEdge[];
    
    /** Selected layout algorithm */
    layout: LayoutType;
    
    /** Current viewport configuration */
    viewport: ViewportConfig;
    
    /** Graph metadata */
    metadata: GraphMetadata;
}

/**
 * Type guard to validate IGraph structure
 * @param obj - Object to validate
 * @returns boolean indicating if object is a valid IGraph
 */
export function isIGraph(obj: any): obj is IGraph {
    return (
        typeof obj === 'object' &&
        Array.isArray(obj.nodes) &&
        Array.isArray(obj.edges) &&
        Object.values(LayoutType).includes(obj.layout) &&
        typeof obj.viewport === 'object' &&
        typeof obj.viewport.x === 'number' &&
        typeof obj.viewport.y === 'number' &&
        typeof obj.viewport.zoom === 'number' &&
        typeof obj.metadata === 'object' &&
        typeof obj.metadata.version === 'string' &&
        typeof obj.metadata.name === 'string' &&
        typeof obj.metadata.nodeCount === 'number' &&
        typeof obj.metadata.edgeCount === 'number'
    );
}

/**
 * Type guard to validate INode structure
 * @param obj - Object to validate
 * @returns boolean indicating if object is a valid INode
 */
export function isINode(obj: any): obj is INode {
    return (
        typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        Object.values(NodeType).includes(obj.type) &&
        typeof obj.data === 'object' &&
        typeof obj.position === 'object' &&
        typeof obj.position.x === 'number' &&
        typeof obj.position.y === 'number' &&
        typeof obj.metadata === 'object' &&
        typeof obj.metadata.createdAt === 'string' &&
        typeof obj.metadata.updatedAt === 'string'
    );
}

/**
 * Type guard to validate IEdge structure
 * @param obj - Object to validate
 * @returns boolean indicating if object is a valid IEdge
 */
export function isIEdge(obj: any): obj is IEdge {
    return (
        typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.source === 'string' &&
        typeof obj.target === 'string' &&
        Object.values(EdgeType).includes(obj.type) &&
        typeof obj.metadata === 'object' &&
        typeof obj.metadata.createdAt === 'string' &&
        typeof obj.metadata.updatedAt === 'string'
    );
}