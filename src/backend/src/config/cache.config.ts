// @ts-check
import dotenv from 'dotenv'; // ^16.0.0 - Environment variable management

// Load environment variables
dotenv.config();

// Environment variables with defaults
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'tfv:';
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);
const REDIS_REPLICA_HOST = process.env.REDIS_REPLICA_HOST || '';
const REDIS_REPLICA_PORT = parseInt(process.env.REDIS_REPLICA_PORT || '6379', 10);

// Constants for configuration
const DEFAULT_SESSION_TTL = 3600; // 1 hour in seconds
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1000;
const MONITORING_INTERVAL = 60000; // 1 minute in milliseconds
const MAX_ACTIVE_SESSIONS = 10000;
const SESSION_RENEWAL_THRESHOLD = 0.8;

/**
 * Interface for Redis connection configuration with master-replica support
 */
export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  keyPrefix: string;
  retryStrategy: (retries: number) => number | null;
  replicaHost: string;
  replicaPort: number;
  enableMonitoring: boolean;
  maxRetryAttempts: number;
  retryDelayMs: number;
}

/**
 * Interface for session cache configuration with enhanced options
 */
export interface SessionConfig {
  ttl: number;
  prefix: string;
  rolling: boolean;
  renewalThreshold: number;
  maxActiveSessions: number;
}

/**
 * Interface for cache performance metrics
 */
export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionCount: number;
  avgResponseTime: number;
}

/**
 * Interface for retry strategy options
 */
interface RetryOptions {
  attempt: number;
  error: Error;
  total_retry_time: number;
  times_connected: number;
}

/**
 * Validates Redis cache configuration settings
 * @param config - Configuration object to validate
 * @returns Validation result with potential errors
 */
export function validateCacheConfig(config: Partial<RedisConfig>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate host and port
  if (!config.host) errors.push('Redis host is required');
  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Invalid Redis port number');
  }

  // Validate replica configuration if provided
  if (config.replicaHost && (!config.replicaPort || config.replicaPort < 1 || config.replicaPort > 65535)) {
    errors.push('Invalid replica port number');
  }

  // Validate database number
  if (config.db !== undefined && (config.db < 0 || config.db > 15)) {
    errors.push('Redis database number must be between 0 and 15');
  }

  // Validate key prefix
  if (config.keyPrefix && !/^[a-zA-Z0-9:_-]+$/.test(config.keyPrefix)) {
    errors.push('Invalid key prefix format');
  }

  // Validate retry parameters
  if (config.maxRetryAttempts && config.maxRetryAttempts < 1) {
    errors.push('Max retry attempts must be positive');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Creates a retry strategy function for Redis connection
 * @param options - Retry attempt options
 * @returns Retry delay in milliseconds or null to stop retrying
 */
export function createRetryStrategy(options: RetryOptions): number | null {
  if (options.error && options.error.code === 'ECONNREFUSED') {
    // Custom handling for connection refused
    return Math.min(options.attempt * RETRY_DELAY_MS, 30000);
  }

  if (options.total_retry_time > 1000 * 60 * 60) {
    // Stop retrying after 1 hour
    return null;
  }

  if (options.attempt > MAX_RETRY_ATTEMPTS) {
    // Stop retrying after maximum attempts
    return null;
  }

  // Implement exponential backoff with jitter
  return Math.min(
    Math.random() * 100 + Math.pow(2, options.attempt) * RETRY_DELAY_MS,
    30000
  );
}

/**
 * Main cache configuration object
 */
export const cacheConfig = {
  redis: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    db: REDIS_DB,
    keyPrefix: REDIS_KEY_PREFIX,
    retryStrategy: createRetryStrategy,
    replicaHost: REDIS_REPLICA_HOST,
    replicaPort: REDIS_REPLICA_PORT,
    enableMonitoring: true,
    maxRetryAttempts: MAX_RETRY_ATTEMPTS,
    retryDelayMs: RETRY_DELAY_MS
  } as RedisConfig,

  session: {
    ttl: DEFAULT_SESSION_TTL,
    prefix: 'sess:',
    rolling: true,
    renewalThreshold: SESSION_RENEWAL_THRESHOLD,
    maxActiveSessions: MAX_ACTIVE_SESSIONS
  } as SessionConfig,

  metrics: {
    hitRate: 0,
    missRate: 0,
    evictionCount: 0,
    avgResponseTime: 0
  } as CacheMetrics
};

// Default export for the entire configuration
export default cacheConfig;