import { v4 as uuidv4 } from 'uuid'; // v8.3.2
import { 
  IGraph, 
  INode, 
  IEdge, 
  NodeType, 
  EdgeType, 
  ValidationStatus,
  LayoutType,
  GraphMetadata
} from '../interfaces/IGraph';
import { GraphLayout } from './GraphLayout';
import { GraphOptimizer } from './GraphOptimizer';
import { Types } from 'mongoose';

/**
 * Core class responsible for constructing optimized graph representations of Terraform infrastructure
 * with support for multiple visualization levels (Pipeline, Environment, Module).
 * @version 1.0.0
 */
export class GraphBuilder {
  private optimizer: GraphOptimizer;
  private nodeMap: Map<string, INode>;
  private dependencyMap: Map<string, Set<string>>;
  private graphCache: Map<string, IGraph>;
  private readonly CACHE_CLEANUP_INTERVAL = 1000 * 60 * 30; // 30 minutes

  constructor() {
    // Initialize GraphOptimizer with performance-optimized configuration
    this.optimizer = new GraphOptimizer({
      minNodeDistance: 100,
      edgeLength: 200,
      forceStrength: 0.8,
      bundlingStrength: 0.6,
      iterations: 50
    });

    this.nodeMap = new Map<string, INode>();
    this.dependencyMap = new Map<string, Set<string>>();
    this.graphCache = new Map<string, IGraph>();

    // Setup periodic cache cleanup
    setInterval(() => this.cleanupCache(), this.CACHE_CLEANUP_INTERVAL);
  }

  /**
   * Builds an optimized graph representation of the deployment pipeline
   * @param environments Array of environment configurations
   * @returns Pipeline-level graph structure
   */
  public buildPipelineGraph(environments: any[]): IGraph {
    const cacheKey = `pipeline-${environments.map(e => e._id).join('-')}`;
    const cachedGraph = this.graphCache.get(cacheKey);
    
    if (cachedGraph) {
      return cachedGraph;
    }

    const nodes: INode[] = [];
    const edges: IEdge[] = [];

    // Create environment nodes with consistent positioning
    environments.forEach((env, index) => {
      const node: INode = {
        id: uuidv4(),
        type: NodeType.ENVIRONMENT,
        data: {
          name: env.name,
          moduleCount: env.modules?.length || 0,
          resourceCount: env.resources?.length || 0
        },
        position: {
          x: 200 + (index * 300),
          y: 200
        },
        validationStatus: this.getEnvironmentValidationStatus(env),
        style: {
          width: 180,
          height: 100,
          backgroundColor: '#f0f9ff',
          borderColor: '#3b82f6',
          borderWidth: 2
        },
        metadata: {
          environmentId: env._id,
          description: env.description,
          tags: env.tags
        }
      };

      nodes.push(node);
      this.nodeMap.set(node.id, node);

      // Create pipeline flow edges between environments
      if (index > 0) {
        edges.push({
          id: uuidv4(),
          source: nodes[index - 1].id,
          target: node.id,
          type: EdgeType.FLOW,
          weight: 1,
          style: {
            strokeWidth: 2,
            strokeColor: '#3b82f6',
            animated: true
          }
        });
      }
    });

    const graph: IGraph = {
      nodes,
      edges,
      layout: LayoutType.HIERARCHICAL,
      layoutConfig: {
        direction: 'LR',
        nodeSpacing: 150,
        rankSpacing: 200,
        animate: true
      },
      metadata: this.createGraphMetadata('pipeline', nodes.length, edges.length)
    };

    // Apply optimization and cache the result
    const optimizedGraph = this.optimizer.optimizeGraph(graph);
    this.graphCache.set(cacheKey, optimizedGraph);

    return optimizedGraph;
  }

  /**
   * Builds an optimized graph representation of an environment's modules
   * @param modules Array of module configurations
   * @returns Environment-level graph structure
   */
  public buildEnvironmentGraph(modules: any[]): IGraph {
    const cacheKey = `environment-${modules.map(m => m._id).join('-')}`;
    const cachedGraph = this.graphCache.get(cacheKey);

    if (cachedGraph) {
      return cachedGraph;
    }

    const nodes: INode[] = [];
    const edges: IEdge[] = [];
    this.dependencyMap.clear();

    // Create module nodes with dependency tracking
    modules.forEach(module => {
      const node: INode = {
        id: uuidv4(),
        type: NodeType.MODULE,
        data: {
          name: module.name,
          source: module.source,
          resourceCount: module.resources?.length || 0
        },
        position: {
          x: 0,
          y: 0
        },
        validationStatus: this.getModuleValidationStatus(module),
        style: {
          width: 200,
          height: 120,
          backgroundColor: '#f0fdf4',
          borderColor: '#22c55e',
          borderWidth: 2
        },
        metadata: {
          moduleId: module._id,
          description: module.description
        }
      };

      nodes.push(node);
      this.nodeMap.set(node.id, node);

      // Track module dependencies
      if (module.dependencies) {
        this.dependencyMap.set(node.id, new Set(module.dependencies));
      }
    });

    // Create dependency edges
    this.dependencyMap.forEach((dependencies, sourceId) => {
      dependencies.forEach(targetModuleId => {
        const targetNode = nodes.find(n => n.metadata?.moduleId.toString() === targetModuleId.toString());
        if (targetNode) {
          edges.push({
            id: uuidv4(),
            source: sourceId,
            target: targetNode.id,
            type: EdgeType.DEPENDENCY,
            weight: 1,
            style: {
              strokeWidth: 1.5,
              strokeColor: '#22c55e',
              strokeStyle: 'dashed'
            }
          });
        }
      });
    });

    const graph: IGraph = {
      nodes,
      edges,
      layout: LayoutType.DAGRE,
      layoutConfig: {
        rankdir: 'TB',
        align: 'UL',
        ranksep: 100,
        nodesep: 80,
        animate: true
      },
      metadata: this.createGraphMetadata('environment', nodes.length, edges.length)
    };

    // Apply optimization and cache the result
    const optimizedGraph = this.optimizer.optimizeGraph(graph);
    this.graphCache.set(cacheKey, optimizedGraph);

    return optimizedGraph;
  }

