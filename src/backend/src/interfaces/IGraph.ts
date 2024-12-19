// @ts-ignore - mongoose version 6.0.0
import { Types } from 'mongoose';
import { position } from './IResource';

/**
 * Enum defining supported graph layout algorithms with performance optimizations
 */
export enum LayoutType {
  HIERARCHICAL = 'hierarchical',
  FORCE = 'force',
  DAGRE = 'dagre'
}

/**
 * Enum defining supported node types across different visualization levels
 */
export enum NodeType {
  // Pipeline Level
  PIPELINE = 'pipeline',
  ENVIRONMENT = 'environment',
  
  // Environment Level
  MODULE = 'module',
  SERVICE = 'service',
  
  // Module Level
  RESOURCE = 'resource',
  DATA = 'data',
  VARIABLE = 'variable',
  OUTPUT = 'output',
  LOCAL = 'local',
  PROVIDER = 'provider'
}

/**
 * Enum defining supported edge types for different relationships
 */
export enum EdgeType {
  DEPENDENCY = 'dependency',
  REFERENCE = 'reference',
  FLOW = 'flow',
  MODULE_LINK = 'module_link'
}

/**
 * Enum defining validation status for nodes
 */
export enum ValidationStatus {
  VALID = 'valid',
  WARNING = 'warning',
  ERROR = 'error',
  PENDING = 'pending'
}

/**
 * Interface for node styling properties
 */
export interface NodeStyle {
  width?: number;
  height?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: string;
  opacity?: number;
  icon?: string;
  fontSize?: number;
  fontFamily?: string;
  zIndex?: number;
}

/**
 * Interface for edge styling properties
 */
export interface EdgeStyle {
  strokeWidth?: number;
  strokeColor?: string;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  animated?: boolean;
  labelFontSize?: number;
  labelFontFamily?: string;
  zIndex?: number;
}

/**
 * Interface for layout-specific configuration
 */
export interface LayoutConfig {
  // Hierarchical layout options
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  nodeSpacing?: number;
  rankSpacing?: number;
  
  // Force-directed layout options
  forceStrength?: number;
  centerForce?: number;
  linkDistance?: number;
  
  // Dagre layout options
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL';
  align?: 'UL' | 'UR' | 'DL' | 'DR';
  ranksep?: number;
  nodesep?: number;
  
  // Common options
  padding?: number;
  fitView?: boolean;
  animate?: boolean;
  animationDuration?: number;
}

/**
 * Interface for graph metadata
 */
export interface GraphMetadata {
  id: Types.ObjectId;
  name: string;
  description?: string;
  level: 'pipeline' | 'environment' | 'module';
  version?: string;
  createdAt: Date;
  updatedAt: Date;
  nodeCount: number;
  edgeCount: number;
  validationStatus: ValidationStatus;
  performanceMetrics?: {
    renderTime?: number;
    layoutTime?: number;
    lastOptimization?: Date;
  };
}

/**
 * Interface representing a node in the infrastructure graph
 */
export interface INode {
  id: string;
  type: NodeType;
  data: Record<string, any>;
  position: position;
  validationStatus: ValidationStatus;
  style: NodeStyle;
  metadata?: {
    resourceId?: Types.ObjectId;
    moduleId?: Types.ObjectId;
    environmentId?: Types.ObjectId;
    description?: string;
    tags?: string[];
  };
}

/**
 * Interface representing an edge connecting two nodes in the graph
 */
export interface IEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
  style: EdgeStyle;
  metadata?: {
    description?: string;
    dependencyType?: string;
    isRequired?: boolean;
    validationErrors?: string[];
  };
}

/**
 * Main interface representing the graph structure for infrastructure visualization
 * with enhanced layout support and performance optimizations
 */
export interface IGraph {
  nodes: INode[];
  edges: IEdge[];
  layout: LayoutType;
  layoutConfig: LayoutConfig;
  metadata: GraphMetadata;
  
  // Optional performance optimization fields
  cachedLayout?: {
    timestamp: Date;
    positions: Record<string, position>;
    valid: boolean;
  };
  
  // Optional view-specific data
  viewportState?: {
    zoom: number;
    position: { x: number; y: number };
    selectedNodes: string[];
    selectedEdges: string[];
  };
}