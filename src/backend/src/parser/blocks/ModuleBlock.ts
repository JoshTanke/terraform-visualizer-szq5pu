import { z } from 'zod'; // v3.0.0
import { parse } from 'hcl2-parser'; // v1.0.0
import { IModule } from '../../interfaces/IModule';
import { IResource } from '../../interfaces/IResource';

// Constants for module validation and caching
const MODULE_SOURCE_REGEX = '^(([a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])\\.)*([a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])$';
const MODULE_CACHE_TIMEOUT = 3600000; // 1 hour in milliseconds

/**
 * Enhanced parser class for handling Terraform module blocks with visualization support
 * and performance optimization through caching and async operations.
 */
export class ModuleBlock {
  // Zod schema for comprehensive module validation
  private moduleSchema: z.ZodSchema;
  private blockContent: string;
  private sourceCache: Map<string, { data: any; timestamp: number }>;
  private position: { x: number; y: number };

  /**
   * Initializes a new ModuleBlock parser instance with validation and caching support
   * @param blockContent - Raw HCL content of the module block
   * @param position - Initial position data for visualization
   */
  constructor(blockContent: string, position: { x: number; y: number }) {
    this.blockContent = blockContent;
    this.position = position;
    this.sourceCache = new Map();

    // Initialize comprehensive validation schema
    this.moduleSchema = z.object({
      name: z.string().min(1),
      source: z.string().regex(new RegExp(MODULE_SOURCE_REGEX)),
      version: z.string().optional(),
      configuration: z.record(z.any()),
      position: z.object({
        x: z.number(),
        y: z.number()
      }),
      variables: z.record(z.any()).optional(),
      outputs: z.record(z.any()).optional(),
      resources: z.array(z.any()).optional(),
      description: z.string().optional()
    });
  }

  /**
   * Asynchronously parses a module block with enhanced visualization support
   * @returns Promise resolving to parsed module configuration with visualization metadata
   */
  public async parse(): Promise<Partial<IModule>> {
    try {
      // Parse HCL content asynchronously
      const parsedContent = await parse(this.blockContent);
      
      // Extract basic module information
      const moduleConfig: Partial<IModule> = {
        name: parsedContent.module?.[0]?.name,
        source: parsedContent.module?.[0]?.source,
        position: this.position,
        configuration: {}
      };

      // Parse and validate source information
      const sourceInfo = await this.parseModuleSource(moduleConfig.source);
      moduleConfig.version = sourceInfo.version;

      // Extract module configuration
      if (parsedContent.module?.[0]?.config) {
        moduleConfig.configuration = parsedContent.module[0].config;
      }

      // Parse variables and outputs if present
      if (parsedContent.module?.[0]?.variables) {
        moduleConfig.variables = this.parseVariables(parsedContent.module[0].variables);
      }

      if (parsedContent.module?.[0]?.outputs) {
        moduleConfig.outputs = this.parseOutputs(parsedContent.module[0].outputs);
      }

      // Validate complete module configuration
      const validationResult = await this.validateModuleBlock(moduleConfig);
      if (!validationResult.isValid) {
        throw new Error(`Module validation failed: ${validationResult.errors.join(', ')}`);
      }

      return moduleConfig;
    } catch (error) {
      throw new Error(`Failed to parse module block: ${error.message}`);
    }
  }

  /**
   * Performs comprehensive validation of parsed module configuration
   * @param moduleConfig - Partial module configuration to validate
   * @returns Validation results with detailed error information
   */
  public async validateModuleBlock(
    moduleConfig: Partial<IModule>
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Validate against Zod schema
      await this.moduleSchema.parseAsync(moduleConfig);

      // Additional validation rules
      if (!moduleConfig.name) {
        errors.push('Module name is required');
      }

      if (!moduleConfig.source) {
        errors.push('Module source is required');
      }

      // Validate source format
      if (moduleConfig.source && !new RegExp(MODULE_SOURCE_REGEX).test(moduleConfig.source)) {
        errors.push('Invalid module source format');
      }

      // Validate position data
      if (!moduleConfig.position || 
          typeof moduleConfig.position.x !== 'number' || 
          typeof moduleConfig.position.y !== 'number') {
        errors.push('Invalid position data for visualization');
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(err => err.message)
        };
      }
      throw error;
    }
  }

  /**
   * Parses and validates module source with caching support
   * @param source - Module source string
   * @returns Parsed source information with metadata
   */
  private async parseModuleSource(source: string): Promise<{
    source: string;
    version?: string;
    metadata: any;
  }> {
    // Check cache first
    const cached = this.sourceCache.get(source);
    if (cached && Date.now() - cached.timestamp < MODULE_CACHE_TIMEOUT) {
      return cached.data;
    }

    // Parse source string
    const [sourcePath, version] = source.split('?ref=');
    const sourceInfo = {
      source: sourcePath,
      version: version || undefined,
      metadata: {
        type: this.getSourceType(sourcePath),
        registry: this.isRegistrySource(sourcePath)
      }
    };

    // Cache the results
    this.sourceCache.set(source, {
      data: sourceInfo,
      timestamp: Date.now()
    });

    return sourceInfo;
  }

  /**
   * Parses module variables with type validation
   * @param variables - Raw variable declarations
   * @returns Processed variable configurations
   */
  private parseVariables(variables: any): Record<string, any> {
    const processedVars: Record<string, any> = {};
    
    for (const [name, config] of Object.entries(variables)) {
      processedVars[name] = {
        ...config,
        type: this.validateVariableType(config.type)
      };
    }

    return processedVars;
  }

  /**
   * Parses module outputs with validation
   * @param outputs - Raw output declarations
   * @returns Processed output configurations
   */
  private parseOutputs(outputs: any): Record<string, any> {
    const processedOutputs: Record<string, any> = {};
    
    for (const [name, config] of Object.entries(outputs)) {
      processedOutputs[name] = {
        ...config,
        sensitive: !!config.sensitive
      };
    }

    return processedOutputs;
  }

  /**
   * Determines the type of module source
   * @param source - Module source path
   * @returns Source type identifier
   */
  private getSourceType(source: string): string {
    if (source.startsWith('git::')) return 'git';
    if (source.startsWith('http')) return 'http';
    if (this.isRegistrySource(source)) return 'registry';
    return 'local';
  }

  /**
   * Checks if source is from Terraform Registry
   * @param source - Module source path
   * @returns Boolean indicating if source is from registry
   */
  private isRegistrySource(source: string): boolean {
    return /^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/.test(source);
  }

  /**
   * Validates variable type declaration
   * @param type - Variable type string
   * @returns Validated type string
   */
  private validateVariableType(type: string): string {
    const validTypes = ['string', 'number', 'bool', 'list', 'map', 'set', 'object', 'tuple'];
    return validTypes.includes(type) ? type : 'string';
  }
}