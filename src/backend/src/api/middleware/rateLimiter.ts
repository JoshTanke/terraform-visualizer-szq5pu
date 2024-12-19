// External dependencies
import rateLimit from 'express-rate-limit'; // ^6.7.0
import RedisStore from 'rate-limit-redis'; // ^3.0.0
import Redis from 'ioredis'; // ^5.3.0
import { Request, Response, RequestHandler } from 'express'; // ^4.18.2

// Internal dependencies
import { cacheConfig } from '../../config/cache.config';
import { Logger } from '../../utils/logger';
import { AuthorizationError } from '../../utils/errors';

// Constants for rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per window
const RATE_LIMIT_KEY_PREFIX = 'tfv:ratelimit:';

/**
 * Configuration options for rate limiter middleware with high availability support
 */
export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

/**
 * Creates a Redis client instance with failover support for rate limiting
 */
const createRedisClient = (): Redis => {
  const client = new Redis({
    host: cacheConfig.redis.host,
    port: cacheConfig.redis.port,
    password: cacheConfig.redis.password,
    db: cacheConfig.redis.db,
    retryStrategy: cacheConfig.redis.retryStrategy,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });

  // Set up error handling
  client.on('error', (error) => {
    Logger.getInstance().error('Redis rate limiter error', {
      error: error.message,
      component: 'RateLimiter',
    });
  });

  // Set up connection monitoring
  client.on('connect', () => {
    Logger.getInstance().info('Redis rate limiter connected', {
      component: 'RateLimiter',
    });
  });

  return client;
};

/**
 * Handles rate limit exceeded scenarios with comprehensive logging and monitoring
 */
const handleRateLimit = (req: Request, res: Response): void => {
  const clientIp = req.ip;
  const userAgent = req.get('user-agent') || 'Unknown';
  const path = req.path;
  const correlationId = `rl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log rate limit violation
  Logger.getInstance().warn('Rate limit exceeded', {
    clientIp,
    userAgent,
    path,
    correlationId,
    component: 'RateLimiter',
    headers: req.headers,
    method: req.method,
  });

  throw new AuthorizationError(
    'Rate limit exceeded. Please try again later.',
    'SEC_RATE_LIMIT',
    429,
    {
      correlationId,
      path,
      clientIp: clientIp.replace(/[^0-9.]/g, '*'), // Mask IP for security
    }
  );
};

/**
 * Creates and configures the rate limiter middleware with distributed rate limiting,
 * high availability, and monitoring support
 */
export const createRateLimiter = (options?: RateLimiterOptions): RequestHandler => {
  const redisClient = createRedisClient();

  const limiter = rateLimit({
    windowMs: options?.windowMs || RATE_LIMIT_WINDOW_MS,
    max: options?.max || RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: options?.standardHeaders ?? true, // Send standard rate limit headers
    legacyHeaders: options?.legacyHeaders ?? false, // Disable legacy rate limit headers
    keyGenerator: (req: Request): string => {
      // Generate a unique key based on IP and optional user ID
      const clientIp = req.ip;
      const userId = (req as any).user?.id || 'anonymous';
      return `${options?.keyPrefix || RATE_LIMIT_KEY_PREFIX}${clientIp}_${userId}`;
    },
    handler: handleRateLimit,
    skip: (req: Request): boolean => {
      // Skip rate limiting for health checks and specific internal routes
      return req.path === '/health' || req.path.startsWith('/internal/');
    },
    store: new RedisStore({
      // Use sendCommand instead of the deprecated send_command
      sendCommand: (...args: any[]): Promise<any> => {
        return redisClient.call(...args);
      },
      prefix: options?.keyPrefix || RATE_LIMIT_KEY_PREFIX,
      // Implement reconnection strategy
      resetKey: (key: string): Promise<void> => {
        return redisClient.del(key).then(() => undefined);
      },
    }),
    statusCode: 429, // Too Many Requests
    message: 'Too many requests, please try again later.',
    draft_polli_ratelimit_headers: true, // Enable draft RFC headers
  });

  // Return the configured middleware
  return (req: Request, res: Response, next: Function): void => {
    // Add custom headers for monitoring
    res.on('finish', () => {
      const remaining = parseInt(res.getHeader('X-RateLimit-Remaining') as string, 10);
      const limit = parseInt(res.getHeader('X-RateLimit-Limit') as string, 10);
      
      // Log rate limit metrics
      if (!isNaN(remaining) && !isNaN(limit)) {
        Logger.getInstance().debug('Rate limit metrics', {
          path: req.path,
          remaining,
          limit,
          usage: ((limit - remaining) / limit) * 100,
          component: 'RateLimiter',
        });
      }
    });

    // Apply rate limiting
    limiter(req, res, next);
  };
};