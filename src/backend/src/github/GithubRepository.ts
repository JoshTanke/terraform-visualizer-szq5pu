// External dependencies
import path from 'path'; // ^1.0.0

// Internal dependencies
import { GithubClient } from './GithubClient';
import { githubConfig } from '../config/github.config';
import { Logger } from '../utils/logger';
import { CustomError } from '../utils/errors';

// Constants
const DEFAULT_CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_CACHE_SIZE = 100; // Maximum number of files to cache
const TERRAFORM_FILE_PATTERN = /\.tf$/;

/**
 * Interface for repository file metadata and content
 */
export interface IRepositoryFile {
  path: string;
  sha: string;
  content: string;
  lastModified: Date;
  contentHash: string;
  cacheExpiry: Date;
}

/**
 * Interface for repository directory structure
 */
export interface IRepositoryDirectory {
  path: string;
  files: string[];
  directories: string[];
}

/**
 * Repository initialization options
 */
interface IRepositoryOptions {
  maxCacheSize?: number;
  cacheExpiryMs?: number;
}

/**
 * Class for managing GitHub repository operations with enhanced security and performance
 */
export class GithubRepository {
  private client: GithubClient;
  private logger: Logger;
  private owner: string;
  private repo: string;
  private branch: string = 'main';
  private fileCache: Map<string, IRepositoryFile>;
  private maxCacheSize: number;
  private cacheExpiryMs: number;

  /**
   * Creates a new GithubRepository instance
   */
  constructor(owner: string, repo: string, options: IRepositoryOptions = {}) {
    this.client = GithubClient.getInstance();
    this.logger = Logger.getInstance();
    this.owner = owner;
    this.repo = repo;
    this.fileCache = new Map();
    this.maxCacheSize = options.maxCacheSize || DEFAULT_MAX_CACHE_SIZE;
    this.cacheExpiryMs = options.cacheExpiryMs || DEFAULT_CACHE_EXPIRY_MS;

    // Monitor memory usage for cache
    this.monitorCacheMemory();
  }

  /**
   * Initializes repository connection with authentication
   */
  public async initialize(token: string, branch?: string): Promise<void> {
    try {
      // Validate token format
      if (!token || !/^gh[ps]_[a-zA-Z0-9]{36}$/.test(token)) {
        throw new CustomError('Invalid GitHub token format', 'SEC_001', 401);
      }

      await this.client.authenticate(token);
      this.branch = branch || 'main';
      this.clearCache();

      this.logger.info('Repository initialized successfully', {
        owner: this.owner,
        repo: this.repo,
        branch: this.branch
      });
    } catch (error) {
      this.logger.error('Failed to initialize repository', {
        owner: this.owner,
        repo: this.repo,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieves file content with caching and validation
   */
  public async getFile(filePath: string): Promise<IRepositoryFile> {
    try {
      // Validate and sanitize file path
      const sanitizedPath = this.sanitizeFilePath(filePath);
      
      // Check cache first
      const cachedFile = this.fileCache.get(sanitizedPath);
      if (cachedFile && !this.isCacheExpired(cachedFile)) {
        this.logger.debug('Cache hit for file', { path: sanitizedPath });
        return cachedFile;
      }

      // Fetch from GitHub with rate limiting consideration
      const startTime = Date.now();
      const { content, sha } = await this.client.getContent(
        this.owner,
        this.repo,
        sanitizedPath,
        this.branch
      );

      // Create file object with metadata
      const file: IRepositoryFile = {
        path: sanitizedPath,
        sha,
        content,
        lastModified: new Date(),
        contentHash: this.generateContentHash(content),
        cacheExpiry: new Date(Date.now() + this.cacheExpiryMs)
      };

      // Update cache with eviction if needed
      this.updateCache(sanitizedPath, file);

      this.logger.info('File retrieved successfully', {
        path: sanitizedPath,
        timeMs: Date.now() - startTime
      });

      return file;
    } catch (error) {
      this.logger.error('Failed to get file', {
        path: filePath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieves directory structure with security checks
   */
  public async getDirectory(dirPath: string): Promise<IRepositoryDirectory> {
    try {
      const sanitizedPath = this.sanitizeFilePath(dirPath);
      const contents = await this.client.getContent(
        this.owner,
        this.repo,
        sanitizedPath,
        this.branch
      );

      const result: IRepositoryDirectory = {
        path: sanitizedPath,
        files: [],
        directories: []
      };

      // Process directory contents
      if (Array.isArray(contents)) {
        for (const item of contents) {
          if (item.type === 'file' && TERRAFORM_FILE_PATTERN.test(item.name)) {
            result.files.push(item.path);
          } else if (item.type === 'dir') {
            result.directories.push(item.path);
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to get directory', {
        path: dirPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clears the file content cache
   */
  public clearCache(): void {
    const cacheSize = this.fileCache.size;
    this.fileCache.clear();
    this.logger.info('Cache cleared', { previousSize: cacheSize });
  }

  /**
   * Sanitizes file path for security
   */
  private sanitizeFilePath(filePath: string): string {
    // Remove any parent directory traversal attempts
    const sanitized = path.normalize(filePath)
      .replace(/^(\.\.[\/\\])+/, '')
      .replace(/[^\w\s\-\.\/]/g, '');
    
    return sanitized;
  }

  /**
   * Checks if cached file is expired
   */
  private isCacheExpired(file: IRepositoryFile): boolean {
    return new Date() > file.cacheExpiry;
  }

  /**
   * Generates content hash for cache validation
   */
  private generateContentHash(content: string): string {
    return Buffer.from(content).toString('base64');
  }

  /**
   * Updates cache with eviction policy
   */
  private updateCache(path: string, file: IRepositoryFile): void {
    // Implement LRU eviction if cache is full
    if (this.fileCache.size >= this.maxCacheSize) {
      const oldestKey = this.fileCache.keys().next().value;
      this.fileCache.delete(oldestKey);
      this.logger.debug('Cache eviction occurred', { evictedPath: oldestKey });
    }

    this.fileCache.set(path, file);
  }

  /**
   * Monitors cache memory usage
   */
  private monitorCacheMemory(): void {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed > 0.8 * memoryUsage.heapTotal) {
        this.logger.warn('High memory usage detected, clearing cache', {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal
        });
        this.clearCache();
      }
    }, 60000); // Check every minute
  }
}