// @ts-check
import { datadogLogs } from '@datadog/browser-logs'; // v4.x
import { handleError } from './errorHandling';

// Global constants for logging configuration
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  METRIC: 'metric'
} as const;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const MAX_LOG_SIZE = 10000; // Maximum log message size in bytes
const LOG_BATCH_SIZE = 50; // Number of logs to batch before processing
const LOG_FLUSH_INTERVAL = 5000; // Flush interval in milliseconds

// Types for enhanced type safety
type LogLevel = keyof typeof LOG_LEVELS;
type LogData = Record<string, unknown>;
type LogContext = {
  timestamp: number;
  traceId: string;
  sessionId: string;
  userId?: string;
  component?: string;
};

interface LogEntry {
  message: string;
  level: LogLevel;
  data?: LogData;
  context: LogContext;
  metrics?: Record<string, number>;
}

interface LoggerConfig {
  datadogApiKey?: string;
  environment: string;
  service: string;
  version: string;
  enableMetrics: boolean;
  enableCompression: boolean;
  sensitiveKeys: string[];
}

/**
 * Enhanced singleton logger with advanced monitoring and security features
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private metrics: Record<string, number> = {};
  private flushTimeout?: NodeJS.Timeout;
  private offlineStorage: Storage;

  private constructor() {
    this.config = {
      datadogApiKey: process.env.DATADOG_API_KEY,
      environment: process.env.NODE_ENV || 'development',
      service: 'terraform-visualizer',
      version: process.env.APP_VERSION || '1.0.0',
      enableMetrics: IS_PRODUCTION,
      enableCompression: IS_PRODUCTION,
      sensitiveKeys: ['password', 'token', 'key', 'secret']
    };

    this.initializeLogger();
    this.offlineStorage = window.localStorage;
    this.setupPeriodicFlush();
  }

  /**
   * Initializes logging services and configurations
   */
  private initializeLogger(): void {
    if (IS_PRODUCTION && this.config.datadogApiKey) {
      datadogLogs.init({
        clientToken: this.config.datadogApiKey,
        site: 'datadoghq.com',
        forwardErrorsToLogs: true,
        sampleRate: 100,
        service: this.config.service,
        env: this.config.environment,
        version: this.config.version
      });
    }
  }

  /**
   * Gets singleton instance of Logger
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Main logging method with enhanced security and monitoring
   */
  public async log(
    message: string,
    data?: LogData,
    level: LogLevel = LOG_LEVELS.INFO,
    options: { immediate?: boolean; component?: string } = {}
  ): Promise<void> {
    try {
      const logEntry = await this.formatLogMessage(message, data, level, {
        component: options.component
      });

      if (options.immediate) {
        await this.processLogEntry(logEntry);
      } else {
        this.bufferLogEntry(logEntry);
      }

      if (level === LOG_LEVELS.ERROR) {
        await handleError(new Error(message), 'SYSTEM_ERROR', data);
      }
    } catch (error) {
      console.error('Logging failed:', error);
      this.storeOffline(message, data, level);
    }
  }

  /**
   * Formats log messages with enhanced context and security measures
   */
  private async formatLogMessage(
    message: string,
    data?: LogData,
    level: LogLevel = LOG_LEVELS.INFO,
    options: { component?: string } = {}
  ): Promise<LogEntry> {
    const context: LogContext = {
      timestamp: Date.now(),
      traceId: this.generateTraceId(),
      sessionId: this.getSessionId(),
      component: options.component,
      userId: this.getUserId()
    };

    const sanitizedData = data ? this.sanitizeData(data) : undefined;

    const logEntry: LogEntry = {
      message: this.truncateMessage(message),
      level,
      data: sanitizedData,
      context
    };

    if (this.config.enableMetrics) {
      logEntry.metrics = this.collectMetrics(level);
    }

    return logEntry;
  }

  /**
   * Processes a batch of logs
   */
  public async flushLogs(force: boolean = false): Promise<void> {
    if (!force && this.logBuffer.length < LOG_BATCH_SIZE) {
      return;
    }

    const logsToProcess = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await this.processLogBatch(logsToProcess);
      await this.processOfflineLogs();
    } catch (error) {
      console.error('Failed to flush logs:', error);
      this.logBuffer = [...logsToProcess, ...this.logBuffer];
    }
  }

  /**
   * Processes a batch of log entries
   */
  private async processLogBatch(logs: LogEntry[]): Promise<void> {
    if (IS_PRODUCTION) {
      const compressedLogs = this.config.enableCompression
        ? this.compressLogs(logs)
        : logs;

      datadogLogs.logger.bulk(compressedLogs.map(log => ({
        message: log.message,
        level: log.level,
        context: log.context,
        ...log.data
      })));
    } else {
      logs.forEach(log => {
        console[log.level as keyof Console](
          `[${log.context.timestamp}] ${log.level.toUpperCase()}: ${log.message}`,
          { data: log.data, context: log.context }
        );
      });
    }
  }

  /**
   * Buffers a log entry for batch processing
   */
  private bufferLogEntry(logEntry: LogEntry): void {
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length >= LOG_BATCH_SIZE) {
      this.flushLogs(true);
    }
  }

  /**
   * Sets up periodic log flushing
   */
  private setupPeriodicFlush(): void {
    this.flushTimeout = setInterval(() => {
      this.flushLogs();
    }, LOG_FLUSH_INTERVAL);
  }

  /**
   * Generates a unique trace ID for log correlation
   */
  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitizes sensitive data from log entries
   */
  private sanitizeData(data: LogData): LogData {
    const sanitized = { ...data };
    this.config.sensitiveKeys.forEach(key => {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    });
    return sanitized;
  }

  /**
   * Collects performance metrics
   */
  private collectMetrics(level: LogLevel): Record<string, number> {
    this.metrics[`logs_${level}`] = (this.metrics[`logs_${level}`] || 0) + 1;
    return { ...this.metrics };
  }

  /**
   * Stores logs offline when network is unavailable
   */
  private storeOffline(message: string, data?: LogData, level: LogLevel = LOG_LEVELS.INFO): void {
    const offlineLogs = JSON.parse(this.offlineStorage.getItem('offline_logs') || '[]');
    offlineLogs.push({ message, data, level, timestamp: Date.now() });
    this.offlineStorage.setItem('offline_logs', JSON.stringify(offlineLogs));
  }

  /**
   * Processes stored offline logs
   */
  private async processOfflineLogs(): Promise<void> {
    const offlineLogs = JSON.parse(this.offlineStorage.getItem('offline_logs') || '[]');
    if (offlineLogs.length === 0) return;

    try {
      for (const log of offlineLogs) {
        await this.log(log.message, log.data, log.level, { immediate: true });
      }
      this.offlineStorage.removeItem('offline_logs');
    } catch (error) {
      console.error('Failed to process offline logs:', error);
    }
  }

  /**
   * Truncates long messages to prevent overflow
   */
  private truncateMessage(message: string): string {
    return message.length > MAX_LOG_SIZE
      ? `${message.substring(0, MAX_LOG_SIZE)}...`
      : message;
  }

  /**
   * Gets or generates a session ID
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = this.generateTraceId();
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  /**
   * Gets the current user ID if available
   */
  private getUserId(): string | undefined {
    return localStorage.getItem('userId') || undefined;
  }

  /**
   * Compresses log data for efficient transmission
   */
  private compressLogs(logs: LogEntry[]): LogEntry[] {
    // Implementation would use a compression algorithm
    return logs;
  }

  /**
   * Cleanup method for proper resource management
   */
  public destroy(): void {
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
    }
    this.flushLogs(true);
  }
}

// Export singleton instance getter
export const getLogger = Logger.getInstance;