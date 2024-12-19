// External dependencies
import Joi from 'joi'; // v17.9.0
import { parse as parseHCL } from '@hashicorp/hcl2-parser'; // v1.0.0

// Internal dependencies
import { ValidationError } from './errors';
import { Logger } from './logger';

// Constants for validation configuration
const VALIDATION_CACHE_TTL = 300000; // 5 minutes in milliseconds
const MAX_VALIDATION_DEPTH = 10;

// Cache for validation results
const validationCache = new Map<string, {
  result: any;
  timestamp: number;
}>();

// Type definitions
interface ValidationOptions {
  abortEarly?: boolean;
  cache?: boolean;
  context?: Record<string, any>;
}

interface SyntaxOptions {
  allowDeprecated?: boolean;
  strictMode?: boolean;
}

interface ReferenceOptions {
  allowCrossModule?: boolean;
  checkDeprecated?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  data?: any;
  metadata: {
    timestamp: string;
    duration: number;
    cached: boolean;
  };
}

interface SyntaxValidationResult {
  isValid: boolean;
  errors?: Array<{
    line: number;
    column: number;
    message: string;
  }>;
  metadata: {
    blockCount: number;
    parseTime: number;
  };
}

interface ReferenceValidationResult {
  isValid: boolean;
  dependencies: Map<string, string[]>;
  cycles?: string[][];
  metadata: {
    totalReferences: number;
    crossModuleReferences: number;
  };
}

// Schema definitions
export const PROJECT_SCHEMA = Joi.object({
  name: Joi.string().required().min(3).max(100),
  description: Joi.string().optional().max(500),
  githubUrl: Joi.string().uri().optional(),
  settings: Joi.object({
    autoSync: Joi.boolean().default(false),
    defaultBranch: Joi.string().default('main'),
    refreshInterval: Joi.number().min(60).max(3600).default(300)
  }).default()
}).strict();

export const ENVIRONMENT_SCHEMA = Joi.object({
  name: Joi.string().required().min(3).max(50),
  variables: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())
  ),
  deploymentRules: Joi.object({
    requireApproval: Joi.boolean().default(true),
    autoApply: Joi.boolean().default(false)
  }).default()
}).strict();

export const MODULE_SCHEMA = Joi.object({
  name: Joi.string().required().min(3).max(100),
  source: Joi.string().required(),
  version: Joi.string().pattern(/^[\d.]+$/),
  variables: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.object())
  )
}).strict();

export const RESOURCE_SCHEMA = Joi.object({
  type: Joi.string().required().pattern(/^[a-zA-Z0-9_]+_[a-zA-Z0-9_]+$/),
  name: Joi.string().required().pattern(/^[a-zA-Z0-9_-]+$/),
  provider: Joi.string().optional(),
  count: Joi.alternatives().try(Joi.number().integer(), Joi.string()).optional(),
  forEach: Joi.object().optional(),
  dependsOn: Joi.array().items(Joi.string()).optional()
}).strict();

/**
 * Enhanced generic schema validation function with caching and performance optimization
 */
export async function validateSchema(
  data: any,
  schema: Joi.Schema,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const logger = Logger.getInstance();
  const startTime = Date.now();
  const cacheKey = options.cache ? JSON.stringify({ data, schema: schema.describe() }) : null;

  try {
    // Check cache if enabled
    if (cacheKey && validationCache.has(cacheKey)) {
      const cached = validationCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < VALIDATION_CACHE_TTL) {
        logger.debug('Using cached validation result', { cacheKey });
        return {
          isValid: true,
          data: cached.result,
          metadata: {
            timestamp: new Date().toISOString(),
            duration: 0,
            cached: true
          }
        };
      }
      validationCache.delete(cacheKey);
    }

    // Perform validation
    const validationResult = await schema.validateAsync(data, {
      abortEarly: options.abortEarly ?? false,
      context: options.context,
      stripUnknown: true
    });

    // Cache successful validation result
    if (cacheKey) {
      validationCache.set(cacheKey, {
        result: validationResult,
        timestamp: Date.now()
      });
    }

    return {
      isValid: true,
      data: validationResult,
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        cached: false
      }
    };

  } catch (error) {
    logger.error('Schema validation failed', {
      error: error.message,
      data: JSON.stringify(data)
    });

    throw new ValidationError(
      error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message
      })),
      'schema',
      { schema: schema.describe() }
    );
  }
}

