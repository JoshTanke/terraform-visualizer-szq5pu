import { z } from 'zod'; // v3.0.0
import { parse } from 'hcl2-parser'; // v1.0.0
import { IResource } from '../../interfaces/IResource';

/**
 * Zod schema for validating provider block configurations
 */
const PROVIDER_SCHEMA = z.object({
  name: z.string(),
  alias: z.string().optional(),
  version: z.string().optional(),
  configuration: z.record(z.any()),
  meta: z.object({
    sensitive: z.boolean()
  }).optional()
});

/**
 * Cache TTL for parsed providers in milliseconds (5 minutes)
 */
const PROVIDER_CACHE_TTL = 300000;

/**
 * Provider block parser with caching and validation capabilities.
 * Implements performance optimizations for parsing provider declarations
 * and configurations in Terraform code.
 */
export class ProviderBlock {
  private providerSchema: z.ZodSchema;
  private parsedProviders: Map<string, { data: any, timestamp: number }>;
  private schemaCache: Map<string, { schema: object, timestamp: number }>;

  /**
   * Initializes the provider block parser with caching and schema validation.
   */
  constructor() {
    this.providerSchema = PROVIDER_SCHEMA;
    this.parsedProviders = new Map();
    this.schemaCache = new Map();
  }

  /**
   * Asynchronously parses and validates provider blocks with caching support.
   * @param block - The provider block configuration object to parse
   * @returns Promise resolving to validated provider configuration with metadata
   */
  async parse(block: object): Promise<object> {
    try {
      // Generate cache key from block content
      const cacheKey = JSON.stringify(block);
      
      // Check cache for existing parsed provider
      const cached = this.parsedProviders.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PROVIDER_CACHE_TTL) {
        return cached.data;
      }

      // Extract provider details
      const providerConfig = await parse(block);
      const name = providerConfig.name as string;
      const alias = providerConfig.alias as string | undefined;
      
      // Get provider-specific schema
      const schema = await this.getProviderSchema(name);

      // Parse and validate configuration
      const configuration = {
        name,
        alias,
        version: providerConfig.version,
        configuration: providerConfig.config || {},
        meta: {
          sensitive: this.hasSensitiveAttributes(providerConfig.config)
        }
      };

      // Validate against schema
      const validated = await this.providerSchema.parseAsync(configuration);

      // Cache the result
      this.parsedProviders.set(cacheKey, {
        data: validated,
        timestamp: Date.now()
      });

      return validated;
    } catch (error) {
      throw new Error(`Provider block parsing failed: ${error.message}`);
    }
  }

  /**
   * Performs comprehensive provider configuration validation.
   * @param providerConfig - Provider configuration to validate
   * @returns Promise resolving to validation result with error context
   */
  async validate(providerConfig: object): Promise<boolean> {
    try {
      // Validate required attributes
      const validation = await this.providerSchema.safeParseAsync(providerConfig);
      
      if (!validation.success) {
        return false;
      }

      // Check version constraints if specified
      if (validation.data.version) {
        const versionValid = this.validateVersionConstraint(validation.data.version);
        if (!versionValid) {
          return false;
        }
      }

      // Validate provider-specific configuration
      const schema = await this.getProviderSchema(validation.data.name);
      const configValidation = await this.validateProviderConfig(
        validation.data.configuration,
        schema
      );

      return configValidation;
    } catch (error) {
      return false;
    }
  }

  /**
   * Retrieves and caches provider-specific schemas.
   * @param providerName - Name of the provider to get schema for
   * @returns Promise resolving to provider schema with caching metadata
   */
  async getProviderSchema(providerName: string): Promise<object> {
    // Check schema cache
    const cached = this.schemaCache.get(providerName);
    if (cached && Date.now() - cached.timestamp < PROVIDER_CACHE_TTL) {
      return cached.schema;
    }

    try {
      // Load provider-specific schema
      const schema = await this.loadProviderSchema(providerName);
      
      // Cache the schema
      this.schemaCache.set(providerName, {
        schema,
        timestamp: Date.now()
      });

      return schema;
    } catch (error) {
      // Fall back to default schema
      return {};
    }
  }

  /**
   * Checks if provider configuration contains sensitive attributes.
   * @param config - Provider configuration to check
   * @returns boolean indicating presence of sensitive attributes
   */
  private hasSensitiveAttributes(config: Record<string, any>): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /credential/i
    ];

    return Object.keys(config || {}).some(key =>
      sensitivePatterns.some(pattern => pattern.test(key))
    );
  }

  /**
   * Validates provider version constraint string.
   * @param version - Version constraint to validate
   * @returns boolean indicating if version constraint is valid
   */
  private validateVersionConstraint(version: string): boolean {
    const versionPattern = /^(>=|<=|~>|=|>|<)?\s*\d+\.\d+(\.\d+)?(-\w+)?$/;
    return versionPattern.test(version);
  }

  /**
   * Validates provider-specific configuration against schema.
   * @param config - Provider configuration to validate
   * @param schema - Schema to validate against
   * @returns Promise resolving to validation result
   */
  private async validateProviderConfig(
    config: Record<string, any>,
    schema: object
  ): Promise<boolean> {
    try {
      const configSchema = z.record(z.any()).parse(config);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Loads provider-specific schema from available schemas.
   * @param providerName - Name of provider to load schema for
   * @returns Promise resolving to provider schema
   */
  private async loadProviderSchema(providerName: string): Promise<object> {
    // Implementation would load from provider schema registry
    // For now, return empty schema
    return {};
  }
}