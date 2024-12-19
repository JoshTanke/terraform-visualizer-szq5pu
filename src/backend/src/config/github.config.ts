// @ts-check
import dotenv from 'dotenv'; // ^16.0.0 - Environment variable management
import { URL } from 'url';

// Initialize environment variables
dotenv.config();

/**
 * Default constants for GitHub API configuration
 */
export const DEFAULT_API_URL = 'https://api.github.com';
export const DEFAULT_API_VERSION = '2022-11-28';
export const RATE_LIMIT_REQUESTS = 100;
export const RATE_LIMIT_INTERVAL = 60000; // 1 minute in milliseconds
export const DEFAULT_BURST_LIMIT = 120;
export const TOKEN_EXPIRATION_SECONDS = 3600;
export const WEBHOOK_SIGNATURE_HEADER = 'X-Hub-Signature-256';

/**
 * Interface for OAuth configuration settings
 */
interface IOAuthConfig {
  clientId: string;
  clientSecret: string;
  jwtSecret: string;
  scopes: string[];
  tokenExpirationSeconds: number;
  enableTokenRefresh: boolean;
}

/**
 * Interface for rate limiting configuration
 */
interface IRateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
  windowMs: number;
  strategy: 'token-bucket' | 'sliding-window';
  recovery: {
    enabled: boolean;
    backoffMs: number;
    maxRetries: number;
  };
}

/**
 * Interface for webhook configuration
 */
interface IWebhookConfig {
  secret: string;
  allowedEvents: string[];
  enforceSignatureValidation: boolean;
  retryStrategy: {
    attempts: number;
    backoffMs: number;
    maxBackoffMs: number;
  };
}

/**
 * Comprehensive interface for GitHub configuration
 */
export interface IGithubConfig {
  apiUrl: string;
  apiVersion: string;
  oauth: IOAuthConfig;
  rateLimiting: IRateLimitConfig;
  webhook: IWebhookConfig;
}

/**
 * Validates the GitHub configuration settings
 * @throws {Error} If configuration is invalid
 */
export function validateConfig(): void {
  // Validate required environment variables
  const requiredEnvVars = [
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GITHUB_JWT_SECRET',
    'GITHUB_WEBHOOK_SECRET'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Validate API URL format
  try {
    new URL(process.env.GITHUB_API_URL || DEFAULT_API_URL);
  } catch (error) {
    throw new Error('Invalid GitHub API URL format');
  }

  // Validate JWT secret length
  if (process.env.GITHUB_JWT_SECRET!.length < 32) {
    throw new Error('JWT secret must be at least 32 characters long');
  }

  // Validate webhook secret length
  if (process.env.GITHUB_WEBHOOK_SECRET!.length < 32) {
    throw new Error('Webhook secret must be at least 32 characters long');
  }
}

/**
 * GitHub configuration object with secure defaults and environment variable integration
 */
export const githubConfig: IGithubConfig = {
  apiUrl: process.env.GITHUB_API_URL || DEFAULT_API_URL,
  apiVersion: process.env.GITHUB_API_VERSION || DEFAULT_API_VERSION,
  
  oauth: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    jwtSecret: process.env.GITHUB_JWT_SECRET!,
    scopes: [
      'repo',
      'read:user',
      'user:email',
      'workflow'
    ],
    tokenExpirationSeconds: TOKEN_EXPIRATION_SECONDS,
    enableTokenRefresh: true
  },

  rateLimiting: {
    requestsPerMinute: RATE_LIMIT_REQUESTS,
    burstLimit: DEFAULT_BURST_LIMIT,
    windowMs: RATE_LIMIT_INTERVAL,
    strategy: 'token-bucket',
    recovery: {
      enabled: true,
      backoffMs: 1000,
      maxRetries: 3
    }
  },

  webhook: {
    secret: process.env.GITHUB_WEBHOOK_SECRET!,
    allowedEvents: [
      'push',
      'pull_request',
      'repository',
      'workflow_run'
    ],
    enforceSignatureValidation: true,
    retryStrategy: {
      attempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 8000
    }
  }
};

// Validate configuration on module load
validateConfig();

// Export the validated configuration
export default githubConfig;