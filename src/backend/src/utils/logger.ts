// External dependencies
import winston from 'winston'; // v3.10.0
import DailyRotateFile from 'winston-daily-rotate-file'; // v4.7.1

// Internal imports
import { loggerConfig } from '../config/logger.config';

// Types for metadata and log entries
interface LogMetadata {
  [key: string]: any;
  timestamp?: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  service?: string;
}

interface LogEntry {
  level: string;
  message: string;
  metadata: LogMetadata;
  timestamp: Date;
  retryCount: number;
}

/**
 * Thread-safe singleton logger class that provides centralized logging functionality
 * with support for structured logging, secure data handling, and performance optimizations
 */
export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private formatCache: Map<string, Function>;
  private logQueue: LogEntry[];
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly QUEUE_SIZE = 1000;
  private readonly BATCH_SIZE = 100;

  /**
   * Private constructor that initializes the logger with configured transports and formats
   */
  private constructor() {
    // Initialize caches and queues
    this.formatCache = new Map();
    this.logQueue = [];

    // Create Winston logger instance with configuration
    this.logger = winston.createLogger({
      ...loggerConfig,
      exitOnError: false,
    });

    // Set up error handling for transports
    this.setupErrorHandling();

    // Initialize periodic queue processing
    this.initializeQueueProcessor();
  }

  /**
   * Thread-safe method to get or create the singleton logger instance
   * @returns Singleton logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Sets up error handling for logger transports
   */
  private setupErrorHandling(): void {
    this.logger.on('error', (error) => {
      console.error('Logger transport error:', error);
      this.handleTransportError(error);
    });
  }

  /**
   * Initializes the queue processor for batched logging
   */
  private initializeQueueProcessor(): void {
    setInterval(() => {
      this.processLogQueue();
    }, 1000);
  }

  /**
   * Processes the log queue in batches
   */
  private async processLogQueue(): Promise<void> {
    while (this.logQueue.length > 0) {
      const batch = this.logQueue.splice(0, this.BATCH_SIZE);
      await Promise.all(
        batch.map(entry =>
          this.writeLog(entry).catch(error => this.handleWriteError(entry, error))
        )
      );
    }
  }

  /**
   * Handles transport errors by implementing retry logic
   */
  private handleTransportError(error: Error): void {
    // Implement transport-specific error handling
    this.logger.error('Transport error occurred', {
      error: error.message,
      stack: error.stack,
    });
  }

  /**
   * Handles write errors with retry logic
   */
  private async handleWriteError(entry: LogEntry, error: Error): Promise<void> {
    if (entry.retryCount < this.MAX_RETRY_ATTEMPTS) {
      entry.retryCount++;
      await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * entry.retryCount));
      this.logQueue.push(entry);
    } else {
      console.error('Failed to write log after maximum retries:', error);
    }
  }

  /**
   * Writes a log entry to the configured transports
   */
  private async writeLog(entry: LogEntry): Promise<void> {
    try {
      await this.logger.log({
        level: entry.level,
        message: entry.message,
        ...this.sanitizeMetadata(entry.metadata),
      });
    } catch (error) {
      throw new Error(`Failed to write log: ${error.message}`);
    }
  }

  /**
   * Sanitizes metadata by removing sensitive information
   */
  private sanitizeMetadata(metadata: LogMetadata): LogMetadata {
    const sanitized = { ...metadata };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Enriches metadata with standard fields
   */
  private enrichMetadata(metadata: LogMetadata = {}): LogMetadata {
    return {
      timestamp: new Date().toISOString(),
      service: 'terraform-visualizer',
      ...metadata,
    };
  }

  /**
   * Logs error level messages with immediate flush and retry logic
   */
  public async error(message: string, metadata: LogMetadata = {}): Promise<void> {
    const entry: LogEntry = {
      level: 'error',
      message,
      metadata: this.enrichMetadata(metadata),
      timestamp: new Date(),
      retryCount: 0,
    };

    try {
      await this.writeLog(entry);
    } catch (error) {
      this.logQueue.push(entry);
    }
  }

  /**
   * Logs warning level messages with buffered writing
   */
  public async warn(message: string, metadata: LogMetadata = {}): Promise<void> {
    const entry: LogEntry = {
      level: 'warn',
      message,
      metadata: this.enrichMetadata(metadata),
      timestamp: new Date(),
      retryCount: 0,
    };

    if (this.logQueue.length < this.QUEUE_SIZE) {
      this.logQueue.push(entry);
    } else {
      await this.writeLog(entry);
    }
  }

  /**
   * Logs info level messages with batched writing
   */
  public async info(message: string, metadata: LogMetadata = {}): Promise<void> {
    const entry: LogEntry = {
      level: 'info',
      message,
      metadata: this.enrichMetadata(metadata),
      timestamp: new Date(),
      retryCount: 0,
    };

    if (this.logQueue.length < this.QUEUE_SIZE) {
      this.logQueue.push(entry);
    } else {
      await this.writeLog(entry);
    }
  }

  /**
   * Logs debug level messages with async writing
   */
  public async debug(message: string, metadata: LogMetadata = {}): Promise<void> {
    const entry: LogEntry = {
      level: 'debug',
      message,
      metadata: this.enrichMetadata(metadata),
      timestamp: new Date(),
      retryCount: 0,
    };

    this.logQueue.push(entry);
  }
}

// Export singleton instance
export default Logger.getInstance();