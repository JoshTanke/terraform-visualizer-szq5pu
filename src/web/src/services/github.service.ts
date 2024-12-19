/**
 * @fileoverview Enhanced GitHub service implementation for secure repository management
 * and synchronization with comprehensive error handling and real-time status tracking.
 * @version 1.0.0
 */

import { Octokit } from '@octokit/rest'; // v19.0.0
import CryptoJS from 'crypto-js'; // v4.1.1
import axiosRetry from 'axios-retry'; // v3.3.0
import { IProject } from '../interfaces/IProject';
import { authConfig } from '../config/auth.config';
import { ApiService } from './api.service';

/**
 * GitHub API error types for specific error handling
 */
enum GitHubErrorType {
    RATE_LIMIT = 'RATE_LIMIT',
    AUTHENTICATION = 'AUTHENTICATION',
    PERMISSION = 'PERMISSION',
    NOT_FOUND = 'NOT_FOUND',
    VALIDATION = 'VALIDATION',
    NETWORK = 'NETWORK',
    UNKNOWN = 'UNKNOWN'
}

/**
 * Interface for sync status tracking
 */
interface SyncStatus {
    inProgress: boolean;
    progress: number;
    message: string;
    error: string | null;
    lastSync: Date | null;
}

/**
 * Enhanced GitHub service class with comprehensive security and sync capabilities
 */
export class GitHubService {
    private octokit: Octokit;
    private apiService: ApiService;
    private codeVerifier: string | null = null;
    private readonly retryAttempts: number = 3;
    private syncStatus: Map<string, SyncStatus> = new Map();

    /**
     * Initialize GitHub service with enhanced security and monitoring
     * @param accessToken - GitHub access token
     * @param options - Configuration options
     */
    constructor(
        accessToken?: string,
        private options: {
            baseUrl?: string;
            timeout?: number;
            retryDelay?: number;
        } = {}
    ) {
        // Initialize Octokit with retry configuration
        this.octokit = new Octokit({
            auth: accessToken,
            baseUrl: options.baseUrl || 'https://api.github.com',
            request: {
                timeout: options.timeout || 10000
            }
        });

        // Configure retry behavior
        axiosRetry(this.octokit.request, {
            retries: this.retryAttempts,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (error) => {
                return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                    this.isRetryableError(error);
            }
        });

        this.apiService = new ApiService();

        // Setup rate limit monitoring
        this.setupRateLimitMonitoring();
    }

    /**
     * Generate PKCE challenge and verifier for OAuth flow
     * @returns Promise resolving to PKCE parameters
     */
    private async generatePKCE(): Promise<{ verifier: string; challenge: string }> {
        // Generate random verifier
        const verifier = CryptoJS.lib.WordArray.random(32).toString();
        this.codeVerifier = verifier;

        // Create SHA-256 hash
        const hash = CryptoJS.SHA256(verifier);

        // Base64URL encode challenge
        const challenge = hash.toString(CryptoJS.enc.Base64)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        return { verifier, challenge };
    }

    /**
     * Generate secure GitHub OAuth authorization URL
     * @returns Promise resolving to authorization URL
     */
    public async getAuthUrl(): Promise<string> {
        const { challenge } = await this.generatePKCE();
        const state = CryptoJS.lib.WordArray.random(16).toString();

        // Store state for validation
        sessionStorage.setItem('github_oauth_state', state);

        const params = new URLSearchParams({
            client_id: authConfig.github.clientId,
            redirect_uri: authConfig.github.redirectUri,
            scope: authConfig.github.scope,
            state,
            code_challenge: challenge,
            code_challenge_method: 'S256'
        });

        return `${authConfig.github.authUrl}?${params.toString()}`;
    }

