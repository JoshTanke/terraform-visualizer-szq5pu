/**
 * @fileoverview Enhanced Authentication Service with PKCE and Security Features
 * Implements secure GitHub OAuth authentication flow with advanced security measures
 * including token rotation, rate limiting, and session management.
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios'; // v1.4.0
import { IUser, IToken, IGithubAuthResponse, UserRole } from '../interfaces/IAuth';
import { authConfig, validateTokenExpiry, generatePKCEChallenge } from '../config/auth.config';
import CryptoJS from 'crypto-js'; // v4.1.1

/**
 * Rate limiter interface for tracking API call frequency
 */
interface RateLimiter {
  attempts: number;
  resetTime: number;
}

/**
 * Session tracking interface for monitoring user activity
 */
interface SessionTracker {
  lastActivity: number;
  browserFingerprint: string;
}

/**
 * Enhanced Authentication Service with comprehensive security features
 * Implements PKCE flow, token rotation, and session management
 */
export class AuthService {
  private _storage: Storage;
  private _axios: AxiosInstance;
  private _rateLimiter: Map<string, RateLimiter>;
  private _sessionTracker: SessionTracker;

  constructor() {
    // Initialize secure storage
    this._storage = window.localStorage;
    this._rateLimiter = new Map();
    
    // Initialize axios instance with interceptors
    this._axios = axios.create({
      baseURL: authConfig.api.baseUrl,
      timeout: authConfig.api.timeout,
      headers: authConfig.api.headers
    });

    // Initialize session tracker
    this._sessionTracker = {
      lastActivity: Date.now(),
      browserFingerprint: this.generateBrowserFingerprint()
    };

    this.setupAxiosInterceptors();
  }

