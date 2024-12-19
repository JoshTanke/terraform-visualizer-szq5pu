// External dependencies
import { Octokit } from '@octokit/rest'; // v19.0.0
import { throttling } from '@octokit/plugin-throttling'; // v5.0.0
import { retry } from '@octokit/plugin-retry'; // v4.0.0
import CircuitBreaker from 'opossum'; // v6.0.0
import { MetricsCollector } from '@metrics/collector'; // v1.0.0

// Internal dependencies
import { githubConfig } from '../config/github.config';
import { AuthenticationError } from '../utils/errors';
import { Logger } from '../utils/logger';

// Configure Octokit with plugins
Octokit.plugin(throttling);
Octokit.plugin(retry);

// Types for GitHub API responses
interface Repository {
  id: number;
  name: string;
  owner: {
    login: string;
  };
  default_branch: string;
  private: boolean;
}

interface ContentResponse {
  content: string;
  sha: string;
}

/**
 * Thread-safe singleton class for managing GitHub API interactions
 * with enhanced security, monitoring, and error handling
 */
export class GithubClient {
  private static instance: GithubClient;
  private octokit: Octokit;
  private token: string | null = null;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;

  /**
   * Private constructor implementing thread-safe singleton pattern
   */
  private constructor() {
    this.logger = Logger.getInstance();
    this.metrics = new MetricsCollector('github_client');

    // Configure Octokit with security settings
    this.octokit = new Octokit({
      baseUrl: githubConfig.apiUrl,
      timeZone: 'UTC',
      userAgent: 'terraform-visualizer',
      previews: [],
      request: {
        timeout: 10000,
        retries: 3
      }
    });

    // Configure circuit breaker for API calls
    this.circuitBreaker = new CircuitBreaker(async (operation: Function) => {
      return await operation();
    }, {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      name: 'github-api'
    });

    // Set up circuit breaker event handlers
    this.setupCircuitBreakerEvents();
  }

  /**
   * Gets or creates thread-safe singleton instance
   */
  public static getInstance(): GithubClient {
    if (!GithubClient.instance) {
      GithubClient.instance = new GithubClient();
    }
    return GithubClient.instance;
  }

  /**
   * Sets up circuit breaker event monitoring
   */
  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.error('GitHub API circuit breaker opened', {
        service: 'github',
        event: 'circuit_breaker_open'
      });
      this.metrics.increment('github.circuit_breaker.open');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('GitHub API circuit breaker half-open', {
        service: 'github',
        event: 'circuit_breaker_half_open'
      });
      this.metrics.increment('github.circuit_breaker.half_open');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('GitHub API circuit breaker closed', {
        service: 'github',
        event: 'circuit_breaker_closed'
      });
      this.metrics.increment('github.circuit_breaker.close');
    });
  }

  /**
   * Authenticates client with enhanced security measures
   */
  public async authenticate(token: string): Promise<void> {
    try {
      // Validate token format
      if (!token || !/^gh[ps]_[a-zA-Z0-9]{36}$/.test(token)) {
        throw new AuthenticationError('Invalid GitHub token format');
      }

      this.token = token;
      this.octokit = new Octokit({
        auth: token,
        baseUrl: githubConfig.apiUrl,
        userAgent: 'terraform-visualizer',
        throttle: {
          onRateLimit: (retryAfter: number, options: any) => {
            this.logger.warn('Rate limit exceeded', {
              retryAfter,
              method: options.method,
              url: options.url
            });
            this.metrics.increment('github.rate_limit.exceeded');
            return retryAfter <= 60;
          },
          onSecondaryRateLimit: (retryAfter: number, options: any) => {
            this.logger.warn('Secondary rate limit exceeded', {
              retryAfter,
              method: options.method,
              url: options.url
            });
            this.metrics.increment('github.rate_limit.secondary_exceeded');
            return false;
          }
        }
      });

      // Verify authentication
      await this.octokit.users.getAuthenticated();
      
      this.logger.info('GitHub authentication successful');
      this.metrics.increment('github.auth.success');
    } catch (error) {
      this.metrics.increment('github.auth.failure');
      this.logger.error('GitHub authentication failed', {
        error: error.message,
        stack: error.stack
      });
      throw new AuthenticationError('GitHub authentication failed: ' + error.message);
    }
  }

  /**
   * Gets repository information with enhanced error handling
   */
  public async getRepository(owner: string, repo: string): Promise<Repository> {
    if (!this.token) {
      throw new AuthenticationError('GitHub client not authenticated');
    }

    return await this.circuitBreaker.fire(async () => {
      try {
        const startTime = Date.now();
        const response = await this.octokit.repos.get({ owner, repo });
        
        this.metrics.timing('github.repo.get', Date.now() - startTime);
        this.metrics.increment('github.repo.get.success');
        
        return response.data;
      } catch (error) {
        this.metrics.increment('github.repo.get.failure');
        this.logger.error('Failed to get repository', {
          owner,
          repo,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    });
  }

  /**
   * Gets repository content with security validation
   */
  public async getContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<ContentResponse> {
    if (!this.token) {
      throw new AuthenticationError('GitHub client not authenticated');
    }

    // Sanitize file path
    const sanitizedPath = path.replace(/\.\./g, '').replace(/[^a-zA-Z0-9/._-]/g, '');
    
    return await this.circuitBreaker.fire(async () => {
      try {
        const startTime = Date.now();
        const response = await this.octokit.repos.getContent({
          owner,
          repo,
          path: sanitizedPath,
          ref
        });

        this.metrics.timing('github.content.get', Date.now() - startTime);
        this.metrics.increment('github.content.get.success');

        if ('content' in response.data && 'sha' in response.data) {
          return {
            content: Buffer.from(response.data.content, 'base64').toString('utf-8'),
            sha: response.data.sha
          };
        }
        throw new Error('Invalid content response from GitHub API');
      } catch (error) {
        this.metrics.increment('github.content.get.failure');
        this.logger.error('Failed to get content', {
          owner,
          repo,
          path: sanitizedPath,
          ref,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    });
  }
}

// Export singleton instance
export default GithubClient.getInstance();