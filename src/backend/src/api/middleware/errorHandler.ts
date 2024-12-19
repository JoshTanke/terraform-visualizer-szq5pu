// External dependencies
import { Request, Response, NextFunction } from 'express'; // ^4.18.2

// Internal dependencies
import { Logger } from '../../utils/logger';
import { isBaseError, formatErrorResponse } from '../../utils/errors';

// Constants
const DEFAULT_ERROR_STATUS = 500;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ERRORS_PER_WINDOW = 100;

// Rate limiting state
const errorCounts = new Map<string, { count: number; timestamp: number }>();

/**
 * Interface for error metadata collection
 */
interface ErrorMetadata {
  timestamp: string;
  path: string;
  method: string;
  correlationId: string;
  headers: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, any>;
}

/**
 * Extracts or generates a correlation ID from the request
 * @param req Express request object
 * @returns Correlation ID string
 */
const getCorrelationId = (req: Request): string => {
  return (
    req.headers['x-correlation-id'] as string ||
    req.headers['x-request-id'] as string ||
    `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
};

/**
 * Collects error metadata from the request
 * @param req Express request object
 * @param correlationId Request correlation ID
 * @returns Error metadata object
 */
const collectErrorMetadata = (req: Request, correlationId: string): ErrorMetadata => {
  const metadata: ErrorMetadata = {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    correlationId,
    headers: {
      ...req.headers as Record<string, string>,
      // Remove sensitive headers
      authorization: '[REDACTED]',
      cookie: '[REDACTED]'
    }
  };

  // Include safe request data
  if (Object.keys(req.query).length > 0) {
    metadata.query = req.query as Record<string, string>;
  }

  // Include sanitized request body if present
  if (req.body && Object.keys(req.body).length > 0) {
    metadata.body = JSON.parse(JSON.stringify(req.body));
    // Redact sensitive fields
    ['password', 'token', 'secret', 'key'].forEach(field => {
      if (field in metadata.body) {
        metadata.body[field] = '[REDACTED]';
      }
    });
  }

  return metadata;
};

/**
 * Checks rate limiting for error responses
 * @param clientIp Client IP address
 * @returns Boolean indicating if rate limit is exceeded
 */
const checkRateLimit = (clientIp: string): boolean => {
  const now = Date.now();
  const clientErrors = errorCounts.get(clientIp);

  if (!clientErrors) {
    errorCounts.set(clientIp, { count: 1, timestamp: now });
    return false;
  }

  if (now - clientErrors.timestamp > RATE_LIMIT_WINDOW) {
    // Reset window
    errorCounts.set(clientIp, { count: 1, timestamp: now });
    return false;
  }

  if (clientErrors.count >= MAX_ERRORS_PER_WINDOW) {
    return true;
  }

  clientErrors.count++;
  return false;
};

/**
 * Express middleware for centralized error handling with comprehensive logging
 * and monitoring integration
 */
const errorHandler = async (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Get or generate correlation ID
  const correlationId = getCorrelationId(req);

  // Initialize logger with correlation context
  const logger = Logger.getInstance();

  try {
    // Collect error metadata
    const metadata = collectErrorMetadata(req, correlationId);

    // Check rate limiting
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (checkRateLimit(clientIp)) {
      res.status(429).json({
        error: {
          message: 'Too many error requests',
          code: 'RATE_LIMIT_EXCEEDED',
          correlationId
        }
      });
      return;
    }

    // Log error with appropriate severity and context
    await logger.error(error.message, {
      ...metadata,
      errorDetails: {
        name: error.name,
        stack: error.stack,
        ...(isBaseError(error) && {
          code: error.code,
          category: error.errorCategory,
          status: error.status
        })
      }
    });

    // Determine response status code
    const statusCode = isBaseError(error) 
      ? error.status 
      : error instanceof Error 
        ? (error as any).status || DEFAULT_ERROR_STATUS
        : DEFAULT_ERROR_STATUS;

    // Format error response based on environment
    const errorResponse = formatErrorResponse(
      error,
      process.env.NODE_ENV !== 'production'
    );

    // Send formatted response
    res.status(statusCode).json(errorResponse);
  } catch (loggingError) {
    // Fallback error handling if logging fails
    console.error('Error in error handler:', loggingError);
    res.status(500).json({
      error: {
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        correlationId
      }
    });
  }
};

export default errorHandler;