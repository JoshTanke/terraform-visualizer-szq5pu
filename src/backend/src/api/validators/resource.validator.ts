// External dependencies
import Joi from 'joi'; // v17.9.0
import { Types } from 'mongoose'; // v6.0.0
import Redis from 'ioredis'; // v5.0.0

// Internal dependencies
import { IResource } from '../../interfaces/IResource';
import { validateSchema } from '../../utils/validation';
import { ValidationError } from '../../utils/errors';
import { Logger } from '../../utils/logger';

// Initialize logger
const logger = Logger.getInstance();

// Initialize Redis client for caching validation rules
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const CACHE_TTL = 3600; // 1 hour cache TTL
const CACHE_PREFIX = 'resource_validation:';

/**
 * Enhanced Joi schema for resource creation with provider-specific validation rules
 */
export const RESOURCE_CREATE_SCHEMA = Joi.object({
  moduleId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid moduleId format',
      'any.required': 'moduleId is required'
    }),

  type: Joi.string()
    .required()
    .pattern(/^[a-zA-Z0-9_]+_[a-zA-Z0-9_]+$/)
    .messages({
      'string.pattern.base': 'Resource type must be in format provider_type',
      'any.required': 'Resource type is required'
    }),

  name: Joi.string()
    .required()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .max(64)
    .messages({
      'string.pattern.base': 'Resource name must contain only alphanumeric characters, underscores, and hyphens',
      'string.max': 'Resource name cannot exceed 64 characters',
      'any.required': 'Resource name is required'
    }),

  provider: Joi.string()
    .required()
    .valid('aws', 'azurerm', 'google', 'kubernetes')
    .messages({
      'any.only': 'Unsupported provider',
      'any.required': 'Provider is required'
    }),

  attributes: Joi.object()
    .required()
    .min(1)
    .messages({
      'object.min': 'At least one attribute is required',
      'any.required': 'Attributes are required'
    }),

  dependencies: Joi.array()
    .items(
      Joi.string().custom((value, helpers) => {
        if (!Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      })
    )
    .unique()
    .messages({
      'array.unique': 'Duplicate dependencies are not allowed',
      'any.invalid': 'Invalid dependency ID format'
    }),

  count: Joi.alternatives()
    .try(
      Joi.number().integer().min(1),
      Joi.string().pattern(/^\$\{.+\}$/)
    )
    .optional()
    .messages({
      'number.base': 'Count must be a positive integer or variable reference',
      'number.integer': 'Count must be an integer',
      'number.min': 'Count must be at least 1'
    }),

  forEach: Joi.object()
    .optional()
    .messages({
      'object.base': 'forEach must be an object'
    }),

  position: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required(),
    width: Joi.number().optional(),
    height: Joi.number().optional()
  }).required(),

  metadata: Joi.object({
    icon: Joi.string().uri().optional(),
    color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).optional(),
    description: Joi.string().max(500).optional()
  }).optional()
}).strict();

/**
 * Enhanced Joi schema for resource updates with immutable field protection
 */
export const RESOURCE_UPDATE_SCHEMA = RESOURCE_CREATE_SCHEMA.fork(
  ['moduleId', 'type', 'name', 'provider'],
  (schema) => schema.optional()
).strict();

/**
 * Validates resource creation payload with enhanced provider-specific validation
 * @param resourceData Partial resource data to validate
 * @returns Validated resource data
 * @throws ValidationError if validation fails
 */
export async function validateResourceCreate(
  resourceData: Partial<IResource>
): Promise<Partial<IResource>> {
  try {
    logger.debug('Validating resource creation', { resourceType: resourceData.type });

    // Basic schema validation
    const validatedData = await validateSchema(resourceData, RESOURCE_CREATE_SCHEMA);

    // Provider-specific validation
    await validateResourceAttributes(
      resourceData.provider!,
      resourceData.type!,
      resourceData.attributes!
    );

    logger.info('Resource validation successful', {
      type: resourceData.type,
      provider: resourceData.provider
    });

    return validatedData.data;
  } catch (error) {
    logger.error('Resource validation failed', {
      error: error.message,
      resourceData
    });
    throw error;
  }
}