    /**
     * Handle OAuth callback with enhanced security
     * @param code - Authorization code
     * @param state - State parameter for CSRF protection
     * @returns Promise resolving to encrypted access token
     */
    public async handleAuthCallback(code: string, state: string): Promise<string> {
        // Validate state
        const storedState = sessionStorage.getItem('github_oauth_state');
        if (!storedState || storedState !== state) {
            throw new Error('Invalid state parameter');
        }

        // Verify PKCE
        if (!this.codeVerifier) {
            throw new Error('Missing PKCE verifier');
        }

        try {
            const response = await fetch(authConfig.github.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify({
                    client_id: authConfig.github.clientId,
                    code,
                    code_verifier: this.codeVerifier,
                    redirect_uri: authConfig.github.redirectUri
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error_description || data.error);
            }

            // Encrypt token before storage
            const encryptedToken = CryptoJS.AES.encrypt(
                data.access_token,
                authConfig.storage.tokenKey
            ).toString();

            // Clear sensitive data
            this.codeVerifier = null;
            sessionStorage.removeItem('github_oauth_state');

            return encryptedToken;
        } catch (error) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
     * Synchronize repository with real-time progress tracking
     * @param project - Project to synchronize
     * @returns Promise resolving when sync is complete
     */
    public async syncRepository(project: IProject): Promise<void> {
        // Initialize sync status
        this.syncStatus.set(project.id, {
            inProgress: true,
            progress: 0,
            message: 'Starting synchronization...',
            error: null,
            lastSync: null
        });

        try {
            // Validate repository access
            await this.validateRepository(project.githubUrl);

            // Check rate limits
            await this.checkRateLimits();

            // Update status
            this.updateSyncStatus(project.id, {
                progress: 20,
                message: 'Fetching repository content...'
            });

            // Get repository content
            const content = await this.getRepositoryContent(project.githubUrl, project.githubBranch);

            // Update status
            this.updateSyncStatus(project.id, {
                progress: 50,
                message: 'Processing Terraform files...'
            });

            // Sync with backend
            await this.apiService.syncWithGitHub(project.id);

            // Update final status
            this.syncStatus.set(project.id, {
                inProgress: false,
                progress: 100,
                message: 'Synchronization complete',
                error: null,
                lastSync: new Date()
            });
        } catch (error) {
            // Handle sync error
            this.syncStatus.set(project.id, {
                inProgress: false,
                progress: 0,
                message: 'Synchronization failed',
                error: error.message,
                lastSync: null
            });
            throw error;
        }
    }

    /**
     * Get current sync status for a project
     * @param projectId - Project ID
     * @returns Current sync status
     */
    public getSyncStatus(projectId: string): SyncStatus {
        return this.syncStatus.get(projectId) || {
            inProgress: false,
            progress: 0,
            message: 'No sync in progress',
            error: null,
            lastSync: null
        };
    }

    /**
     * Setup rate limit monitoring
     */
    private setupRateLimitMonitoring(): void {
        this.octokit.hook.after('request', async (response) => {
            const remaining = parseInt(response.headers['x-ratelimit-remaining'], 10);
            if (remaining < 100) {
                console.warn(`GitHub API rate limit low: ${remaining} requests remaining`);
            }
        });
    }

    /**
     * Check if error is retryable
     * @param error - Error to check
     * @returns Boolean indicating if error is retryable
     */
    private isRetryableError(error: any): boolean {
        const errorType = this.categorizeError(error);
        return [
            GitHubErrorType.RATE_LIMIT,
            GitHubErrorType.NETWORK
        ].includes(errorType);
    }

    /**
     * Categorize GitHub API errors
     * @param error - Error to categorize
     * @returns Error type
     */
    private categorizeError(error: any): GitHubErrorType {
        if (!error.response) {
            return GitHubErrorType.NETWORK;
        }

        switch (error.response.status) {
            case 403:
                return error.response.headers['x-ratelimit-remaining'] === '0'
                    ? GitHubErrorType.RATE_LIMIT
                    : GitHubErrorType.PERMISSION;
            case 401:
                return GitHubErrorType.AUTHENTICATION;
            case 404:
                return GitHubErrorType.NOT_FOUND;
            case 422:
                return GitHubErrorType.VALIDATION;
            default:
                return GitHubErrorType.UNKNOWN;
        }
    }

    /**
     * Update sync status for a project
     * @param projectId - Project ID
     * @param update - Status update
     */
    private updateSyncStatus(projectId: string, update: Partial<SyncStatus>): void {
        const current = this.syncStatus.get(projectId);
        if (current) {
            this.syncStatus.set(projectId, { ...current, ...update });
        }
    }

    /**
     * Validate repository access
     * @param repoUrl - Repository URL
     */
    private async validateRepository(repoUrl: string): Promise<void> {
        const { owner, repo } = this.parseRepositoryUrl(repoUrl);
        await this.octokit.repos.get({ owner, repo });
    }

    /**
     * Check current rate limits
     */
    private async checkRateLimits(): Promise<void> {
        const { data } = await this.octokit.rateLimit.get();
        if (data.rate.remaining < 100) {
            throw new Error('Rate limit too low to proceed with sync');
        }
    }

    /**
     * Get repository content
     * @param repoUrl - Repository URL
     * @param branch - Branch name
     * @returns Repository content
     */
    private async getRepositoryContent(repoUrl: string, branch: string): Promise<any> {
        const { owner, repo } = this.parseRepositoryUrl(repoUrl);
        const { data } = await this.octokit.repos.getContent({
            owner,
            repo,
            path: '',
            ref: branch
        });
        return data;
    }

    /**
     * Parse repository URL into owner and repo
     * @param url - Repository URL
     * @returns Owner and repo names
     */
    private parseRepositoryUrl(url: string): { owner: string; repo: string } {
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
            throw new Error('Invalid GitHub repository URL');
        }
        return { owner: match[1], repo: match[2] };
    }
}

export default GitHubService;