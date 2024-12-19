// External dependencies
import WebSocket from 'ws'; // v8.0.0
import CircuitBreaker from 'opossum'; // v6.0.0

// Internal dependencies
import { validateTerraformSyntax, validateResourceReferences } from '../../utils/validation';
import { ValidationError } from '../../utils/errors';
import { Logger } from '../../utils/logger';

// Types
interface ValidationOptions {
  maxConcurrent?: number;
  timeout?: number;
  retryDelay?: number;
  maxRetries?: number;
}

interface ValidationRequest {
  content: string;
  correlationId?: string;
  context?: {
    projectId?: string;
    environmentId?: string;
    moduleId?: string;
  };
}

interface BatchValidationRequest {
  files: Array<{
    path: string;
    content: string;
  }>;
  correlationId?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors?: Array<{
    line: number;
    column: number;
    message: string;
  }>;
  metadata: {
    timestamp: string;
    duration: number;
    resourceCount?: number;
  };
}

interface BatchValidationResult {
  results: Map<string, ValidationResult>;
  metadata: {
    totalFiles: number;
    totalDuration: number;
    timestamp: string;
  };
}

/**
 * Handles real-time validation of Terraform configurations via WebSocket
 * with performance optimization and enhanced error handling
 */
export class ValidationHandler {
  private readonly logger: Logger;
  private readonly breaker: CircuitBreaker;
  private readonly validationMetrics: Map<string, number>;
  private static readonly DEFAULT_OPTIONS: ValidationOptions = {
    maxConcurrent: 10,
    timeout: 5000,
    retryDelay: 1000,
    maxRetries: 3
  };

  constructor(options: ValidationOptions = {}) {
    this.logger = Logger.getInstance();
    this.validationMetrics = new Map();

    // Configure circuit breaker for validation service stability
    this.breaker = new CircuitBreaker(this.validateConfiguration.bind(this), {
      timeout: options.timeout || ValidationHandler.DEFAULT_OPTIONS.timeout,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10
    });

    // Set up circuit breaker event handlers
    this.setupCircuitBreakerEvents();
  }

  /**
   * Handles incoming validation requests with optimized performance
   */
  public async handleValidationRequest(
    client: WebSocket,
    data: ValidationRequest
  ): Promise<void> {
    const correlationId = data.correlationId || `val_${Date.now()}`;
    
    try {
      this.logger.debug('Received validation request', {
        correlationId,
        context: data.context
      });

      // Rate limiting check
      if (this.isRateLimited(correlationId)) {
        throw new ValidationError(
          [{ field: 'request', message: 'Rate limit exceeded' }],
          'rate_limit'
        );
      }

      // Perform validation through circuit breaker
      const result = await this.breaker.fire(data.content, {
        correlationId,
        context: data.context
      });

      // Send validation results
      client.send(JSON.stringify({
        type: 'validation_result',
        correlationId,
        ...result
      }));

      // Update metrics
      this.updateValidationMetrics(correlationId);

    } catch (error) {
      this.logger.error('Validation request failed', {
        correlationId,
        error: error.message,
        stack: error.stack
      });

      // Send error response
      client.send(JSON.stringify({
        type: 'validation_error',
        correlationId,
        error: error instanceof ValidationError ? error.errors : [{
          field: 'general',
          message: 'Internal validation error'
        }]
      }));
    }
  }

  /**
   * Handles batch validation requests for multiple files
   */
  public async handleBatchValidation(
    request: BatchValidationRequest
  ): Promise<BatchValidationResult> {
    const startTime = Date.now();
    const results = new Map<string, ValidationResult>();
    const correlationId = request.correlationId || `batch_${Date.now()}`;

    try {
      // Process files in parallel with concurrency limit
      const chunks = this.chunkArray(request.files, ValidationHandler.DEFAULT_OPTIONS.maxConcurrent!);
      
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(async file => {
          const result = await this.validateConfiguration(file.content, {
            correlationId,
            filePath: file.path
          });
          results.set(file.path, result);
        });

        await Promise.all(chunkPromises);
      }

      return {
        results,
        metadata: {
          totalFiles: request.files.length,
          totalDuration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('Batch validation failed', {
        correlationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Performs optimized validation of Terraform configuration
   */
  private async validateConfiguration(
    content: string,
    context: Record<string, any>
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Perform syntax validation
      const syntaxResult = await validateTerraformSyntax(content, {
        strictMode: true
      });

      if (!syntaxResult.isValid) {
        return {
          isValid: false,
          errors: syntaxResult.errors,
          metadata: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
          }
        };
      }

      // Extract resources for reference validation
      const resources = this.extractResources(content);
      
      // Validate resource references
      const referenceResult = await validateResourceReferences(resources, {
        allowCrossModule: true,
        checkDeprecated: true
      });

      return {
        isValid: referenceResult.isValid,
        errors: referenceResult.cycles?.map(cycle => ({
          line: 0, // Actual line numbers would require AST parsing
          column: 0,
          message: `Dependency cycle detected: ${cycle.join(' -> ')}`
        })),
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          resourceCount: resources.size
        }
      };

    } catch (error) {
      this.logger.error('Configuration validation failed', {
        error: error.message,
        context
      });
      throw error;
    }
  }

  /**
   * Sets up circuit breaker event handlers
   */
  private setupCircuitBreakerEvents(): void {
    this.breaker.on('open', () => {
      this.logger.warn('Validation circuit breaker opened');
    });

    this.breaker.on('halfOpen', () => {
      this.logger.info('Validation circuit breaker half-open');
    });

    this.breaker.on('close', () => {
      this.logger.info('Validation circuit breaker closed');
    });
  }

  /**
   * Checks if the request is rate limited
   */
  private isRateLimited(correlationId: string): boolean {
    const now = Date.now();
    const recentRequests = this.validationMetrics.get(correlationId) || 0;
    return recentRequests > 10; // Max 10 requests per correlation ID
  }

  /**
   * Updates validation metrics for rate limiting
   */
  private updateValidationMetrics(correlationId: string): void {
    const current = this.validationMetrics.get(correlationId) || 0;
    this.validationMetrics.set(correlationId, current + 1);

    // Cleanup old metrics after 1 minute
    setTimeout(() => {
      this.validationMetrics.delete(correlationId);
    }, 60000);
  }

  /**
   * Helper method to chunk array for parallel processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Helper method to extract resources from Terraform content
   */
  private extractResources(content: string): Map<string, any> {
    // This is a simplified version - actual implementation would use HCL parser
    const resources = new Map<string, any>();
    // Implementation details would go here
    return resources;
  }
}