/**
 * Validates resource update payload with immutable field protection
 * @param resourceData Partial resource data to validate
 * @returns Validated resource data
 * @throws ValidationError if validation fails
 */
export async function validateResourceUpdate(
  resourceData: Partial<IResource>
): Promise<Partial<IResource>> {
  try {
    logger.debug('Validating resource update', { resourceId: resourceData._id });

    // Basic schema validation
    const validatedData = await validateSchema(resourceData, RESOURCE_UPDATE_SCHEMA);

    // Only validate attributes if they are being updated
    if (resourceData.attributes) {
      await validateResourceAttributes(
        resourceData.provider!,
        resourceData.type!,
        resourceData.attributes
      );
    }

    logger.info('Resource update validation successful', {
      resourceId: resourceData._id
    });

    return validatedData.data;
  } catch (error) {
    logger.error('Resource update validation failed', {
      error: error.message,
      resourceData
    });
    throw error;
  }
}

/**
 * Enhanced validation of resource attributes based on provider and type
 * @param provider Cloud provider
 * @param type Resource type
 * @param attributes Resource attributes
 * @returns True if attributes are valid
 * @throws ValidationError if validation fails
 */
export async function validateResourceAttributes(
  provider: string,
  type: string,
  attributes: Record<string, any>
): Promise<boolean> {
  try {
    // Try to get cached validation rules
    const cacheKey = `${CACHE_PREFIX}${provider}:${type}`;
    let validationRules = await redis.get(cacheKey);

    if (!validationRules) {
      // Load provider-specific validation rules
      validationRules = await loadProviderValidationRules(provider, type);
      // Cache the rules
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(validationRules));
    } else {
      validationRules = JSON.parse(validationRules);
    }

    // Validate required attributes
    const missingRequired = validationRules.required.filter(
      (attr: string) => !(attr in attributes)
    );

    if (missingRequired.length > 0) {
      throw new ValidationError(
        missingRequired.map(field => ({
          field,
          message: 'Required attribute is missing'
        })),
        'attributes'
      );
    }

    // Validate attribute types and constraints
    for (const [attr, value] of Object.entries(attributes)) {
      const rule = validationRules.attributes[attr];
      if (rule) {
        validateAttributeValue(attr, value, rule);
      }
    }

    // Validate attribute dependencies
    for (const [attr, deps] of Object.entries(validationRules.dependencies || {})) {
      if (attr in attributes) {
        const missingDeps = (deps as string[]).filter(
          dep => !(dep in attributes)
        );
        if (missingDeps.length > 0) {
          throw new ValidationError(
            [{
              field: attr,
              message: `Depends on missing attributes: ${missingDeps.join(', ')}`
            }],
            'dependencies'
          );
        }
      }
    }

    return true;
  } catch (error) {
    logger.error('Attribute validation failed', {
      provider,
      type,
      error: error.message
    });
    throw error;
  }
}

/**
 * Loads provider-specific validation rules
 * @param provider Cloud provider
 * @param type Resource type
 * @returns Validation rules object
 */
async function loadProviderValidationRules(
  provider: string,
  type: string
): Promise<any> {
  // This would typically load from a configuration file or database
  // For now, returning a basic example
  return {
    required: ['name'],
    attributes: {
      name: { type: 'string', maxLength: 64 },
      tags: { type: 'object' }
    },
    dependencies: {}
  };
}

/**
 * Validates an individual attribute value against its rule
 * @param attr Attribute name
 * @param value Attribute value
 * @param rule Validation rule
 * @throws ValidationError if validation fails
 */
function validateAttributeValue(
  attr: string,
  value: any,
  rule: any
): void {
  const { type, maxLength } = rule;

  if (type === 'string' && typeof value !== 'string') {
    throw new ValidationError(
      [{
        field: attr,
        message: 'Must be a string'
      }],
      'type'
    );
  }

  if (type === 'string' && maxLength && value.length > maxLength) {
    throw new ValidationError(
      [{
        field: attr,
        message: `Cannot exceed ${maxLength} characters`
      }],
      'length'
    );
  }

  if (type === 'object' && typeof value !== 'object') {
    throw new ValidationError(
      [{
        field: attr,
        message: 'Must be an object'
      }],
      'type'
    );
  }
}