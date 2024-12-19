// External dependencies
import { z } from 'zod'; // v3.0.0
import { parse as parseHCL } from 'hcl2-parser'; // v1.0.0

// Internal dependencies
import { IResource } from '../../interfaces/IResource';
import { validateResourceReferences, validateSchema } from '../../utils/validation';
import { ValidationError } from '../../utils/errors';
import { Logger } from '../../utils/logger';

/**
 * Parser class for handling Terraform resource block definitions with optimized performance
 * and comprehensive validation support.
 */
export class ResourceBlock {
  private readonly blockContent: any;
  private readonly dependencies: Map<string, string[]>;
  private readonly parseCache: Map<string, any>;
  private readonly resourceSchema: z.ZodSchema;
  private readonly logger: Logger;

  /**
   * Initializes a new resource block parser with caching and validation setup
   * @param blockContent - The raw HCL block content to parse
   */
  constructor(blockContent: any) {
    this.blockContent = blockContent;
    this.dependencies = new Map();
    this.parseCache = new Map();
    this.logger = Logger.getInstance();

    // Define Zod schema for resource validation
    this.resourceSchema = z.object({
      type: z.string().regex(/^[a-zA-Z0-9_]+_[a-zA-Z0-9_]+$/),
      name: z.string().regex(/^[a-zA-Z0-9_-]+$/),
      provider: z.string().optional(),
      attributes: z.record(z.unknown()),
      dependencies: z.array(z.string()),
      count: z.union([z.number().int(), z.string()]).optional(),
      forEach: z.record(z.unknown()).optional(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number().optional(),
        height: z.number().optional()
      }),
      metadata: z.object({
        icon: z.string().optional(),
        color: z.string().optional(),
        description: z.string().optional()
      })
    });
  }

  /**
   * Parses a resource block into structured data with validation and optimization
   * @returns Parsed and validated resource object
   */
  public async parse(): Promise<IResource> {
    try {
      const cacheKey = JSON.stringify(this.blockContent);
      
      // Check parse cache
      if (this.parseCache.has(cacheKey)) {
        this.logger.debug('Using cached resource parse result', { cacheKey });
        return this.parseCache.get(cacheKey);
      }

      // Extract basic resource information
      const { type, name } = this.extractResourceIdentifiers();
      
      // Parse attributes and meta-arguments
      const attributes = await this.parseAttributes();
      const { count, forEach } = this.parseMetaArguments();
      
      // Extract provider configuration
      const provider = this.extractProvider(type);
      
      // Process dependencies
      const dependencies = await this.extractDependencies(attributes);

      // Generate visualization data
      const position = this.generatePosition();
      const metadata = this.generateMetadata(type);

      // Construct resource object
      const resource: IResource = {
        type,
        name,
        provider,
        attributes,
        dependencies,
        count,
        forEach,
        position,
        metadata,
        validation: {
          isValid: true,
          errors: [],
          warnings: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Validate complete resource
      await this.validateResource(resource);

      // Cache successful parse result
      this.parseCache.set(cacheKey, resource);

      return resource;

    } catch (error) {
      this.logger.error('Resource parsing failed', {
        error: error.message,
        blockContent: this.blockContent
      });
      throw error;
    }
  }

  /**
   * Extracts resource type and name from block content
   */
  private extractResourceIdentifiers(): { type: string; name: string } {
    if (!this.blockContent.labels || this.blockContent.labels.length !== 2) {
      throw new ValidationError(
        [{ field: 'resource', message: 'Invalid resource block structure' }],
        'parse'
      );
    }

    return {
      type: this.blockContent.labels[0],
      name: this.blockContent.labels[1]
    };
  }

  /**
   * Parses and validates resource attributes
   */
  private async parseAttributes(): Promise<Record<string, any>> {
    const attributes = this.blockContent.body || {};
    
    // Remove meta-arguments from attributes
    const metaArgs = ['count', 'for_each', 'provider', 'depends_on', 'lifecycle'];
    metaArgs.forEach(arg => delete attributes[arg]);

    return attributes;
  }

  /**
   * Parses meta-arguments (count, for_each)
   */
  private parseMetaArguments(): { count?: number | string; forEach?: Record<string, any> } {
    const metaArgs: { count?: number | string; forEach?: Record<string, any> } = {};

    if (this.blockContent.body.count !== undefined) {
      metaArgs.count = this.blockContent.body.count;
    }

    if (this.blockContent.body.for_each !== undefined) {
      metaArgs.forEach = this.blockContent.body.for_each;
    }

    return metaArgs;
  }

  /**
   * Extracts provider configuration from resource type
   */
  private extractProvider(type: string): string {
    const providerOverride = this.blockContent.body.provider;
    if (providerOverride) {
      return providerOverride;
    }

    // Extract provider from resource type (e.g., 'aws_instance' -> 'aws')
    return type.split('_')[0];
  }

  /**
   * Extracts and validates resource dependencies
   */
  private async extractDependencies(attributes: Record<string, any>): Promise<string[]> {
    const dependencies = new Set<string>();

    // Add explicit depends_on
    const explicitDeps = this.blockContent.body.depends_on || [];
    explicitDeps.forEach((dep: string) => dependencies.add(dep));

    // Scan attributes for implicit dependencies
    const implicitDeps = this.scanForDependencies(attributes);
    implicitDeps.forEach(dep => dependencies.add(dep));

    return Array.from(dependencies);
  }

  /**
   * Recursively scans attributes for resource references
   */
  private scanForDependencies(obj: any): string[] {
    const dependencies: string[] = [];

    const scan = (value: any): void => {
      if (typeof value === 'string') {
        // Check for interpolation syntax ${resource.name}
        const matches = value.match(/\$\{([^}]+)\}/g);
        if (matches) {
          matches.forEach(match => {
            const ref = match.slice(2, -1);
            if (ref.startsWith('resource.')) {
              dependencies.push(ref);
            }
          });
        }
      } else if (Array.isArray(value)) {
        value.forEach(scan);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(scan);
      }
    };

    scan(obj);
    return dependencies;
  }

  /**
   * Generates position data for visualization
   */
  private generatePosition(): IResource['position'] {
    return {
      x: Math.floor(Math.random() * 800),
      y: Math.floor(Math.random() * 600),
      width: 150,
      height: 100
    };
  }

  /**
   * Generates metadata for enhanced visualization
   */
  private generateMetadata(type: string): IResource['metadata'] {
    return {
      icon: `resource-icons/${type}.svg`,
      color: '#4A90E2',
      description: `${type} resource`
    };
  }

  /**
   * Validates the complete resource structure
   */
  private async validateResource(resource: IResource): Promise<void> {
    try {
      // Validate against Zod schema
      await this.resourceSchema.parseAsync(resource);

      // Validate resource references
      const refValidation = await validateResourceReferences(
        new Map([[`${resource.type}.${resource.name}`, resource]]),
        { allowCrossModule: true }
      );

      if (!refValidation.isValid) {
        throw new ValidationError(
          [{ field: 'dependencies', message: 'Invalid resource references detected' }],
          'reference',
          { cycles: refValidation.cycles }
        );
      }

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ValidationError(
        [{ field: 'resource', message: error.message }],
        'validation'
      );
    }
  }
}

export default ResourceBlock;