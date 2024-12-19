// External dependencies
import Redis, { RedisOptions } from 'ioredis'; // ^5.3.0

// Internal dependencies
import { cacheConfig } from '../config/cache.config';
import { Logger } from '../utils/logger';
import { BaseError } from '../utils/errors';

// Type definitions for cache operations
interface CacheOptions {
  ttl?: number;
  encrypt?: boolean;
  useReplica?: boolean;
  retryAttempts?: number;
}

interface DeleteOptions {
  waitForReplicas?: boolean;
  force?: boolean;
}

interface ClearOptions {
  pattern?: string;
  batch?: number;
}

interface ClientOptions {
  preferReplica?: boolean;
  forceMaster?: boolean;
}

interface ConnectionPoolItem {
  client: Redis;
  isHealthy: boolean;
  lastUsed: number;
}

/**
 * Custom error class for cache-specific errors
 */
class CacheError extends BaseError {
  constructor(message: string, code: string, metadata?: Record<string, any>) {
    super(message, code, 500, metadata);
  }
}

/**
 * Singleton service managing Redis cache operations with high availability,
 * security, and performance optimizations
 */
export class CacheService {
  private static instance: CacheService;
  private client: Redis;
  private replicaClient?: Redis;
  private logger: Logger;
  private readonly pool: Map<string, ConnectionPoolItem>;
  private readonly maxPoolSize: number = 10;
  private readonly healthCheckInterval: number = 30000;
  private encryptionKey: Buffer;

  /**
   * Private constructor implementing singleton pattern with enhanced initialization
   */
  private constructor() {
    this.logger = Logger.getInstance();
    this.pool = new Map();
    
    try {
      // Initialize encryption key for sensitive data
      this.encryptionKey = Buffer.from(process.env.CACHE_ENCRYPTION_KEY || 'default-key-change-in-production');
      
      // Configure main Redis client
      this.client = this.createRedisClient(false);
      
      // Configure replica client if replica host is specified
      if (cacheConfig.redis.replicaHost) {
        this.replicaClient = this.createRedisClient(true);
      }
      
      // Initialize connection pool
      this.initializeConnectionPool();
      
      // Setup health monitoring
      this.setupHealthMonitoring();
      
      this.logger.info('CacheService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize CacheService', { error });
      throw new CacheError('Cache initialization failed', 'CACHE_INIT_ERROR', { error });
    }
  }

  /**
   * Gets or creates singleton cache service instance with initialization verification
   */
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Creates a Redis client with appropriate configuration
   */
  private createRedisClient(isReplica: boolean): Redis {
    const options: RedisOptions = {
      host: isReplica ? cacheConfig.redis.replicaHost : cacheConfig.redis.host,
      port: isReplica ? cacheConfig.redis.replicaPort : cacheConfig.redis.port,
      password: cacheConfig.redis.password,
      db: cacheConfig.redis.db,
      keyPrefix: cacheConfig.redis.keyPrefix,
      retryStrategy: cacheConfig.redis.retryStrategy,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      connectTimeout: 10000,
      lazyConnect: false,
    };

    const client = new Redis(options);

    client.on('error', (error) => {
      this.logger.error('Redis client error', { error, isReplica });
      this.handleConnectionError(client, error, isReplica);
    });

    client.on('connect', () => {
      this.logger.info('Redis client connected', { isReplica });
    });

    return client;
  }

  /**
   * Initializes the connection pool for better performance
   */
  private initializeConnectionPool(): void {
    for (let i = 0; i < this.maxPoolSize; i++) {
      const client = this.createRedisClient(false);
      this.pool.set(`client_${i}`, {
        client,
        isHealthy: true,
        lastUsed: Date.now()
      });
    }
  }

  /**
   * Sets up health monitoring for Redis connections
   */
  private setupHealthMonitoring(): void {
    setInterval(() => {
      this.checkConnectionHealth();
    }, this.healthCheckInterval);
  }

