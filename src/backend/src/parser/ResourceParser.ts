// External dependencies
import { Types } from 'mongoose'; // v6.0.0
import { performance } from 'perf_hooks';

// Internal dependencies
import { IResource } from '../interfaces/IResource';
import ResourceBlock from './blocks/ResourceBlock';
import { validateResourceReferences } from '../utils/validation';
import { ValidationError, ParseError } from '../utils/errors';
import { Logger } from '../utils/logger';

/**
 * High-level parser for Terraform resource blocks with comprehensive support
 * for meta-arguments, dependency resolution, and performance optimization.
 */
export class ResourceParser {
  private resourceBlocks: Map<string, ResourceBlock>;
  private parsedResources: Map<string, IResource>;
  private dependencyGraph: Map<string, Set<string>>;
  private readonly logger: Logger;
  private readonly perfObserver: PerformanceObserver;

  /**
   * Initializes the resource parser with performance monitoring
   */
  constructor() {
    this.resourceBlocks = new Map();
    this.parsedResources = new Map();
    this.dependencyGraph = new Map();
    this.logger = Logger.getInstance();

    // Initialize performance monitoring
    this.perfObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        this.logger.debug('Resource parsing performance', {
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
        });
      });
    });
    this.perfObserver.observe({ entryTypes: ['measure'] });
  }

  /**
   * Parses a single resource block with meta-argument support
   * @param blockContent - The resource block content to parse
   * @param moduleId - The ID of the parent module
   * @returns Parsed and validated resource object
   */
  public async parseResource(
    blockContent: any,
    moduleId: Types.ObjectId
  ): Promise<IResource> {
    const perfMark = `parse_resource_${Date.now()}`;
    performance.mark(`${perfMark}_start`);

    try {
      // Create and parse resource block
      const resourceBlock = new ResourceBlock(blockContent);
      const parsedResource = await resourceBlock.parse();

      // Add module reference
      parsedResource.moduleId = moduleId;
      parsedResource._id = new Types.ObjectId();

      // Validate resource references
      await this.validateResourceReferences(parsedResource);

      // Cache the parsed resource
      const resourceKey = `${parsedResource.type}.${parsedResource.name}`;
      this.parsedResources.set(resourceKey, parsedResource);

      performance.mark(`${perfMark}_end`);
      performance.measure(
        'Resource Parse Duration',
        `${perfMark}_start`,
        `${perfMark}_end`
      );

      return parsedResource;

    } catch (error) {
      this.logger.error('Failed to parse resource', {
        error: error.message,
        blockContent,
        moduleId: moduleId.toString(),
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ParseError(
        'Resource parsing failed',
        { blockContent },
        'resource_block',
        []
      );
    }
  }

  /**
   * Batch processes multiple resource blocks with optimized performance
   * @param blocks - Array of resource blocks to parse
   * @param moduleId - The ID of the parent module
   * @returns Array of parsed and validated resources
   */
  public async parseResources(
    blocks: any[],
    moduleId: Types.ObjectId
  ): Promise<IResource[]> {
    const batchMark = `parse_resources_batch_${Date.now()}`;
    performance.mark(`${batchMark}_start`);

    try {
      // Filter resource blocks
      const resourceBlocks = blocks.filter(
        (block) => block.type === 'resource'
      );

      // Group blocks by resource type for optimized processing
      const groupedBlocks = this.groupBlocksByType(resourceBlocks);
      const parsedResources: IResource[] = [];

      // Process each group in parallel
      await Promise.all(
        Array.from(groupedBlocks.entries()).map(async ([type, blocks]) => {
          const resources = await Promise.all(
            blocks.map((block) => this.parseResource(block, moduleId))
          );
          parsedResources.push(...resources);
        })
      );

      // Resolve dependencies between resources
      await this.resolveDependencies(parsedResources);

      performance.mark(`${batchMark}_end`);
      performance.measure(
        'Resource Batch Parse Duration',
        `${batchMark}_start`,
        `${batchMark}_end`
      );

      return parsedResources;

    } catch (error) {
      this.logger.error('Failed to parse resources batch', {
        error: error.message,
        blockCount: blocks.length,
        moduleId: moduleId.toString(),
      });
      throw error;
    }
  }

  /**
   * Groups resource blocks by their type for optimized processing
   * @param blocks - Array of resource blocks
   * @returns Map of resource types to their blocks
   */
  private groupBlocksByType(blocks: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    
    for (const block of blocks) {
      const type = block.labels[0];
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push(block);
    }

    return grouped;
  }

  /**
   * Advanced dependency resolution with cycle detection
   * @param resources - Array of resources to resolve dependencies for
   */
  private async resolveDependencies(resources: IResource[]): Promise<void> {
    try {
      // Build dependency graph
      this.dependencyGraph.clear();
      for (const resource of resources) {
        const resourceKey = `${resource.type}.${resource.name}`;
        const dependencies = new Set<string>();

        // Add explicit dependencies
        if (resource.dependencies) {
          for (const depId of resource.dependencies) {
            const depResource = resources.find(r => r._id.equals(depId));
            if (depResource) {
              dependencies.add(`${depResource.type}.${depResource.name}`);
            }
          }
        }

        this.dependencyGraph.set(resourceKey, dependencies);
      }

      // Validate dependencies
      const validationResult = await validateResourceReferences(
        new Map(resources.map(r => [`${r.type}.${r.name}`, r])),
        { allowCrossModule: true }
      );

      if (!validationResult.isValid) {
        throw new ValidationError(
          [{ field: 'dependencies', message: 'Circular dependency detected' }],
          'dependency',
          { cycles: validationResult.cycles }
        );
      }

    } catch (error) {
      this.logger.error('Failed to resolve dependencies', {
        error: error.message,
        resourceCount: resources.length,
      });
      throw error;
    }
  }

  /**
   * Validates resource references and cross-module dependencies
   * @param resource - Resource to validate references for
   */
  private async validateResourceReferences(resource: IResource): Promise<void> {
    try {
      const resourceKey = `${resource.type}.${resource.name}`;
      const references = new Map([[resourceKey, resource]]);

      const validationResult = await validateResourceReferences(references, {
        allowCrossModule: true,
        checkDeprecated: true,
      });

      if (!validationResult.isValid) {
        throw new ValidationError(
          [{ field: 'references', message: 'Invalid resource references' }],
          'reference',
          { validation: validationResult }
        );
      }

    } catch (error) {
      this.logger.error('Resource reference validation failed', {
        error: error.message,
        resource: `${resource.type}.${resource.name}`,
      });
      throw error;
    }
  }
}

export default ResourceParser;