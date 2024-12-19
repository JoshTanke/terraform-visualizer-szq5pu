// External dependencies
import createHttpError, { HttpError } from 'http-errors'; // v2.0.0

// Internal dependencies
import { Logger } from './logger';

// Constants
const ERROR_CATEGORIES = {
  VALIDATION: 'VALIDATION',
  PARSING: 'PARSING',
  SYSTEM: 'SYSTEM',
  NETWORK: 'NETWORK',
  SECURITY: 'SECURITY'
} as const;

type ErrorCategory = typeof ERROR_CATEGORIES[keyof typeof ERROR_CATEGORIES];

/**
 * Enhanced base error class that extends Error to provide comprehensive error handling
 * functionality with metadata support and logging integration
 */
export class BaseError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly metadata: Record<string, any>;
  public readonly correlationId: string;
  public readonly timestamp: string;
  public readonly errorCategory: ErrorCategory;
  private readonly logger: Logger;

  constructor(
    message: string,
    code: string,
    status: number = 500,
    metadata: Record<string, any> = {},
    correlationId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.metadata = this.sanitizeMetadata(metadata);
    this.correlationId = correlationId || this.generateCorrelationId();
    this.timestamp = new Date().toISOString();
    this.errorCategory = this.determineErrorCategory(code);
    this.logger = Logger.getInstance();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);

    // Log error details
    this.logError();
  }

  /**
   * Generates a unique correlation ID for error tracking
   */
  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitizes error metadata to remove sensitive information
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Determines the error category based on the error code
   */
  private determineErrorCategory(code: string): ErrorCategory {
    if (code.startsWith('VAL_')) return ERROR_CATEGORIES.VALIDATION;
    if (code.startsWith('PARSE_')) return ERROR_CATEGORIES.PARSING;
    if (code.startsWith('NET_')) return ERROR_CATEGORIES.NETWORK;
    if (code.startsWith('SEC_')) return ERROR_CATEGORIES.SECURITY;
    return ERROR_CATEGORIES.SYSTEM;
  }

  /**
   * Logs error details using the logger instance
   */
  private logError(): void {
    this.logger.error(this.message, {
      errorCode: this.code,
      errorCategory: this.errorCategory,
      correlationId: this.correlationId,
      status: this.status,
      metadata: this.metadata,
      stack: this.stack
    });
  }
}

/**
 * Specialized error class for handling validation failures with detailed error tracking
 */
export class ValidationError extends BaseError {
  public readonly errors: Array<{ field: string; message: string }>;
  public readonly validationType: string;
  public readonly validationContext: Record<string, any>;

  constructor(
    errors: Array<{ field: string; message: string }>,
    validationType: string,
    validationContext: Record<string, any> = {}
  ) {
    const message = `Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
    
    super(
      message,
      'VAL_001',
      400,
      { validationType, validationContext },
      undefined
    );

    this.errors = errors;
    this.validationType = validationType;
    this.validationContext = validationContext;
  }
}

/**
 * Specialized error class for handling Terraform parsing failures
 */
export class ParseError extends BaseError {
  public readonly parseDetails: Record<string, any>;
  public readonly fileLocation: string;
  public readonly syntaxErrors: Array<{
    line: number;
    column: number;
    message: string;
  }>;

  constructor(
    message: string,
    parseDetails: Record<string, any>,
    fileLocation: string,
    syntaxErrors: Array<{ line: number; column: number; message: string }>
  ) {
    super(
      message,
      'PARSE_001',
      400,
      { parseDetails, fileLocation },
      undefined
    );

    this.parseDetails = parseDetails;
    this.fileLocation = fileLocation;
    this.syntaxErrors = syntaxErrors;
  }
}

/**
 * Type guard to check if an error is an instance of BaseError
 */
export function isBaseError(error: Error): error is BaseError {
  return (
    error instanceof BaseError &&
    'code' in error &&
    'status' in error &&
    'correlationId' in error &&
    'errorCategory' in error
  );
}

/**
 * Formats error response for API consumption with security considerations
 */
export function formatErrorResponse(
  error: Error,
  includeDetails: boolean = process.env.NODE_ENV !== 'production'
): Record<string, any> {
  const response: Record<string, any> = {
    success: false,
    timestamp: new Date().toISOString()
  };

  if (isBaseError(error)) {
    response.error = {
      message: error.message,
      code: error.code,
      correlationId: error.correlationId,
      category: error.errorCategory
    };

    if (error instanceof ValidationError) {
      response.error.validation = {
        errors: error.errors,
        type: error.validationType
      };
    } else if (error instanceof ParseError) {
      response.error.parsing = {
        location: error.fileLocation,
        syntaxErrors: error.syntaxErrors
      };
    }

    if (includeDetails) {
      response.error.metadata = error.metadata;
      response.error.stack = error.stack;
    }
  } else if (error instanceof HttpError) {
    response.error = {
      message: error.message,
      status: error.status,
      code: 'HTTP_ERROR'
    };
  } else {
    // Generic error handling
    response.error = {
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR'
    };

    if (includeDetails) {
      response.error.originalMessage = error.message;
      response.error.stack = error.stack;
    }
  }

  return response;
}