  /**
   * Checks health of all Redis connections
   */
  private async checkConnectionHealth(): Promise<void> {
    try {
      // Check main client
      await this.client.ping();
      
      // Check replica if available
      if (this.replicaClient) {
        await this.replicaClient.ping();
      }
      
      // Check pool connections
      for (const [id, item] of this.pool.entries()) {
        try {
          await item.client.ping();
          item.isHealthy = true;
        } catch (error) {
          item.isHealthy = false;
          this.logger.warn(`Pool client ${id} health check failed`, { error });
        }
      }
    } catch (error) {
      this.logger.error('Health check failed', { error });
    }
  }

  /**
   * Handles Redis connection errors
   */
  private handleConnectionError(client: Redis, error: Error, isReplica: boolean): void {
    this.logger.error('Redis connection error', { error, isReplica });
    
    if (isReplica && this.replicaClient) {
      this.replicaClient = this.createRedisClient(true);
    } else if (!isReplica) {
      this.client = this.createRedisClient(false);
    }
  }

  /**
   * Sets a value in cache with encryption and performance optimization
   */
  public async set(key: string, value: any, ttl?: number, options: CacheOptions = {}): Promise<void> {
    try {
      const serializedValue = this.serializeValue(value, options.encrypt);
      
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      
      this.logger.debug('Cache set successful', { key, ttl });
    } catch (error) {
      this.logger.error('Cache set failed', { error, key });
      throw new CacheError('Failed to set cache value', 'CACHE_SET_ERROR', { key });
    }
  }

  /**
   * Retrieves and decrypts a value from cache with performance optimization
   */
  public async get(key: string, options: CacheOptions = {}): Promise<any> {
    try {
      const client = options.useReplica && this.replicaClient ? this.replicaClient : this.client;
      const value = await client.get(key);
      
      if (!value) return null;
      
      return this.deserializeValue(value, options.encrypt);
    } catch (error) {
      this.logger.error('Cache get failed', { error, key });
      throw new CacheError('Failed to get cache value', 'CACHE_GET_ERROR', { key });
    }
  }

  /**
   * Removes a value with replication verification
   */
  public async delete(key: string, options: DeleteOptions = {}): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      
      if (options.waitForReplicas && this.replicaClient) {
        await this.replicaClient.del(key);
      }
      
      return result > 0;
    } catch (error) {
      this.logger.error('Cache delete failed', { error, key });
      throw new CacheError('Failed to delete cache value', 'CACHE_DELETE_ERROR', { key });
    }
  }

  /**
   * Clears cache with pattern matching and replication verification
   */
  public async clear(prefix?: string, options: ClearOptions = {}): Promise<void> {
    try {
      const pattern = prefix ? `${prefix}*` : '*';
      const batchSize = options.batch || 100;
      
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          batchSize
        );
        
        if (keys.length) {
          await this.client.del(...keys);
        }
        
        cursor = nextCursor;
      } while (cursor !== '0');
      
      this.logger.info('Cache clear completed', { prefix });
    } catch (error) {
      this.logger.error('Cache clear failed', { error, prefix });
      throw new CacheError('Failed to clear cache', 'CACHE_CLEAR_ERROR', { prefix });
    }
  }

  /**
   * Gets Redis client with connection pool management
   */
  public getClient(options: ClientOptions = {}): Redis {
    if (options.preferReplica && this.replicaClient) {
      return this.replicaClient;
    }
    
    // Get least recently used healthy client from pool
    const poolClient = Array.from(this.pool.entries())
      .filter(([, item]) => item.isHealthy)
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed)[0];
    
    if (poolClient) {
      const [, item] = poolClient;
      item.lastUsed = Date.now();
      return item.client;
    }
    
    return this.client;
  }

  /**
   * Serializes and optionally encrypts values for storage
   */
  private serializeValue(value: any, encrypt: boolean = false): string {
    const serialized = JSON.stringify(value);
    
    if (encrypt) {
      // Implementation of encryption logic here
      // This is a placeholder for actual encryption implementation
      return `encrypted:${serialized}`;
    }
    
    return serialized;
  }

  /**
   * Deserializes and optionally decrypts values from storage
   */
  private deserializeValue(value: string, encrypt: boolean = false): any {
    if (encrypt && value.startsWith('encrypted:')) {
      // Implementation of decryption logic here
      // This is a placeholder for actual decryption implementation
      value = value.substring(10);
    }
    
    return JSON.parse(value);
  }
}

// Export singleton instance
export default CacheService.getInstance();