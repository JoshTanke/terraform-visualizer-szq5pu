// External dependencies
import Joi from 'joi'; // v17.9.0
import { Types } from 'mongoose'; // v6.0.0
import sanitizeHtml from 'sanitize-html'; // v2.11.0

// Internal dependencies
import { IEnvironment } from '../../interfaces/IEnvironment';
import { validateSchema } from '../../utils/validation';
import { ValidationError } from '../../utils/errors';
import { Logger } from '../../utils/logger';

// Constants for validation rules
const ENVIRONMENT_NAME_REGEX = /^[a-zA-Z0-9-_]+$/;
const MAX_NAME_LENGTH = 64;
const MIN_NAME_LENGTH = 3;
const VALIDATION_TIMEOUT = 5000;
const CACHE_TTL = 300; // 5 minutes

// Initialize logger
const logger = Logger.getInstance();

/**
 * Enhanced Joi validation schema for environment data
 */
const ENVIRONMENT_SCHEMA = Joi.object({
  projectId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'Invalid project ID format',
      'any.required': 'Project ID is required'
    }),

  name: Joi.string()
    .required()
    .min(MIN_NAME_LENGTH)
    .max(MAX_NAME_LENGTH)
    .pattern(ENVIRONMENT_NAME_REGEX)
    .messages({
      'string.pattern.base': 'Environment name must contain only alphanumeric characters, hyphens, and underscores',
      'string.min': `Environment name must be at least ${MIN_NAME_LENGTH} characters`,
      'string.max': `Environment name must be at most ${MAX_NAME_LENGTH} characters`,
      'any.required': 'Environment name is required'
    }),

  description: Joi.string()
    .optional()
    .max(500)
    .messages({
      'string.max': 'Description must not exceed 500 characters'
    }),

  configuration: Joi.object()
    .optional()
    .default({})
    .messages({
      'object.base': 'Configuration must be an object'
    }),

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
    .default({})
    .messages({
      'object.base': 'Variables must be an object'
    }),

  version: Joi.string()
    .pattern(/^\d+\.\d+\.\d+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Version must follow semantic versioning (e.g., 1.0.0)'
    }),

  status: Joi.string()
    .valid('active', 'inactive', 'error', 'syncing')
    .default('active')
    .messages({
      'any.only': 'Invalid status value'
    })
}).strict();

/**
 * Validates environment creation request data with enhanced error handling and sanitization
 * @param environmentData Partial environment data to validate
 * @throws ValidationError if validation fails
 */
export async function validateEnvironmentCreate(
  environmentData: Partial<IEnvironment>
): Promise<void> {
  try {
    logger.debug('Validating environment creation data', { data: environmentData });

    // Sanitize input strings
    const sanitizedData = {
      ...environmentData,
      name: environmentData.name ? sanitizeHtml(environmentData.name, {
        allowedTags: [],
        allowedAttributes: {}
      }) : undefined,
      description: environmentData.description ? sanitizeHtml(environmentData.description, {
        allowedTags: [],
        allowedAttributes: {}
      }) : undefined
    };

    // Validate against schema
    await validateSchema(sanitizedData, ENVIRONMENT_SCHEMA, {
      abortEarly: false,
      cache: true
    });

    // Additional business logic validation
    await validateEnvironmentUniqueness(sanitizedData.name!, sanitizedData.projectId!);

  } catch (error) {
    logger.error('Environment creation validation failed', {
      error: error.message,
      data: environmentData
    });
    throw error;
  }
}

/**
 * Validates environment update request data with partial update support
 * @param environmentId Environment ID to update
 * @param updateData Partial environment data for update
 * @throws ValidationError if validation fails
 */
export async function validateEnvironmentUpdate(
  environmentId: string,
  updateData: Partial<IEnvironment>
): Promise<void> {
  try {
    logger.debug('Validating environment update data', {
      environmentId,
      updateData
    });

    // Validate environment ID
    if (!Types.ObjectId.isValid(environmentId)) {
      throw new ValidationError(
        [{ field: 'environmentId', message: 'Invalid environment ID format' }],
        'update'
      );
    }

    // Sanitize update data
    const sanitizedData = {
      ...updateData,
      name: updateData.name ? sanitizeHtml(updateData.name, {
        allowedTags: [],
        allowedAttributes: {}
      }) : undefined,
      description: updateData.description ? sanitizeHtml(updateData.description, {
        allowedTags: [],
        allowedAttributes: {}
      }) : undefined
    };

    // Create partial schema for update validation
    const updateSchema = ENVIRONMENT_SCHEMA.fork(
      Object.keys(ENVIRONMENT_SCHEMA.describe().keys),
      (schema) => schema.optional()
    );

    // Validate against schema
    await validateSchema(sanitizedData, updateSchema, {
      abortEarly: false,
      cache: true
    });

    // Validate name uniqueness if being updated
    if (sanitizedData.name) {
      await validateEnvironmentUniqueness(
        sanitizedData.name,
        sanitizedData.projectId!,
        environmentId
      );
    }

  } catch (error) {
    logger.error('Environment update validation failed', {
      error: error.message,
      environmentId,
      updateData
    });
    throw error;
  }
}

/**
 * Validates environment deletion request with dependency checking
 * @param environmentId Environment ID to delete
 * @throws ValidationError if validation fails
 */
export async function validateEnvironmentDelete(
  environmentId: string
): Promise<void> {
  try {
    logger.debug('Validating environment deletion', { environmentId });

    // Validate environment ID format
    if (!Types.ObjectId.isValid(environmentId)) {
      throw new ValidationError(
        [{ field: 'environmentId', message: 'Invalid environment ID format' }],
        'delete'
      );
    }

    // Additional checks would be implemented here:
    // - Check for existing modules
    // - Verify no active resources
    // - Check for running operations
    // - Validate deletion permissions

  } catch (error) {
    logger.error('Environment deletion validation failed', {
      error: error.message,
      environmentId
    });
    throw error;
  }
}

/**
 * Helper function to validate environment name uniqueness within a project
 * @param name Environment name to validate
 * @param projectId Project ID context
 * @param excludeId Optional environment ID to exclude from uniqueness check
 * @throws ValidationError if name is not unique
 */
async function validateEnvironmentUniqueness(
  name: string,
  projectId: string,
  excludeId?: string
): Promise<void> {
  // Note: Actual database query would be implemented here
  // This is a placeholder for the uniqueness check logic
  const exists = false; // Replace with actual database query

  if (exists) {
    throw new ValidationError(
      [{
        field: 'name',
        message: 'Environment name must be unique within the project'
      }],
      'uniqueness'
    );
  }
}