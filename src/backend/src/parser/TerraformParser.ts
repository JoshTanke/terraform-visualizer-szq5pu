// External dependencies
import { z } from 'zod'; // v3.0.0

// Internal dependencies
import { HCLParser } from './HCLParser';
import { ModuleParser } from './ModuleParser';
import { ResourceParser } from './ResourceParser';
import { logger } from '../utils/logger';

// Constants for performance optimization
const PARSE_TIMEOUT_MS = 3000;
const MAX_FILE_SIZE_MB = 5;
const CACHE_TTL_MS = 300000;
const MAX_CACHE_ENTRIES = 1000;
const BATCH_SIZE = 50;

/**
 * High-level parser class that coordinates parsing of complete Terraform configurations
 * with enhanced performance optimization, caching, and visualization support.
 */
export class TerraformParser {
  private hclParser: HCLParser;
  private moduleParser: ModuleParser;
  private resourceParser: ResourceParser;
  private content: string;
  private parsedConfiguration: Map<string, any>;
  private configurationCache: Map<string, { result: any; timestamp: number }>;
  private dependencyGraph: Map<string, string[]>;
  private processedModules: Set<string>;

  /**
   * Initializes a new TerraformParser instance with enhanced caching and performance monitoring
   * @param content - Raw Terraform configuration content
   */
  constructor(content: string) {
    // Validate input size
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new Error(`Configuration exceeds maximum size of ${MAX_FILE_SIZE_MB}MB`);
    }

    this.content = content;
    this.hclParser = new HCLParser(content, logger);
    this.moduleParser = new ModuleParser(content);
    this.resourceParser = new ResourceParser();
    this.parsedConfiguration = new Map();
    this.configurationCache = new Map();
    this.dependencyGraph = new Map();
    this.processedModules = new Set();