/**
 * Enhanced Terraform HCL syntax validation with detailed error reporting
 */
export async function validateTerraformSyntax(
  content: string,
  options: SyntaxOptions = {}
): Promise<SyntaxValidationResult> {
  const logger = Logger.getInstance();
  const startTime = Date.now();

  try {
    // Parse HCL content
    const parseResult = await parseHCL(content);
    const blocks = parseResult.blocks || [];

    // Validate block structure
    const syntaxErrors = [];
    let blockCount = 0;

    for (const block of blocks) {
      blockCount++;

      // Check for deprecated syntax if enabled
      if (options.strictMode && block.deprecated) {
        syntaxErrors.push({
          line: block.line,
          column: block.column,
          message: `Deprecated syntax: ${block.deprecated}`
        });
      }

      // Validate block type
      if (!block.type || !block.labels) {
        syntaxErrors.push({
          line: block.line,
          column: block.column,
          message: 'Invalid block structure: missing type or labels'
        });
      }
    }

    if (syntaxErrors.length > 0) {
      return {
        isValid: false,
        errors: syntaxErrors,
        metadata: {
          blockCount,
          parseTime: Date.now() - startTime
        }
      };
    }

    return {
      isValid: true,
      metadata: {
        blockCount,
        parseTime: Date.now() - startTime
      }
    };

  } catch (error) {
    logger.error('Terraform syntax validation failed', {
      error: error.message,
      content: content.substring(0, 200) + '...'
    });

    throw new ValidationError(
      [{
        field: 'content',
        message: error.message
      }],
      'syntax',
      { options }
    );
  }
}

/**
 * Enhanced resource reference validation with cycle detection and detailed dependency analysis
 */
export async function validateResourceReferences(
  resources: Map<string, any>,
  options: ReferenceOptions = {}
): Promise<ReferenceValidationResult> {
  const logger = Logger.getInstance();
  const dependencies = new Map<string, string[]>();
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  try {
    let totalReferences = 0;
    let crossModuleReferences = 0;

    // Build dependency graph
    for (const [resourceId, resource] of resources) {
      const deps = new Set<string>();

      // Check explicit dependencies
      if (resource.dependsOn) {
        for (const dep of resource.dependsOn) {
          deps.add(dep);
          totalReferences++;

          if (dep.includes('.module.')) {
            crossModuleReferences++;
            if (!options.allowCrossModule) {
              throw new ValidationError(
                [{
                  field: resourceId,
                  message: `Cross-module reference not allowed: ${dep}`
                }],
                'reference',
                { options }
              );
            }
          }
        }
      }

      // Check for deprecated resource types
      if (options.checkDeprecated && isDeprecatedResource(resource.type)) {
        logger.warn(`Deprecated resource type used: ${resource.type}`, {
          resourceId,
          type: resource.type
        });
      }

      dependencies.set(resourceId, Array.from(deps));
    }

    // Detect cycles
    const cycles: string[][] = [];
    const detectCycle = (node: string, path: string[] = []): boolean => {
      if (recursionStack.has(node)) {
        cycles.push([...path, node]);
        return true;
      }

      if (visited.has(node)) return false;

      visited.add(node);
      recursionStack.add(node);

      const deps = dependencies.get(node) || [];
      for (const dep of deps) {
        if (detectCycle(dep, [...path, node])) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    // Check for cycles in the dependency graph
    for (const resourceId of resources.keys()) {
      if (!visited.has(resourceId)) {
        detectCycle(resourceId);
      }
    }

    return {
      isValid: cycles.length === 0,
      dependencies,
      cycles: cycles.length > 0 ? cycles : undefined,
      metadata: {
        totalReferences,
        crossModuleReferences
      }
    };

  } catch (error) {
    logger.error('Resource reference validation failed', {
      error: error.message,
      resourceCount: resources.size
    });

    if (error instanceof ValidationError) {
      throw error;
    }

    throw new ValidationError(
      [{
        field: 'resources',
        message: error.message
      }],
      'reference',
      { options }
    );
  }
}

// Helper function to check for deprecated resource types
function isDeprecatedResource(resourceType: string): boolean {
  const deprecatedTypes = [
    'aws_elasticache_cluster',
    'aws_instance_profile',
    'azurerm_virtual_machine'
  ];
  return deprecatedTypes.includes(resourceType);
}