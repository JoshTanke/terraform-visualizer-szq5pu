// External dependencies
import { parse as parseHCL } from 'hcl2-parser'; // v1.0.0
import { z } from 'zod'; // v3.0.0
import { Logger } from '../utils/logger'; // v8.0.0
import { injectable } from 'inversify'; // Inferred from @injectable decorator

// Internal dependencies
import { ResourceBlock } from './blocks/ResourceBlock';
import { ModuleBlock } from './blocks/ModuleBlock';
import { ValidationError, ParseError } from '../utils/errors';
import { validateTerraformSyntax, validateResourceReferences } from '../utils/validation';

// Constants
const BLOCK_TYPES = {
  RESOURCE: 'resource',
  MODULE: 'module',
  VARIABLE: 'variable',
  OUTPUT: 'output',
  PROVIDER: 'provider',
  DATA: 'data'
} as const;

const PARSE_TIMEOUT = 5000; // 5 seconds timeout for parsing operations

// Types
interface ParseResult {
  resources: Map<string, any>;
  modules: Map<string, any>;
  variables: Map<string, any>;
  outputs: Map<string, any>;
  providers: Map<string, any>;
  data: Map<string, any>;
  dependencies: Map<string, Set<string>>;
  metadata: {
    parseTime: number;
    blockCount: number;
    hasErrors: boolean;
  };
}

/**
 * High-performance parser for Terraform HCL configurations with caching and validation support.
 * Implements thread-safe parsing with comprehensive error handling and dependency tracking.
 */
@injectable()
export class HCLParser {
  private content: string;
  private parsedBlocks: Map<string, any>;
  private dependencies: Map<string, Set<string>>;
  private logger: Logger;
  private validationSchema: z.ZodSchema;
  private parseCache: Map<string, { result: ParseResult; timestamp: number }>;

  /**
   * Initializes the HCL parser with caching and validation capabilities
   * @param content - Raw HCL content to parse
   * @param logger - Logger instance for performance and error tracking
   */
  constructor(content: string, logger: Logger) {
    this.content = content;
    this.parsedBlocks = new Map();
    this.dependencies = new Map();
    this.parseCache = new Map();
    this.logger = logger;

    // Initialize validation schema
    this.validationSchema = z.object({
      content: z.string().min(1),
      blockTypes: z.array(z.enum(Object.values(BLOCK_TYPES))),
      allowEmpty: z.boolean().optional(),
      strict: z.boolean().optional()
    });
  }

