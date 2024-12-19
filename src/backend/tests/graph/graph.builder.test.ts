import { describe, it, expect, beforeEach, jest } from 'jest';
import { GraphBuilder } from '../../src/graph/GraphBuilder';
import { 
  IGraph, 
  INode, 
  IEdge, 
  NodeType, 
  EdgeType, 
  ValidationStatus, 
  LayoutType 
} from '../../src/interfaces/IGraph';
import { Types } from 'mongoose';

describe('GraphBuilder', () => {
  let graphBuilder: GraphBuilder;
  
  beforeEach(() => {
    graphBuilder = new GraphBuilder();
    graphBuilder.clearCache();
  });

  describe('buildPipelineGraph', () => {
    it('should handle empty environments array', () => {
      const result = graphBuilder.buildPipelineGraph([]);
      
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.layout).toBe(LayoutType.HIERARCHICAL);
      expect(result.metadata.level).toBe('pipeline');
    });

    it('should create valid pipeline graph with single environment', () => {
      const environment = {
        _id: new Types.ObjectId(),
        name: 'Development',
        modules: [{ _id: new Types.ObjectId() }],
        resources: [{ _id: new Types.ObjectId() }]
      };

      const result = graphBuilder.buildPipelineGraph([environment]);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe(NodeType.ENVIRONMENT);
      expect(result.nodes[0].data.moduleCount).toBe(1);
      expect(result.nodes[0].data.resourceCount).toBe(1);
      expect(result.edges).toHaveLength(0);
    });

    it('should create valid pipeline graph with multiple environments', () => {
      const environments = [
        {
          _id: new Types.ObjectId(),
          name: 'Development',
          modules: [{ _id: new Types.ObjectId() }],
          validation: { errors: [] }
        },
        {
          _id: new Types.ObjectId(),
          name: 'Production',
          modules: [{ _id: new Types.ObjectId() }],
          validation: { errors: [] }
        }
      ];

      const result = graphBuilder.buildPipelineGraph(environments);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].type).toBe(EdgeType.FLOW);
      expect(result.layout).toBe(LayoutType.HIERARCHICAL);
    });

    it('should handle environment validation status correctly', () => {
      const environments = [
        {
          _id: new Types.ObjectId(),
          name: 'Development',
          modules: [{ 
            validation: { errors: ['Invalid configuration'] }
          }]
        }
      ];

      const result = graphBuilder.buildPipelineGraph(environments);

      expect(result.nodes[0].validationStatus).toBe(ValidationStatus.ERROR);
    });

    it('should utilize cache for repeated calls', () => {
      const environment = {
        _id: new Types.ObjectId(),
        name: 'Development',
        modules: []
      };

      const firstResult = graphBuilder.buildPipelineGraph([environment]);
      const secondResult = graphBuilder.buildPipelineGraph([environment]);

      expect(firstResult).toEqual(secondResult);
      expect(graphBuilder.getCacheStats()).toHaveProperty('hits', 1);
    });
  });

  describe('buildEnvironmentGraph', () => {
    it('should handle empty modules array', () => {
      const result = graphBuilder.buildEnvironmentGraph([]);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.layout).toBe(LayoutType.DAGRE);
    });

    it('should create valid environment graph with dependencies', () => {
      const moduleId1 = new Types.ObjectId();
      const moduleId2 = new Types.ObjectId();
      
      const modules = [
        {
          _id: moduleId1,
          name: 'VPC',
          source: 'terraform-aws-modules/vpc/aws',
          resources: [{ _id: new Types.ObjectId() }],
          dependencies: []
        },
        {
          _id: moduleId2,
          name: 'ECS',
          source: 'terraform-aws-modules/ecs/aws',
          resources: [{ _id: new Types.ObjectId() }],
          dependencies: [moduleId1]
        }
      ];

      const result = graphBuilder.buildEnvironmentGraph(modules);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].type).toBe(EdgeType.DEPENDENCY);
    });

    it('should handle module validation status correctly', () => {
      const modules = [
        {
          _id: new Types.ObjectId(),
          name: 'Invalid Module',
          resources: [{ 
            validation: { isValid: false }
          }]
        }
      ];

      const result = graphBuilder.buildEnvironmentGraph(modules);

      expect(result.nodes[0].validationStatus).toBe(ValidationStatus.ERROR);
    });

    it('should meet performance requirements', () => {
      const modules = Array.from({ length: 50 }, (_, i) => ({
        _id: new Types.ObjectId(),
        name: `Module ${i}`,
        resources: [{ _id: new Types.ObjectId() }],
        dependencies: []
      }));

      const startTime = Date.now();
      const result = graphBuilder.buildEnvironmentGraph(modules);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000); // 3 seconds max
      expect(result.nodes).toHaveLength(50);
    });
  });

  describe('buildModuleGraph', () => {
    it('should handle empty resources array', () => {
      const result = graphBuilder.buildModuleGraph([]);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.layout).toBe(LayoutType.FORCE);
    });

    it('should create valid module graph with resource dependencies', () => {
      const resourceId1 = new Types.ObjectId();
      const resourceId2 = new Types.ObjectId();

      const resources = [
        {
          _id: resourceId1,
          type: 'aws_vpc',
          name: 'main',
          provider: 'aws',
          validation: { isValid: true },
          dependencies: []
        },
        {
          _id: resourceId2,
          type: 'aws_subnet',
          name: 'public',
          provider: 'aws',
          validation: { isValid: true },
          dependencies: [resourceId1]
        }
      ];

      const result = graphBuilder.buildModuleGraph(resources);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].type).toBe(EdgeType.REFERENCE);
    });

    it('should handle complex resource relationships', () => {
      const vpc = new Types.ObjectId();
      const subnet = new Types.ObjectId();
      const instance = new Types.ObjectId();

      const resources = [
        {
          _id: vpc,
          type: 'aws_vpc',
          name: 'main',
          validation: { isValid: true },
          dependencies: []
        },
        {
          _id: subnet,
          type: 'aws_subnet',
          name: 'public',
          validation: { isValid: true },
          dependencies: [vpc]
        },
        {
          _id: instance,
          type: 'aws_instance',
          name: 'web',
          validation: { isValid: true },
          dependencies: [subnet]
        }
      ];

      const result = graphBuilder.buildModuleGraph(resources);

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
      expect(result.layout).toBe(LayoutType.FORCE);
    });

    it('should handle resource validation status', () => {
      const resources = [
        {
          _id: new Types.ObjectId(),
          type: 'aws_instance',
          name: 'web',
          validation: { isValid: false }
        }
      ];

      const result = graphBuilder.buildModuleGraph(resources);

      expect(result.nodes[0].validationStatus).toBe(ValidationStatus.ERROR);
    });

    it('should optimize graph layout for large resource sets', () => {
      const resources = Array.from({ length: 100 }, (_, i) => ({
        _id: new Types.ObjectId(),
        type: 'aws_instance',
        name: `instance_${i}`,
        validation: { isValid: true },
        dependencies: []
      }));

      const startTime = Date.now();
      const result = graphBuilder.buildModuleGraph(resources);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000); // 3 seconds max
      expect(result.nodes).toHaveLength(100);
      expect(result.metadata.performanceMetrics).toBeDefined();
    });
  });

  describe('cache management', () => {
    it('should clear cache successfully', () => {
      const module = {
        _id: new Types.ObjectId(),
        name: 'Test Module',
        resources: []
      };

      graphBuilder.buildEnvironmentGraph([module]);
      graphBuilder.clearCache();

      const cacheStats = graphBuilder.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });

    it('should handle cache expiration', () => {
      jest.useFakeTimers();

      const module = {
        _id: new Types.ObjectId(),
        name: 'Test Module',
        resources: []
      };

      graphBuilder.buildEnvironmentGraph([module]);
      
      // Advance time by 2 hours
      jest.advanceTimersByTime(1000 * 60 * 60 * 2);

      const cacheStats = graphBuilder.getCacheStats();
      expect(cacheStats.size).toBe(0);

      jest.useRealTimers();
    });
  });
});