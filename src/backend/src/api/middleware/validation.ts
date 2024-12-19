// External dependencies
import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { Schema } from 'joi'; // v17.9.0

// Internal dependencies
import { ValidationError } from '../../utils/errors';
import { validateSchema } from '../../utils/validation';
import { Logger } from '../../utils/logger';

// Constants
const PERFORMANCE_THRESHOLD_MS = 100;
const logger = Logger.getInstance();

/**
 * Union type for request validation sources
 */
export type ValidationSource = 'body' | 'params' | 'query';

/**
 * Type for validation middleware function with performance metrics
 */
export type ValidationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Interface for validated data with metadata
 */
export interface ValidationResult {
  data: any;
  validatedAt: Date;
  source: ValidationSource;
}

/**
 * Higher-order function that creates a validation middleware with performance tracking
 * @param schema - Joi schema for validation
 * @param source - Source of data to validate (body, params, query)
 * @returns Async middleware function for request validation
 */
export const validateRequest = (
  schema: Schema,
  source: ValidationSource
): ValidationMiddleware => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      // Extract data based on source
      const dataToValidate = req[source];

      // Skip validation if no data present and schema allows empty
      if (!dataToValidate && schema.describe().flags?.presence !== 'required') {
        next();
        return;
      }

      // Validate data against schema
      const validationResult = await validateSchema(dataToValidate, schema, {
        abortEarly: false,
        cache: true,
        context: {
          correlationId,
          requestPath: req.path,
          method: req.method
        }
      });

      // Track performance
      const duration = Date.now() - startTime;
      if (duration > PERFORMANCE_THRESHOLD_MS) {
        logger.warn('Validation performance threshold exceeded', {
          duration,
          source,
          path: req.path,
          correlationId
        });
      }

      // Attach validated data to request
      req[`validated${source.charAt(0).toUpperCase()}${source.slice(1)}`] = {
        data: validationResult.data,
        validatedAt: new Date(),
        source
      } as ValidationResult;

      next();
    } catch (error) {
      // Handle validation errors
      if (error instanceof ValidationError) {
        logger.error('Request validation failed', {
          source,
          path: req.path,
          correlationId,
          errors: error.errors
        });

        next(error);
      } else {
        // Handle unexpected errors
        logger.error('Unexpected validation error', {
          error: error.message,
          stack: error.stack,
          source,
          path: req.path,
          correlationId
        });

        next(new ValidationError(
          [{
            field: source,
            message: 'Internal validation error occurred'
          }],
          'middleware',
          { source, path: req.path }
        ));
      }
    }
  };
};

/**
 * Specialized middleware for validating request body with content-type checks
 * @param schema - Joi schema for body validation
 * @returns Middleware for body validation
 */
export const validateRequestBody = (schema: Schema): ValidationMiddleware => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Verify content-type for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
      next(new ValidationError(
        [{
          field: 'content-type',
          message: 'Content-Type must be application/json'
        }],
        'header',
        { contentType: req.get('content-type') }
      ));
      return;
    }

    // Apply body validation
    await validateRequest(schema, 'body')(req, res, next);
  };
};

/**
 * Specialized middleware for validating URL parameters with type coercion
 * @param schema - Joi schema for params validation
 * @returns Middleware for params validation
 */
export const validateRequestParams = (schema: Schema): ValidationMiddleware => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Apply type coercion for numeric parameters
    for (const [key, value] of Object.entries(req.params)) {
      if (!isNaN(Number(value))) {
        req.params[key] = Number(value);
      }
    }

    // Apply params validation
    await validateRequest(schema, 'params')(req, res, next);
  };
};

/**
 * Specialized middleware for validating query parameters with array support
 * @param schema - Joi schema for query validation
 * @returns Middleware for query validation
 */
export const validateRequestQuery = (schema: Schema): ValidationMiddleware => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Handle array parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) {
        req.query[key] = value.map(item => 
          !isNaN(Number(item)) ? Number(item) : item
        );
      }
    }

    // Apply query validation
    await validateRequest(schema, 'query')(req, res, next);
  };
};