  /**
   * Parses complete HCL content with caching and validation
   * @returns Promise resolving to structured parse results
   */
  public async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey();
      const cached = this.parseCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < PARSE_TIMEOUT) {
        this.logger.debug('Using cached parse result', { cacheKey });
        return cached.result;
      }

      // Validate syntax first
      const syntaxValidation = await validateTerraformSyntax(this.content);
      if (!syntaxValidation.isValid) {
        throw new ParseError(
          'Invalid HCL syntax',
          { validation: syntaxValidation },
          'content',
          syntaxValidation.errors || []
        );
      }

      // Parse HCL content with timeout protection
      const parsedContent = await this.parseWithTimeout();

      // Initialize result containers
      const result: ParseResult = {
        resources: new Map(),
        modules: new Map(),
        variables: new Map(),
        outputs: new Map(),
        providers: new Map(),
        data: new Map(),
        dependencies: new Map(),
        metadata: {
          parseTime: 0,
          blockCount: 0,
          hasErrors: false
        }
      };

      // Process blocks in parallel for performance
      await Promise.all([
        this.parseResourceBlocks(parsedContent, result),
        this.parseModuleBlocks(parsedContent, result),
        this.parseOtherBlocks(parsedContent, result)
      ]);

      // Build dependency graph
      result.dependencies = await this.buildDependencyGraph(result);

      // Update metadata
      result.metadata = {
        parseTime: Date.now() - startTime,
        blockCount: this.countBlocks(result),
        hasErrors: false
      };

      // Cache successful parse result
      this.parseCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      this.logger.error('HCL parsing failed', {
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Parses HCL content with timeout protection
   */
  private async parseWithTimeout(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Parsing timeout exceeded ${PARSE_TIMEOUT}ms`));
      }, PARSE_TIMEOUT);

      parseHCL(this.content)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Parses resource blocks using ResourceBlock parser
   */
  private async parseResourceBlocks(parsedContent: any, result: ParseResult): Promise<void> {
    const resourceBlocks = parsedContent.resource || [];
    
    await Promise.all(resourceBlocks.map(async (block: any) => {
      try {
        const resourceParser = new ResourceBlock(block);
        const parsedResource = await resourceParser.parse();
        result.resources.set(`${parsedResource.type}.${parsedResource.name}`, parsedResource);
      } catch (error) {
        this.logger.error('Resource block parsing failed', { error: error.message, block });
        result.metadata.hasErrors = true;
      }
    }));
  }

  /**
   * Parses module blocks using ModuleBlock parser
   */
  private async parseModuleBlocks(parsedContent: any, result: ParseResult): Promise<void> {
    const moduleBlocks = parsedContent.module || [];
    
    await Promise.all(moduleBlocks.map(async (block: any) => {
      try {
        const moduleParser = new ModuleBlock(block, { x: 0, y: 0 }); // Position will be adjusted later
        const parsedModule = await moduleParser.parse();
        if (parsedModule.name) {
          result.modules.set(parsedModule.name, parsedModule);
        }
      } catch (error) {
        this.logger.error('Module block parsing failed', { error: error.message, block });
        result.metadata.hasErrors = true;
      }
    }));
  }

  /**
   * Parses other block types (variables, outputs, providers, data)
   */
  private async parseOtherBlocks(parsedContent: any, result: ParseResult): Promise<void> {
    // Parse variables
    (parsedContent.variable || []).forEach((block: any) => {
      result.variables.set(block.name, block);
    });

    // Parse outputs
    (parsedContent.output || []).forEach((block: any) => {
      result.outputs.set(block.name, block);
    });

    // Parse providers
    (parsedContent.provider || []).forEach((block: any) => {
      result.providers.set(block.name, block);
    });

    // Parse data sources
    (parsedContent.data || []).forEach((block: any) => {
      result.data.set(`${block.type}.${block.name}`, block);
    });
  }

  /**
   * Builds comprehensive dependency graph for all resources and modules
   */
  private async buildDependencyGraph(result: ParseResult): Promise<Map<string, Set<string>>> {
    const dependencies = new Map<string, Set<string>>();

    // Process resource dependencies
    result.resources.forEach((resource, resourceId) => {
      const deps = new Set<string>();
      
      // Add explicit dependencies
      if (resource.dependencies) {
        resource.dependencies.forEach((dep: string) => deps.add(dep));
      }

      // Add implicit dependencies from attributes
      this.findImplicitDependencies(resource.attributes, deps);

      dependencies.set(resourceId, deps);
    });

    // Process module dependencies
    result.modules.forEach((module, moduleId) => {
      const deps = new Set<string>();
      
      // Add dependencies from module variables
      if (module.variables) {
        this.findImplicitDependencies(module.variables, deps);
      }

      dependencies.set(moduleId, deps);
    });

    return dependencies;
  }

  /**
   * Recursively finds implicit dependencies in attributes
   */
  private findImplicitDependencies(obj: any, deps: Set<string>): void {
    if (typeof obj === 'string') {
      const references = obj.match(/\$\{([^}]+)\}/g) || [];
      references.forEach(ref => {
        const cleanRef = ref.slice(2, -1);
        if (this.isResourceReference(cleanRef)) {
          deps.add(cleanRef);
        }
      });
    } else if (Array.isArray(obj)) {
      obj.forEach(item => this.findImplicitDependencies(item, deps));
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(value => this.findImplicitDependencies(value, deps));
    }
  }

  /**
   * Checks if a reference string points to a resource
   */
  private isResourceReference(ref: string): boolean {
    return ref.startsWith('resource.') || ref.startsWith('module.');
  }

  /**
   * Generates cache key for parse results
   */
  private generateCacheKey(): string {
    return `${this.content.length}_${this.content.slice(0, 100)}`;
  }

  /**
   * Counts total blocks in parse results
   */
  private countBlocks(result: ParseResult): number {
    return result.resources.size +
           result.modules.size +
           result.variables.size +
           result.outputs.size +
           result.providers.size +
           result.data.size;
  }
}

export default HCLParser;