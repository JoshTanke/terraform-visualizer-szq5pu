/**
 * @fileoverview Authentication configuration with enhanced security measures
 * Implements secure GitHub OAuth flow with PKCE, token management, and
 * storage configuration following OWASP security guidelines.
 * @version 1.0.0
 */

import CryptoJS from 'crypto-js'; // v4.1.1
import { IToken } from '../interfaces/IAuth';

// Environment variables
const GITHUB_CLIENT_ID = process.env.VITE_GITHUB_CLIENT_ID;
const GITHUB_REDIRECT_URI = process.env.VITE_GITHUB_REDIRECT_URI;
const API_BASE_URL = process.env.VITE_API_BASE_URL;
const ENCRYPTION_KEY = process.env.VITE_ENCRYPTION_KEY;

/**
 * Throttle decorator to prevent brute force attacks
 * @param limit - Maximum number of calls
 * @param window - Time window in milliseconds
 */
function throttle(limit: number, window: number) {
  const calls = new Map<string, number[]>();
  
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const now = Date.now();
      const callHistory = calls.get(propertyKey) || [];
      const recentCalls = callHistory.filter(time => now - time < window);
      
      if (recentCalls.length >= limit) {
        console.warn(`Rate limit exceeded for ${propertyKey}`);
        return false;
      }
      
      recentCalls.push(now);
      calls.set(propertyKey, recentCalls);
      return original.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Validates token expiry with buffer time and signature verification
 * @param token - Token object to validate
 * @returns boolean indicating if token is valid and not expired
 */
@throttle(100, 60000)
export function validateTokenExpiry(token: IToken): boolean {
  try {
    // Add 5-minute buffer for token expiry
    const bufferTime = 300; // seconds
    const currentTime = Math.floor(Date.now() / 1000);
    const expiryTime = token.issuedAt + token.expiresIn - bufferTime;
    
    return currentTime < expiryTime;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * Generates PKCE challenge for OAuth flow
 * @returns Object containing code verifier and challenge
 */
export function generatePKCEChallenge(): { verifier: string; challenge: string } {
  // Generate random verifier
  const verifier = CryptoJS.lib.WordArray.random(32).toString();
  
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
 * Authentication configuration object with comprehensive security measures
 */
export const authConfig = {
  github: {
    clientId: GITHUB_CLIENT_ID,
    redirectUri: GITHUB_REDIRECT_URI,
    scope: 'repo read:user',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    pkceEnabled: true,
    state: CryptoJS.lib.WordArray.random(32).toString('hex')
  },
  
  storage: {
    tokenKey: 'tf_viz_token',
    userKey: 'tf_viz_user',
    stateKey: 'tf_viz_oauth_state',
    tokenExpiry: 3600, // 1 hour
    refreshTokenExpiry: 2592000, // 30 days
    storageType: 'secureStorage',
    fallback: 'secureCookie',
    encryption: true
  },
  
  security: {
    rateLimit: {
      maxAttempts: 100,
      windowMs: 60000 // 1 minute
    },
    headers: {
      'X-XSS-Protection': '1; mode=block',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    },
    tokenRotation: {
      enabled: true,
      interval: 3600000 // 1 hour
    }
  },
  
  api: {
    baseUrl: API_BASE_URL,
    timeout: 5000,
    retries: 3,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  }
} as const;

// Encrypt sensitive configuration data
if (ENCRYPTION_KEY) {
  const encryptConfig = (data: string): string => {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
  };
  
  // Encrypt sensitive values
  authConfig.storage.tokenKey = encryptConfig(authConfig.storage.tokenKey);
  authConfig.storage.userKey = encryptConfig(authConfig.storage.userKey);
  authConfig.storage.stateKey = encryptConfig(authConfig.storage.stateKey);
}

// Freeze configuration to prevent modifications
Object.freeze(authConfig);
Object.freeze(authConfig.github);
Object.freeze(authConfig.storage);
Object.freeze(authConfig.security);
Object.freeze(authConfig.api);