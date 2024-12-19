// @ts-ignore - mongoose version 6.0.0
import { Types } from 'mongoose';
import { 
  IGraph, 
  INode, 
  IEdge, 
  LayoutType,
  ValidationStatus,
  NodeType,
  EdgeType 
} from '../interfaces/IGraph';

/**
 * Maximum cache size for nodes and edges to prevent memory issues
 */
const MAX_CACHE_SIZE = 10000;

/**
 * Cache expiration time in milliseconds (30 minutes)
 */
const CACHE_EXPIRATION = 30 * 60 * 1000;

/**
 * High-performance serializer for graph structures with caching capabilities.
 * Handles conversions between internal representations, database formats,
 * and React Flow compatible structures.
 */
export class GraphSerializer {
  private nodeCache: Map<string, { data: any; timestamp: number }>;
  private edgeCache: Map<string, { data: any; timestamp: number }>;

  constructor() {
    this.nodeCache = new Map();
    this.edgeCache = new Map();
    this.initializeCacheCleanup();
  }

  /**
   * Sets up periodic cache cleanup to prevent memory leaks
   * @private
   */
  private initializeCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.nodeCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRATION) {
          this.nodeCache.delete(key);
        }
      }
      for (const [key, value] of this.edgeCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRATION) {
          this.edgeCache.delete(key);
        }
      }
    }, CACHE_EXPIRATION);
  }

  /**
   * Converts graph structure to MongoDB-compatible format with optimized caching
   * @param graph The graph structure to serialize
   * @returns Database-ready graph object with MongoDB ObjectIds
   */
  public serializeForDatabase(graph: IGraph): Record<string, any> {
    try {
      // Process nodes with caching
      const serializedNodes = graph.nodes.map(node => {
        const cacheKey = `db_${node.id}`;
        const cached = this.nodeCache.get(cacheKey);
        
        if (cached && cached.data) {
          return cached.data;
        }

        const serializedNode = {
          _id: new Types.ObjectId(),
          id: node.id,
          type: node.type,
          data: node.data,
          position: node.position,
          validationStatus: node.validationStatus,
          style: node.style,
          metadata: {
            ...node.metadata,
            resourceId: node.metadata?.resourceId ? 
              new Types.ObjectId(node.metadata.resourceId) : undefined,
            moduleId: node.metadata?.moduleId ? 
              new Types.ObjectId(node.metadata.moduleId) : undefined,
            environmentId: node.metadata?.environmentId ? 
              new Types.ObjectId(node.metadata.environmentId) : undefined
          }
        };

        if (this.nodeCache.size < MAX_CACHE_SIZE) {
          this.nodeCache.set(cacheKey, { 
            data: serializedNode, 
            timestamp: Date.now() 
          });
        }

        return serializedNode;
      });

      // Process edges with caching
      const serializedEdges = graph.edges.map(edge => {
        const cacheKey = `db_${edge.id}`;
        const cached = this.edgeCache.get(cacheKey);

        if (cached && cached.data) {
          return cached.data;
        }

        const serializedEdge = {
          _id: new Types.ObjectId(),
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          weight: edge.weight,
          style: edge.style,
          metadata: edge.metadata
        };

        if (this.edgeCache.size < MAX_CACHE_SIZE) {
          this.edgeCache.set(cacheKey, { 
            data: serializedEdge, 
            timestamp: Date.now() 
          });
        }

        return serializedEdge;
      });

      return {
        _id: new Types.ObjectId(),
        nodes: serializedNodes,
        edges: serializedEdges,
        layout: graph.layout,
        layoutConfig: graph.layoutConfig,
        metadata: {
          ...graph.metadata,
          id: new Types.ObjectId(graph.metadata.id),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        cachedLayout: graph.cachedLayout ? {
          ...graph.cachedLayout,
          timestamp: new Date()
        } : undefined,
        viewportState: graph.viewportState
      };
    } catch (error) {
      throw new Error(`Failed to serialize graph for database: ${error.message}`);
    }
  }

  /**
   * Reconstructs IGraph structure from database object with cache utilization
   * @param dbGraph Database graph object to deserialize
   * @returns Fully hydrated graph structure
   */
  public deserializeFromDatabase(dbGraph: Record<string, any>): IGraph {
    try {
      // Validate required fields
      if (!dbGraph.nodes || !dbGraph.edges || !dbGraph.layout) {
        throw new Error('Invalid database graph structure');
      }

      // Process nodes with caching
      const nodes: INode[] = dbGraph.nodes.map(node => {
        const cacheKey = `mem_${node.id}`;
        const cached = this.nodeCache.get(cacheKey);

        if (cached && cached.data) {
          return cached.data;
        }

        const deserializedNode: INode = {
          id: node.id,
          type: node.type as NodeType,
          data: node.data,
          position: node.position,
          validationStatus: node.validationStatus as ValidationStatus,
          style: node.style,
          metadata: node.metadata
        };

        if (this.nodeCache.size < MAX_CACHE_SIZE) {
          this.nodeCache.set(cacheKey, { 
            data: deserializedNode, 
            timestamp: Date.now() 
          });
        }

        return deserializedNode;
      });

      // Process edges with caching
      const edges: IEdge[] = dbGraph.edges.map(edge => {
        const cacheKey = `mem_${edge.id}`;
        const cached = this.edgeCache.get(cacheKey);

        if (cached && cached.data) {
          return cached.data;
        }

        const deserializedEdge: IEdge = {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type as EdgeType,
          weight: edge.weight,
          style: edge.style,
          metadata: edge.metadata
        };

        if (this.edgeCache.size < MAX_CACHE_SIZE) {
          this.edgeCache.set(cacheKey, { 
            data: deserializedEdge, 
            timestamp: Date.now() 
          });
        }

        return deserializedEdge;
      });

      return {
        nodes,
        edges,
        layout: dbGraph.layout as LayoutType,
        layoutConfig: dbGraph.layoutConfig,
        metadata: {
          ...dbGraph.metadata,
          id: dbGraph.metadata.id
        },
        cachedLayout: dbGraph.cachedLayout,
        viewportState: dbGraph.viewportState
      };
    } catch (error) {
      throw new Error(`Failed to deserialize graph from database: ${error.message}`);
    }
  }

  /**
   * Transforms graph structure to React Flow compatible format with styling
   * @param graph The graph structure to serialize for frontend
   * @returns Frontend-ready graph object with React Flow properties
   */
  public serializeForFrontend(graph: IGraph): Record<string, any> {
    try {
      const reactFlowNodes = graph.nodes.map(node => ({
        id: node.id,
        type: this.mapNodeTypeToReactFlow(node.type),
        position: node.position,
        data: {
          ...node.data,
          validationStatus: node.validationStatus,
          metadata: node.metadata
        },
        style: {
          ...node.style,
          zIndex: this.calculateNodeZIndex(node)
        }
      }));

      const reactFlowEdges = graph.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: this.mapEdgeTypeToReactFlow(edge.type),
        data: {
          weight: edge.weight,
          metadata: edge.metadata
        },
        style: {
          ...edge.style,
          zIndex: edge.style.zIndex || 0
        },
        animated: edge.style.animated || false
      }));

      return {
        nodes: reactFlowNodes,
        edges: reactFlowEdges,
        layout: graph.layout,
        layoutConfig: this.optimizeLayoutConfig(graph.layoutConfig),
        viewport: graph.viewportState || {
          zoom: 1,
          position: { x: 0, y: 0 }
        }
      };
    } catch (error) {
      throw new Error(`Failed to serialize graph for frontend: ${error.message}`);
    }
  }

  /**
   * Converts React Flow graph data back to internal IGraph structure
   * @param frontendGraph Frontend graph object to deserialize
   * @returns Internal graph structure
   */
  public deserializeFromFrontend(frontendGraph: Record<string, any>): IGraph {
    try {
      const nodes: INode[] = frontendGraph.nodes.map(node => ({
        id: node.id,
        type: this.mapReactFlowNodeType(node.type),
        data: node.data,
        position: node.position,
        validationStatus: node.data.validationStatus || ValidationStatus.PENDING,
        style: this.extractNodeStyle(node),
        metadata: node.data.metadata
      }));

      const edges: IEdge[] = frontendGraph.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: this.mapReactFlowEdgeType(edge.type),
        weight: edge.data?.weight || 1,
        style: this.extractEdgeStyle(edge),
        metadata: edge.data?.metadata
      }));

      return {
        nodes,
        edges,
        layout: frontendGraph.layout || LayoutType.HIERARCHICAL,
        layoutConfig: frontendGraph.layoutConfig,
        metadata: {
          id: new Types.ObjectId(),
          name: 'Imported Graph',
          level: 'module',
          createdAt: new Date(),
          updatedAt: new Date(),
          nodeCount: nodes.length,
          edgeCount: edges.length,
          validationStatus: ValidationStatus.PENDING
        },
        viewportState: frontendGraph.viewport
      };
    } catch (error) {
      throw new Error(`Failed to deserialize graph from frontend: ${error.message}`);
    }
  }

  /**
   * Maps internal node types to React Flow compatible types
   * @private
   */
  private mapNodeTypeToReactFlow(type: NodeType): string {
    const typeMap: Record<NodeType, string> = {
      [NodeType.PIPELINE]: 'pipelineNode',
      [NodeType.ENVIRONMENT]: 'environmentNode',
      [NodeType.MODULE]: 'moduleNode',
      [NodeType.SERVICE]: 'serviceNode',
      [NodeType.RESOURCE]: 'resourceNode',
      [NodeType.DATA]: 'dataNode',
      [NodeType.VARIABLE]: 'variableNode',
      [NodeType.OUTPUT]: 'outputNode',
      [NodeType.LOCAL]: 'localNode',
      [NodeType.PROVIDER]: 'providerNode'
    };
    return typeMap[type] || 'defaultNode';
  }

  /**
   * Maps React Flow node types back to internal types
   * @private
   */
  private mapReactFlowNodeType(type: string): NodeType {
    const typeMap: Record<string, NodeType> = {
      'pipelineNode': NodeType.PIPELINE,
      'environmentNode': NodeType.ENVIRONMENT,
      'moduleNode': NodeType.MODULE,
      'serviceNode': NodeType.SERVICE,
      'resourceNode': NodeType.RESOURCE,
      'dataNode': NodeType.DATA,
      'variableNode': NodeType.VARIABLE,
      'outputNode': NodeType.OUTPUT,
      'localNode': NodeType.LOCAL,
      'providerNode': NodeType.PROVIDER
    };
    return typeMap[type] || NodeType.RESOURCE;
  }

  /**
   * Maps internal edge types to React Flow compatible types
   * @private
   */
  private mapEdgeTypeToReactFlow(type: EdgeType): string {
    const typeMap: Record<EdgeType, string> = {
      [EdgeType.DEPENDENCY]: 'smoothstep',
      [EdgeType.REFERENCE]: 'default',
      [EdgeType.FLOW]: 'straight',
      [EdgeType.MODULE_LINK]: 'step'
    };
    return typeMap[type] || 'default';
  }

  /**
   * Maps React Flow edge types back to internal types
   * @private
   */
  private mapReactFlowEdgeType(type: string): EdgeType {
    const typeMap: Record<string, EdgeType> = {
      'smoothstep': EdgeType.DEPENDENCY,
      'default': EdgeType.REFERENCE,
      'straight': EdgeType.FLOW,
      'step': EdgeType.MODULE_LINK
    };
    return typeMap[type] || EdgeType.REFERENCE;
  }

  /**
   * Calculates z-index for node layering
   * @private
   */
  private calculateNodeZIndex(node: INode): number {
    const baseZIndex = 1;
    const typeZIndex: Record<NodeType, number> = {
      [NodeType.PIPELINE]: 5,
      [NodeType.ENVIRONMENT]: 4,
      [NodeType.MODULE]: 3,
      [NodeType.SERVICE]: 2,
      [NodeType.RESOURCE]: 1
    };
    return baseZIndex + (typeZIndex[node.type] || 0);
  }

  /**
   * Optimizes layout configuration for better performance
   * @private
   */
  private optimizeLayoutConfig(config: any): any {
    return {
      ...config,
      animate: config.animate && window.innerWidth > 768, // Disable animations on mobile
      animationDuration: Math.min(config.animationDuration || 300, 500), // Cap animation duration
      rankSpacing: Math.max(config.rankSpacing || 50, 30), // Ensure minimum spacing
      nodeSpacing: Math.max(config.nodeSpacing || 50, 30)
    };
  }

  /**
   * Extracts and normalizes node style properties
   * @private
   */
  private extractNodeStyle(node: any): any {
    return {
      width: node.style?.width,
      height: node.style?.height,
      backgroundColor: node.style?.backgroundColor,
      borderColor: node.style?.borderColor,
      borderWidth: node.style?.borderWidth,
      borderStyle: node.style?.borderStyle,
      opacity: node.style?.opacity,
      icon: node.style?.icon,
      fontSize: node.style?.fontSize,
      fontFamily: node.style?.fontFamily,
      zIndex: node.style?.zIndex
    };
  }

  /**
   * Extracts and normalizes edge style properties
   * @private
   */
  private extractEdgeStyle(edge: any): any {
    return {
      strokeWidth: edge.style?.strokeWidth,
      strokeColor: edge.style?.stroke,
      strokeStyle: edge.style?.strokeDasharray ? 'dashed' : 'solid',
      opacity: edge.style?.opacity,
      animated: edge.animated,
      labelFontSize: edge.style?.labelFontSize,
      labelFontFamily: edge.style?.labelFontFamily,
      zIndex: edge.style?.zIndex
    };
  }
}