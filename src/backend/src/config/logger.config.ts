// @ts-nocheck
// External dependencies
import winston from 'winston'; // v3.10.0
import DailyRotateFile from 'winston-daily-rotate-file'; // v4.7.1
import { existsSync, mkdirSync, accessSync, constants } from 'fs';
import { join } from 'path';

// Environment variables with defaults
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_DIR = process.env.LOG_DIR || 'logs';
const MAX_FILE_SIZE = process.env.MAX_LOG_SIZE || '20m';
const MAX_FILES = process.env.MAX_LOG_FILES || '14d';

// Constants for logging configuration
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
} as const;

const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
} as const;

// Interface for logger configuration
interface LoggerConfig {
  level: string;
  levels: typeof LOG_LEVELS;
  format: winston.Logform.Format;
  transports: winston.transport[];
  exitOnError: boolean;
  silent: boolean;
  handleExceptions: boolean;
}

/**
 * Determines the appropriate log level based on the environment
 * @returns {string} The determined log level
 */
const getLogLevel = (): string => {
  // Validate environment variable
  if (!NODE_ENV) {
    console.warn('NODE_ENV is not set, defaulting to "info" level');
    return 'info';
  }

  // Return appropriate level based on environment
  switch (NODE_ENV.toLowerCase()) {
    case 'development':
      return 'debug';
    case 'staging':
      return 'info';
    case 'production':
      return 'warn';
    default:
      console.warn(`Unknown NODE_ENV: ${NODE_ENV}, defaulting to "info" level`);
      return 'info';
  }
};

/**
 * Creates logging directory if it doesn't exist
 * @param {string} dirPath - Path to the logging directory
 */
const createLogDir = (dirPath: string): void => {
  try {
    // Check if directory exists
    if (!existsSync(dirPath)) {
      // Create directory with secure permissions (755)
      mkdirSync(dirPath, { recursive: true, mode: 0o755 });
    }

    // Verify write permissions
    accessSync(dirPath, constants.W_OK);
  } catch (error) {
    console.error(`Failed to create or access log directory: ${dirPath}`, error);
    throw error;
  }
};

// Create log directory
createLogDir(LOG_DIR);

// Configure log format
const LOG_FORMAT = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.metadata({ 
    fillWith: ['timestamp', 'level', 'message'],
    fillExcept: ['trace', 'stack']
  }),
  winston.format.json()
);

// Transport options for file rotation
const TRANSPORT_OPTIONS = {
  maxSize: MAX_FILE_SIZE,
  maxFiles: MAX_FILES,
  tailable: true,
  zippedArchive: true,
  format: LOG_FORMAT
};

// Create transports array with file rotation for different log levels
const transports: winston.transport[] = [
  // Combined logs
  new DailyRotateFile({
    ...TRANSPORT_OPTIONS,
    filename: join(LOG_DIR, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD'
  }),
  // Error logs
  new DailyRotateFile({
    ...TRANSPORT_OPTIONS,
    filename: join(LOG_DIR, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error'
  })
];

// Add console transport in development
if (NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple()
      )
    })
  );
}

// Export logger configuration
export const loggerConfig: LoggerConfig = {
  level: getLogLevel(),
  levels: LOG_LEVELS,
  format: LOG_FORMAT,
  transports,
  exitOnError: false,
  silent: NODE_ENV === 'test', // Silence logs in test environment
  handleExceptions: true
};

// Export individual components for flexibility
export const levels = LOG_LEVELS;
export const format = LOG_FORMAT;
export const colors = LOG_COLORS;

// Type exports for better type safety
export type LogLevel = keyof typeof LOG_LEVELS;
export type LogColor = keyof typeof LOG_COLORS;