  /**
   * Configures axios interceptors for token refresh and error handling
   * @private
   */
  private setupAxiosInterceptors(): void {
    this._axios.interceptors.request.use(
      async (config) => {
        const token = await this.getStoredToken();
        if (token && !validateTokenExpiry(token)) {
          const newToken = await this.refreshToken();
          config.headers.Authorization = `Bearer ${newToken.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this._axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await this.logout();
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generates unique browser fingerprint for session tracking
   * @private
   * @returns Unique browser fingerprint
   */
  private generateBrowserFingerprint(): string {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset()
    ];
    return CryptoJS.SHA256(components.join('|')).toString();
  }

  /**
   * Securely stores token with encryption
   * @private
   * @param token Token to store
   */
  private async storeToken(token: IToken): Promise<void> {
    const encryptedToken = CryptoJS.AES.encrypt(
      JSON.stringify(token),
      authConfig.storage.tokenKey
    ).toString();
    this._storage.setItem(authConfig.storage.tokenKey, encryptedToken);
  }

  /**
   * Retrieves and decrypts stored token
   * @private
   * @returns Decrypted token or null
   */
  private async getStoredToken(): Promise<IToken | null> {
    const encryptedToken = this._storage.getItem(authConfig.storage.tokenKey);
    if (!encryptedToken) return null;

    try {
      const decrypted = CryptoJS.AES.decrypt(
        encryptedToken,
        authConfig.storage.tokenKey
      ).toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Token decryption failed:', error);
      return null;
    }
  }

  /**
   * Checks rate limiting for API calls
   * @private
   * @param operation Operation to check
   * @returns Boolean indicating if operation is allowed
   */
  private checkRateLimit(operation: string): boolean {
    const limit = this._rateLimiter.get(operation);
    const now = Date.now();

    if (!limit || now > limit.resetTime) {
      this._rateLimiter.set(operation, {
        attempts: 1,
        resetTime: now + authConfig.security.rateLimit.windowMs
      });
      return true;
    }

    if (limit.attempts >= authConfig.security.rateLimit.maxAttempts) {
      return false;
    }

    limit.attempts++;
    return true;
  }

  /**
   * Initiates GitHub OAuth login flow with PKCE
   * @public
   */
  public async login(): Promise<void> {
    if (!this.checkRateLimit('login')) {
      throw new Error('Rate limit exceeded for login attempts');
    }

    const { verifier, challenge } = generatePKCEChallenge();
    const state = authConfig.github.state;

    // Store PKCE verifier and state securely
    this._storage.setItem(
      authConfig.storage.stateKey,
      JSON.stringify({ state, verifier, timestamp: Date.now() })
    );

    // Construct GitHub OAuth URL with PKCE
    const params = new URLSearchParams({
      client_id: authConfig.github.clientId,
      redirect_uri: authConfig.github.redirectUri,
      scope: authConfig.github.scope,
      state: state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });

    window.location.href = `${authConfig.github.authUrl}?${params.toString()}`;
  }

  /**
   * Handles GitHub OAuth callback with enhanced security
   * @public
   * @param response GitHub OAuth response
   * @returns Promise resolving to token data
   */
  public async handleOAuthCallback(response: IGithubAuthResponse): Promise<IToken> {
    if (!this.checkRateLimit('oauth_callback')) {
      throw new Error('Rate limit exceeded for OAuth callbacks');
    }

    // Validate stored state and PKCE verifier
    const storedData = JSON.parse(
      this._storage.getItem(authConfig.storage.stateKey) || '{}'
    );

    if (
      !storedData.state ||
      !storedData.verifier ||
      storedData.state !== response.state ||
      Date.now() - storedData.timestamp > 300000 // 5 minutes
    ) {
      throw new Error('Invalid OAuth state or expired request');
    }

    // Exchange code for token with PKCE verifier
    const tokenResponse = await this._axios.post(authConfig.github.tokenUrl, {
      client_id: authConfig.github.clientId,
      code: response.code,
      code_verifier: storedData.verifier,
      redirect_uri: authConfig.github.redirectUri
    });

    const token: IToken = {
      ...tokenResponse.data,
      issuedAt: Math.floor(Date.now() / 1000)
    };

    await this.storeToken(token);
    this._storage.removeItem(authConfig.storage.stateKey);

    return token;
  }

  /**
   * Refreshes access token with rotation policy
   * @public
   * @returns Promise resolving to new token data
   */
  public async refreshToken(): Promise<IToken> {
    if (!this.checkRateLimit('token_refresh')) {
      throw new Error('Rate limit exceeded for token refresh');
    }

    const currentToken = await this.getStoredToken();
    if (!currentToken?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this._axios.post('/auth/refresh', {
      refresh_token: currentToken.refreshToken
    });

    const newToken: IToken = {
      ...response.data,
      issuedAt: Math.floor(Date.now() / 1000)
    };

    await this.storeToken(newToken);
    return newToken;
  }

  /**
   * Securely logs out user and cleans up stored data
   * @public
   */
  public async logout(): Promise<void> {
    try {
      const token = await this.getStoredToken();
      if (token) {
        await this._axios.post('/auth/logout', { token: token.accessToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Secure cleanup
      this._storage.removeItem(authConfig.storage.tokenKey);
      this._storage.removeItem(authConfig.storage.userKey);
      this._storage.removeItem(authConfig.storage.stateKey);
      this._rateLimiter.clear();
      this._sessionTracker.lastActivity = 0;
    }
  }

  /**
   * Retrieves current user data with validation
   * @public
   * @returns Promise resolving to current user data
   */
  public async getCurrentUser(): Promise<IUser> {
    if (!this.checkRateLimit('get_user')) {
      throw new Error('Rate limit exceeded for user data requests');
    }

    const token = await this.getStoredToken();
    if (!token || !validateTokenExpiry(token)) {
      throw new Error('No valid token available');
    }

    // Validate session activity
    if (
      Date.now() - this._sessionTracker.lastActivity >
      authConfig.storage.tokenExpiry * 1000
    ) {
      await this.logout();
      throw new Error('Session expired due to inactivity');
    }

    // Validate browser fingerprint
    if (this.generateBrowserFingerprint() !== this._sessionTracker.browserFingerprint) {
      await this.logout();
      throw new Error('Invalid session context');
    }

    const response = await this._axios.get('/auth/user');
    this._sessionTracker.lastActivity = Date.now();

    return response.data;
  }
}

// Export singleton instance
export default new AuthService();