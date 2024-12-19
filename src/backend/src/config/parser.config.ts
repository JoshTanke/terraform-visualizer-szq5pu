// @ts-ignore - zod version 3.0.0
import { z } from 'zod';
import type { IModule } from '../interfaces/IModule';

/**
 * Performance configuration schema
 */
const performanceSchema = z.object({
  maxFileSize: z.string().regex(/^\d+MB$/),
  parseTimeout: z.string().regex(/^\d+ms$/),
  maxBlockDepth: z.number().int().positive(),
  maxResourcesPerModule: z.number().int().positive(),
  maxParallelParsers: z.number().int().positive(),
  cacheSize: z.string().regex(/^\d+MB$/),
  cacheExpiry: z.string().regex(/^\d+h$/)
});

/**
 * Block types configuration schema
 */
const blockTypesSchema = z.object({
  supported: z.array(z.string()),
  validation: z.object({
    required: z.array(z.string()),
    optional: z.array(z.string()),
    experimental: z.array(z.string())
  })
});

/**
 * Validation rules schema
 */
const validationSchema = z.object({
  schema: z.object({
    strict: z.boolean(),
    coerce: z.boolean(),
    abortEarly: z.boolean(),
    cacheResults: z.boolean()
  }),
  rules: z.object({
    enforceNaming: z.boolean(),
    requireDescription: z.boolean(),
    validateDependencies: z.boolean(),
    checkCircularDeps: z.boolean(),
    maxDependencyDepth: z.number().int().positive(),
    enforceProviderVersions: z.boolean(),
    requireVariableTypes: z.boolean()
  })
});

/**
 * Parsing behavior schema
 */
const parsingSchema = z.object({
  mode: z.enum(['strict', 'lenient']),
  ignoreComments: z.boolean(),
  preserveFormatting: z.boolean(),
  validateOnParse: z.boolean(),
  cacheResults: z.boolean(),
  parallelParsing: z.boolean(),
  errorHandling: z.enum(['strict', 'lenient']),
  debugMode: z.boolean(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
  maxRetries: z.number().int().min(0)
});

/**
 * Parser configuration object containing comprehensive settings for the Terraform parser
 */
export const PARSER_CONFIG = {
  /**
   * Performance-related configuration settings
   */
  performance: {
    maxFileSize: '10MB',
    parseTimeout: '3000ms', // Meets requirement of < 3 seconds parse time
    maxBlockDepth: 10,
    maxResourcesPerModule: 100,
    maxParallelParsers: 4,
    cacheSize: '100MB',
    cacheExpiry: '1h'
  },

  /**
   * Supported Terraform block types and their validation requirements
   */
  blockTypes: {
    supported: [
      'resource',
      'data',
      'module',
      'variable',
      'output',
      'provider',
      'locals',
      'backend',
      'terraform'
    ],
    validation: {
      required: ['resource', 'provider'],
      optional: [
        'data',
        'module',
        'variable',
        'output',
        'locals',
        'backend',
        'terraform'
      ],
      experimental: []
    }
  },

  /**
   * Validation rules and schema settings
   */
  validation: {
    schema: {
      strict: true,
      coerce: false,
      abortEarly: false,
      cacheResults: true
    },
    rules: {
      enforceNaming: true,
      requireDescription: true,
      validateDependencies: true,
      checkCircularDeps: true,
      maxDependencyDepth: 5,
      enforceProviderVersions: true,
      requireVariableTypes: true
    }
  },

  /**
   * Parser behavior and operational settings
   */
  parsing: {
    mode: 'strict' as const,
    ignoreComments: false,
    preserveFormatting: true,
    validateOnParse: true,
    cacheResults: true,
    parallelParsing: true,
    errorHandling: 'strict' as const,
    debugMode: false,
    logLevel: 'info' as const,
    maxRetries: 3
  }
};

/**
 * Validates the parser configuration against defined schemas
 * @param config - Parser configuration object to validate
 * @returns boolean indicating whether the configuration is valid
 */
export const validateParserConfig = (config: typeof PARSER_CONFIG): boolean => {
  try {
    performanceSchema.parse(config.performance);
    blockTypesSchema.parse(config.blockTypes);
    validationSchema.parse(config.validation);
    parsingSchema.parse(config.parsing);
    return true;
  } catch (error) {
    console.error('Parser configuration validation failed:', error);
    return false;
  }
};

// Type assertion to ensure configuration matches schemas
const _configValidation: z.infer<typeof performanceSchema> = PARSER_CONFIG.performance;
const _blockTypesValidation: z.infer<typeof blockTypesSchema> = PARSER_CONFIG.blockTypes;
const _validationRulesValidation: z.infer<typeof validationSchema> = PARSER_CONFIG.validation;
const _parsingValidation: z.infer<typeof parsingSchema> = PARSER_CONFIG.parsing;