// @ts-check
import { AxiosError } from 'axios'; // v1.x

// Global constants for error handling
export const ERROR_TYPES = {
  API_ERROR: 'API_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  PARSER_ERROR: 'PARSER_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
} as const;

export const HTTP_STATUS_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 408,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
} as const;

export const ERROR_SEVERITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

// Type definitions
type ErrorContext = Record<string, unknown>;
type ErrorCallback = (error: Error, context?: ErrorContext) => void;
type MonitoringConfig = {
  endpoint: string;
  apiKey: string;
  environment: string;
  enabled: boolean;
};

interface ValidationError {
  field: string;
  message: string;
  rule?: string;
}

interface StandardizedError {
  type: keyof typeof ERROR_TYPES;
  message: string;
  trackingId: string;
  severity: keyof typeof ERROR_SEVERITY;
  context?: ErrorContext;
  timestamp: number;
  stack?: string;
}

/**
 * Singleton class for centralized error handling with monitoring integration
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorCallback: ErrorCallback;
  private monitoringConfig: MonitoringConfig;
  private errorCache: Map<string, StandardizedError>;
  private environmentConfig: Record<string, unknown>;

  private constructor() {
    this.errorCache = new Map();
    this.errorCallback = () => {};
    this.monitoringConfig = {
      endpoint: process.env.MONITORING_ENDPOINT || '',
      apiKey: process.env.MONITORING_API_KEY || '',
      environment: process.env.NODE_ENV || 'development',
      enabled: process.env.NODE_ENV === 'production',
    };
    this.initializeErrorHandling();
  }

  private initializeErrorHandling(): void {
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    window.addEventListener('error', this.handleUncaughtError.bind(this));
  }

  /**
   * Gets singleton instance of ErrorHandler
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Main error processing method with monitoring and recovery
   */
  public async handleError(
    error: Error,
    type: keyof typeof ERROR_TYPES,
    context?: ErrorContext
  ): Promise<StandardizedError> {
    const trackingId = this.generateTrackingId();
    const severity = this.determineErrorSeverity(error, type);
    
    const standardizedError: StandardizedError = {
      type,
      message: error.message,
      trackingId,
      severity,
      context,
      timestamp: Date.now(),
      stack: error.stack,
    };

    await this.logError(standardizedError);
    this.errorCache.set(trackingId, standardizedError);
    this.errorCallback(error, context);

    return standardizedError;
  }

  private generateTrackingId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineErrorSeverity(error: Error, type: keyof typeof ERROR_TYPES): keyof typeof ERROR_SEVERITY {
    if (type === ERROR_TYPES.SYSTEM_ERROR) return ERROR_SEVERITY.HIGH;
    if (type === ERROR_TYPES.API_ERROR) return ERROR_SEVERITY.MEDIUM;
    return ERROR_SEVERITY.LOW;
  }

  private async logError(error: StandardizedError): Promise<void> {
    if (!this.monitoringConfig.enabled) return;

    try {
      await fetch(this.monitoringConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.monitoringConfig.apiKey,
        },
        body: JSON.stringify({
          ...error,
          environment: this.monitoringConfig.environment,
        }),
      });
    } catch (e) {
      console.error('Failed to send error to monitoring service:', e);
      this.errorCache.set(error.trackingId, error);
    }
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    this.handleError(
      event.reason,
      ERROR_TYPES.RUNTIME_ERROR,
      { unhandledRejection: true }
    );
  }

  private handleUncaughtError(event: ErrorEvent): void {
    this.handleError(
      event.error,
      ERROR_TYPES.RUNTIME_ERROR,
      { uncaughtError: true }
    );
  }
}

/**
 * Processes API errors with enhanced context capture and monitoring integration
 */
export async function handleApiError(
  error: AxiosError,
  context: ErrorContext
): Promise<StandardizedError> {
  const errorHandler = ErrorHandler.getInstance();
  const enhancedContext = {
    ...context,
    url: error.config?.url,
    method: error.config?.method,
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data,
  };

  return errorHandler.handleError(error, ERROR_TYPES.API_ERROR, enhancedContext);
}

/**
 * Processes form and data validation errors with field-level details
 */
export async function handleValidationError(
  validationError: ValidationError[],
  formId: string
): Promise<StandardizedError> {
  const errorHandler = ErrorHandler.getInstance();
  const context = {
    formId,
    fields: validationError.map(error => ({
      field: error.field,
      message: error.message,
      rule: error.rule,
    })),
  };

  const error = new Error('Validation failed');
  return errorHandler.handleError(error, ERROR_TYPES.VALIDATION_ERROR, context);
}

/**
 * Processes unexpected runtime errors with enhanced debugging capabilities
 */
export async function handleRuntimeError(
  error: Error,
  componentInfo: ErrorContext
): Promise<StandardizedError> {
  const errorHandler = ErrorHandler.getInstance();
  const context = {
    ...componentInfo,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
  };

  return errorHandler.handleError(error, ERROR_TYPES.RUNTIME_ERROR, context);
}

/**
 * Formats error messages with enhanced accessibility and localization support
 */
export function formatErrorMessage(
  message: string,
  context?: ErrorContext,
  options: { includeTrackingId?: boolean; severity?: keyof typeof ERROR_SEVERITY } = {}
): string {
  const { includeTrackingId = true, severity = ERROR_SEVERITY.MEDIUM } = options;
  let formattedMessage = message;

  if (includeTrackingId && context?.trackingId) {
    formattedMessage += ` (Tracking ID: ${context.trackingId})`;
  }

  return `${severity.toUpperCase()}: ${formattedMessage}`;
}

/**
 * Enhanced logging function with monitoring service integration
 */
export async function logError(
  message: string,
  details: ErrorContext,
  level: keyof typeof LOG_LEVELS = LOG_LEVELS.ERROR,
  options: { notify?: boolean } = {}
): Promise<void> {
  const errorHandler = ErrorHandler.getInstance();
  const error = new Error(message);
  
  await errorHandler.handleError(error, ERROR_TYPES.SYSTEM_ERROR, {
    ...details,
    logLevel: level,
    notifyUser: options.notify,
  });
}