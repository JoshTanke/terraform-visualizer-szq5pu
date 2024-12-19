// External dependencies
import Joi from 'joi'; // v17.9.0
import { Types } from 'mongoose'; // v6.0.0

// Internal dependencies
import { IModule } from '../../interfaces/IModule';
import { validateRequest } from '../middleware/validation';
import { ValidationError } from '../../utils/errors';

/**
 * Enhanced validation schema for module creation with strict type checking
 * and relationship validation
 */
const CREATE_MODULE_SCHEMA = Joi.object<IModule>({
  environmentId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return new Types.ObjectId(value);
    })
    .messages({
      'any.invalid': 'Invalid environment ID format',
      'any.required': 'Environment ID is required'
    }),

  name: Joi.string()
    .required()
    .min(3)
    .max(100)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .messages({
      'string.pattern.base': 'Module name must contain only alphanumeric characters, underscores, and hyphens',
      'string.min': 'Module name must be at least 3 characters long',
      'string.max': 'Module name cannot exceed 100 characters'
    }),

  source: Joi.string()
    .required()
    .min(1)
    .max(500)
    .messages({
      'string.empty': 'Module source cannot be empty',
      'string.max': 'Module source cannot exceed 500 characters'
    }),

  version: Joi.string()
    .pattern(/^[0-9]+\.[0-9]+\.[0-9]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Version must follow semantic versioning (x.y.z)'
    }),

  description: Joi.string()
    .optional()
    .max(500)
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),

  configuration: Joi.object()
    .optional()
    .default({}),

  variables: Joi.object()
    .pattern(
      Joi.string(),
      Joi.alternatives().try(
        Joi.string(),
        Joi.number(),
        Joi.boolean(),
        Joi.object()
      )
    )
    .optional()
    .default({}),

  outputs: Joi.object()
    .pattern(
      Joi.string(),
      Joi.object({
        value: Joi.any().required(),
        description: Joi.string().optional(),
        sensitive: Joi.boolean().optional()
      })
    )
    .optional()
    .default({}),

  position: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required()
  })
    .optional()
    .default({ x: 0, y: 0 })
}).strict();

/**
 * Enhanced validation schema for module updates with partial validation support
 */
const UPDATE_MODULE_SCHEMA = CREATE_MODULE_SCHEMA.fork(
  ['environmentId', 'name', 'source'],
  (schema) => schema.optional()
).strict();

/**
 * Enhanced validation schema for module queries with pagination and filtering
 */
const QUERY_MODULE_SCHEMA = Joi.object({
  environmentId: Joi.string()
    .custom((value, helpers) => {
      if (!Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return new Types.ObjectId(value);
    })
    .optional(),

  name: Joi.string()
    .min(1)
    .max(100)
    .optional(),

  source: Joi.string()
    .min(1)
    .max(500)
    .optional(),

  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.min': 'Page must be greater than 0'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be greater than 0',
      'number.max': 'Limit cannot exceed 100'
    }),

  sort: Joi.string()
    .valid('name', '-name', 'createdAt', '-createdAt')
    .default('-createdAt')
}).strict();

/**
 * Enhanced validation middleware for module creation requests
 * with performance tracking and detailed error context
 */
export function validateCreateModule() {
  return validateRequest(CREATE_MODULE_SCHEMA, 'body');
}

/**
 * Enhanced validation middleware for module update requests
 * with partial update support and error tracking
 */
export function validateUpdateModule() {
  return validateRequest(UPDATE_MODULE_SCHEMA, 'body');
}

/**
 * Enhanced validation middleware for module query parameters
 * with pagination support and performance tracking
 */
export function validateModuleQuery() {
  return validateRequest(QUERY_MODULE_SCHEMA, 'query');
}

// Export validation schemas for testing and reuse
export const schemas = {
  CREATE_MODULE_SCHEMA,
  UPDATE_MODULE_SCHEMA,
  QUERY_MODULE_SCHEMA
};