  /**
   * Builds an optimized graph representation of a module's resources
   * @param resources Array of resource configurations
   * @returns Module-level graph structure
   */
  public buildModuleGraph(resources: any[]): IGraph {
    const cacheKey = `module-${resources.map(r => r._id).join('-')}`;
    const cachedGraph = this.graphCache.get(cacheKey);

    if (cachedGraph) {
      return cachedGraph;
    }

    const nodes: INode[] = [];
    const edges: IEdge[] = [];
    this.nodeMap.clear();

    // Create resource nodes
    resources.forEach(resource => {
      const node: INode = {
        id: uuidv4(),
        type: NodeType.RESOURCE,
        data: {
          type: resource.type,
          name: resource.name,
          provider: resource.provider,
          attributes: resource.attributes
        },
        position: resource.position || { x: 0, y: 0 },
        validationStatus: resource.validation?.isValid ? 
          ValidationStatus.VALID : ValidationStatus.ERROR,
        style: {
          width: 160,
          height: 90,
          backgroundColor: '#fef2f2',
          borderColor: '#ef4444',
          borderWidth: 2,
          icon: resource.metadata?.icon
        },
        metadata: {
          resourceId: resource._id,
          description: resource.metadata?.description
        }
      };

      nodes.push(node);
      this.nodeMap.set(node.id, node);
    });

    // Create resource dependency edges
    resources.forEach(resource => {
      if (resource.dependencies) {
        resource.dependencies.forEach((depId: Types.ObjectId) => {
          const targetNode = nodes.find(n => 
            n.metadata?.resourceId.toString() === depId.toString()
          );
          
          if (targetNode) {
            edges.push({
              id: uuidv4(),
              source: nodes.find(n => 
                n.metadata?.resourceId.toString() === resource._id.toString()
              )!.id,
              target: targetNode.id,
              type: EdgeType.REFERENCE,
              weight: 1,
              style: {
                strokeWidth: 1,
                strokeColor: '#ef4444',
                animated: true
              }
            });
          }
        });
      }
    });

    const graph: IGraph = {
      nodes,
      edges,
      layout: LayoutType.FORCE,
      layoutConfig: {
        forceStrength: 0.3,
        centerForce: 0.1,
        linkDistance: 150,
        animate: true
      },
      metadata: this.createGraphMetadata('module', nodes.length, edges.length)
    };

    // Apply optimization and cache the result
    const optimizedGraph = this.optimizer.optimizeGraph(graph);
    this.graphCache.set(cacheKey, optimizedGraph);

    return optimizedGraph;
  }

  /**
   * Creates standardized graph metadata
   * @param level Visualization level
   * @param nodeCount Number of nodes
   * @param edgeCount Number of edges
   * @returns Graph metadata object
   */
  private createGraphMetadata(
    level: 'pipeline' | 'environment' | 'module',
    nodeCount: number,
    edgeCount: number
  ): GraphMetadata {
    return {
      id: new Types.ObjectId(),
      name: `${level}-graph`,
      level,
      nodeCount,
      edgeCount,
      validationStatus: ValidationStatus.VALID,
      createdAt: new Date(),
      updatedAt: new Date(),
      performanceMetrics: {
        renderTime: 0,
        layoutTime: 0,
        lastOptimization: new Date()
      }
    };
  }

  /**
   * Determines environment validation status based on its modules
   * @param environment Environment configuration
   * @returns Validation status
   */
  private getEnvironmentValidationStatus(environment: any): ValidationStatus {
    if (!environment.modules?.length) {
      return ValidationStatus.WARNING;
    }
    
    const hasErrors = environment.modules.some((m: any) => 
      m.validation?.errors?.length > 0
    );
    
    return hasErrors ? ValidationStatus.ERROR : ValidationStatus.VALID;
  }

  /**
   * Determines module validation status based on its resources
   * @param module Module configuration
   * @returns Validation status
   */
  private getModuleValidationStatus(module: any): ValidationStatus {
    if (!module.resources?.length) {
      return ValidationStatus.WARNING;
    }
    
    const hasErrors = module.resources.some((r: any) => 
      !r.validation?.isValid
    );
    
    return hasErrors ? ValidationStatus.ERROR : ValidationStatus.VALID;
  }

  /**
   * Cleans up expired cache entries
   */
  private cleanupCache(): void {
    const MAX_CACHE_AGE = 1000 * 60 * 60; // 1 hour
    const now = Date.now();

    for (const [key, graph] of this.graphCache.entries()) {
      const cacheAge = now - new Date(graph.metadata.updatedAt).getTime();
      if (cacheAge > MAX_CACHE_AGE) {
        this.graphCache.delete(key);
      }
    }
  }
}