// External dependencies
import EventEmitter from 'events'; // ^1.0.0
import CircuitBreaker from 'opossum'; // v6.0.0
import RateLimiter from 'limiter'; // v2.0.0

// Internal dependencies
import { GithubClient } from './GithubClient';
import { GithubRepository } from './GithubRepository';
import { CacheService } from '../services/CacheService';
import { Logger } from '../utils/logger';

/**
 * Interface for enhanced sync configuration options
 */
export interface ISyncOptions {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  syncInterval: number;
  maxRetries: number;
  cacheTTL: number;
  rateLimit: number;
  enableDifferentialSync: boolean;
}

/**
 * Interface for detailed sync operation status
 */
export interface ISyncStatus {
  isActive: boolean;
  lastSync: Date;
  changedFiles: string[];
  lastError: Error | null;
  syncCount: number;
  errorCount: number;
  cacheHitRate: number;
  rateLimitRemaining: number;
  averageSyncTime: number;
}

/**
 * Enhanced GitHub repository synchronization manager with optimized performance
 * and real-time updates
 */
export class GithubSync {
  private repository: GithubRepository;
  private cache: CacheService;
  private logger: Logger;
  private events: EventEmitter;
  private status: ISyncStatus;
  private syncInterval: NodeJS.Timer | null;
  private retryCount: Map<string, number>;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter.TokenBucket;

  /**
   * Initializes a new GithubSync instance with enhanced configuration
   */
  constructor(private options: ISyncOptions) {
    this.repository = new GithubRepository(options.owner, options.repo, {
      maxCacheSize: 1000,
      cacheExpiryMs: options.cacheTTL
    });

    this.cache = CacheService.getInstance();
    this.logger = Logger.getInstance();
    this.events = new EventEmitter();
    this.syncInterval = null;
    this.retryCount = new Map();

    // Initialize status tracking
    this.status = {
      isActive: false,
      lastSync: new Date(),
      changedFiles: [],
      lastError: null,
      syncCount: 0,
      errorCount: 0,
      cacheHitRate: 0,
      rateLimitRemaining: options.rateLimit,
      averageSyncTime: 0
    };

    // Configure circuit breaker for error resilience
    this.circuitBreaker = new CircuitBreaker(async () => this.syncFiles(), {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      name: 'github-sync'
    });

    // Configure rate limiter
    this.rateLimiter = new RateLimiter.TokenBucket({
      tokensPerInterval: options.rateLimit,
      interval: 'hour'
    });

    // Set up event listeners with memory leak prevention
    this.events.setMaxListeners(20);
    this.setupEventHandlers();
  }

  /**
   * Sets up event handlers for sync operations
   */
  private setupEventHandlers(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.error('Sync circuit breaker opened', {
        owner: this.options.owner,
        repo: this.options.repo
      });
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Sync circuit breaker half-open', {
        owner: this.options.owner,
        repo: this.options.repo
      });
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Sync circuit breaker closed', {
        owner: this.options.owner,
        repo: this.options.repo
      });
    });
  }

  /**
   * Starts enhanced periodic synchronization with performance optimization
   */
  public async startSync(): Promise<void> {
    try {
      // Initialize repository connection
      await this.repository.initialize(this.options.token, this.options.branch);

      // Perform initial sync
      await this.syncFiles();

      // Set up periodic sync with memory leak prevention
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }

      this.syncInterval = setInterval(
        async () => {
          await this.circuitBreaker.fire();
        },
        this.options.syncInterval
      );

      this.status.isActive = true;
      this.events.emit('sync:started', { timestamp: new Date() });

      this.logger.info('Sync started successfully', {
        owner: this.options.owner,
        repo: this.options.repo,
        interval: this.options.syncInterval
      });
    } catch (error) {
      this.status.lastError = error;
      this.status.errorCount++;
      this.logger.error('Failed to start sync', {
        error: error.message,
        owner: this.options.owner,
        repo: this.options.repo
      });
      throw error;
    }
  }

  /**
   * Stops synchronization with cleanup
   */
  public stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.status.isActive = false;
    this.events.emit('sync:stopped', { timestamp: new Date() });

    this.logger.info('Sync stopped', {
      owner: this.options.owner,
      repo: this.options.repo
    });
  }

  /**
   * Enhanced file synchronization with differential updates
   */
  public async syncFiles(): Promise<string[]> {
    const startTime = Date.now();

    try {
      // Check rate limit
      if (!(await this.rateLimiter.tryRemoveTokens(1))) {
        throw new Error('Rate limit exceeded');
      }

      // Get repository structure
      const directory = await this.repository.getDirectory('');
      const changedFiles: string[] = [];

      // Process files with differential sync
      for (const filePath of directory.files) {
        const cacheKey = `repo:${this.options.owner}:${this.options.repo}:${filePath}`;
        const cachedFile = await this.cache.get(cacheKey);
        const currentFile = await this.repository.getFile(filePath);

        if (!cachedFile || cachedFile.contentHash !== currentFile.contentHash) {
          await this.cache.set(cacheKey, currentFile, this.options.cacheTTL);
          changedFiles.push(filePath);
          this.events.emit('file:changed', { filePath, timestamp: new Date() });
        }
      }

      // Update status metrics
      this.status.lastSync = new Date();
      this.status.changedFiles = changedFiles;
      this.status.syncCount++;
      this.status.averageSyncTime = 
        (this.status.averageSyncTime * (this.status.syncCount - 1) + (Date.now() - startTime)) / 
        this.status.syncCount;

      this.logger.info('Sync completed successfully', {
        changedFiles: changedFiles.length,
        duration: Date.now() - startTime
      });

      return changedFiles;
    } catch (error) {
      this.status.lastError = error;
      this.status.errorCount++;
      
      this.logger.error('Sync failed', {
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Gets detailed sync status with metrics
   */
  public getStatus(): ISyncStatus {
    return {
      ...this.status,
      rateLimitRemaining: this.rateLimiter.getTokensRemaining()
    };
  }
}