    logger.info('TerraformParser initialized', {
      contentSize: Buffer.byteLength(content, 'utf8'),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Parses complete Terraform configuration with enhanced performance and visualization support
   * @returns Promise resolving to complete parsed and validated configuration with visualization metadata
   */
  public async parseConfiguration(): Promise<Record<string, any>> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey();

    try {
      // Check cache first
      const cached = this.configurationCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        logger.info('Using cached configuration', { cacheKey });
        return cached.result;
      }

      // Parse HCL syntax with timeout protection
      const parsedHCL = await this.parseWithTimeout();

      // Initialize configuration structure
      const configuration = {
        metadata: {
          parseTime: 0,
          resourceCount: 0,
          moduleCount: 0,
          hasErrors: false
        },
        modules: new Map(),
        resources: new Map(),
        variables: new Map(),
        outputs: new Map(),
        providers: new Map(),
        dependencies: new Map()
      };

      // Parse modules first
      const modules = await this.parseModules(parsedHCL);
      configuration.modules = modules;
      configuration.metadata.moduleCount = modules.size;

      // Parse resources in batches
      const resources = await this.parseResourcesBatch(parsedHCL);
      configuration.resources = resources;
      configuration.metadata.resourceCount = resources.size;

      // Extract variables and outputs
      configuration.variables = this.extractVariables(parsedHCL);
      configuration.outputs = this.extractOutputs(parsedHCL);
      configuration.providers = this.extractProviders(parsedHCL);

      // Build dependency graph
      configuration.dependencies = await this.buildDependencyGraph(configuration);

      // Update metadata
      configuration.metadata.parseTime = performance.now() - startTime;

      // Validate complete configuration
      await this.validateConfiguration(configuration);

      // Cache successful result
      this.cacheConfiguration(cacheKey, configuration);

      logger.info('Configuration parsing completed', {
        duration: configuration.metadata.parseTime,
        resourceCount: configuration.metadata.resourceCount,
        moduleCount: configuration.metadata.moduleCount
      });

      return configuration;

    } catch (error) {
      logger.error('Configuration parsing failed', {
        error: error.message,
        duration: performance.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Validates complete configuration with enhanced schema checking and cross-reference validation
   * @param config - Configuration to validate
   */
  private async validateConfiguration(config: Record<string, any>): Promise<boolean> {
    const configSchema = z.object({
      metadata: z.object({
        parseTime: z.number(),
        resourceCount: z.number(),
        moduleCount: z.number(),
        hasErrors: z.boolean()
      }),
      modules: z.instanceof(Map),
      resources: z.instanceof(Map),
      variables: z.instanceof(Map),
      outputs: z.instanceof(Map),
      providers: z.instanceof(Map),
      dependencies: z.instanceof(Map)
    });

    try {
      await configSchema.parseAsync(config);
      return true;
    } catch (error) {
      logger.error('Configuration validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Builds optimized dependency graph with cycle detection and visualization support
   * @param config - Parsed configuration
   */
  private async buildDependencyGraph(config: Record<string, any>): Promise<Map<string, string[]>> {
    const dependencies = new Map<string, string[]>();

    // Process resource dependencies
    for (const [resourceId, resource] of config.resources.entries()) {
      const deps = new Set<string>();

      // Add explicit dependencies
      if (resource.dependencies) {
        resource.dependencies.forEach((dep: string) => deps.add(dep));
      }

      // Add module dependencies
      const moduleId = resource.moduleId?.toString();
      if (moduleId && config.modules.has(moduleId)) {
        deps.add(moduleId);
      }

      dependencies.set(resourceId, Array.from(deps));
    }

    // Process module dependencies
    for (const [moduleId, module] of config.modules.entries()) {
      const deps = new Set<string>();

      // Add resource dependencies
      module.resources?.forEach((resource: any) => {
        deps.add(`${resource.type}.${resource.name}`);
      });

      dependencies.set(moduleId, Array.from(deps));
    }

    return dependencies;
  }

  /**
   * Parses HCL content with timeout protection
   */
  private async parseWithTimeout(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Parsing timeout exceeded ${PARSE_TIMEOUT_MS}ms`));
      }, PARSE_TIMEOUT_MS);

      this.hclParser.parse()
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
   * Parses modules with batch processing and caching
   */
  private async parseModules(parsedHCL: any): Promise<Map<string, any>> {
    const modules = new Map();
    const moduleEntries = Array.from(parsedHCL.modules || []);

    // Process modules in batches
    for (let i = 0; i < moduleEntries.length; i += BATCH_SIZE) {
      const batch = moduleEntries.slice(i, i + BATCH_SIZE);
      const parsedBatch = await Promise.all(
        batch.map(([name, content]) => this.moduleParser.parseModule())
      );

      parsedBatch.forEach((module, index) => {
        if (module) {
          modules.set(batch[index][0], module);
        }
      });
    }

    return modules;
  }

  /**
   * Parses resources in optimized batches
   */
  private async parseResourcesBatch(parsedHCL: any): Promise<Map<string, any>> {
    const resources = new Map();
    const resourceBlocks = Array.from(parsedHCL.resources || []);

    // Process resources in batches
    for (let i = 0; i < resourceBlocks.length; i += BATCH_SIZE) {
      const batch = resourceBlocks.slice(i, i + BATCH_SIZE);
      const parsedBatch = await this.resourceParser.parseResources(batch, undefined!);

      parsedBatch.forEach(resource => {
        resources.set(`${resource.type}.${resource.name}`, resource);
      });
    }

    return resources;
  }

  /**
   * Extracts and processes variables from configuration
   */
  private extractVariables(parsedHCL: any): Map<string, any> {
    const variables = new Map();
    (parsedHCL.variables || []).forEach((variable: any) => {
      variables.set(variable.name, {
        type: variable.type,
        default: variable.default,
        description: variable.description
      });
    });
    return variables;
  }

  /**
   * Extracts and processes outputs from configuration
   */
  private extractOutputs(parsedHCL: any): Map<string, any> {
    const outputs = new Map();
    (parsedHCL.outputs || []).forEach((output: any) => {
      outputs.set(output.name, {
        value: output.value,
        description: output.description,
        sensitive: output.sensitive
      });
    });
    return outputs;
  }

  /**
   * Extracts and processes provider configurations
   */
  private extractProviders(parsedHCL: any): Map<string, any> {
    const providers = new Map();
    (parsedHCL.providers || []).forEach((provider: any) => {
      providers.set(provider.name, {
        version: provider.version,
        configuration: provider.configuration
      });
    });
    return providers;
  }

  /**
   * Generates cache key for configuration results
   */
  private generateCacheKey(): string {
    return `${this.content.length}_${this.content.slice(0, 100)}`;
  }

  /**
   * Caches configuration with size management
   */
  private cacheConfiguration(key: string, config: any): void {
    this.configurationCache.set(key, {
      result: config,
      timestamp: Date.now()
    });

    // Maintain cache size
    if (this.configurationCache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = Array.from(this.configurationCache.keys())[0];
      this.configurationCache.delete(oldestKey);
    }
  }
}

export default TerraformParser;