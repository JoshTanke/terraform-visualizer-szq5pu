// @ts-check
import dotenv from 'dotenv'; // ^16.0.0 - Secure environment variable loading

// Initialize environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_CALLBACK_URL'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`${varName} environment variable is required`);
  }
});

/**
 * JWT Configuration
 * Defines secure JSON Web Token settings with enhanced claims and security measures
 */
export const jwt = {
  secret: process.env.JWT_SECRET!,
  expiresIn: process.env.JWT_EXPIRY || '1h',
  algorithm: 'HS256' as const,
  issuer: 'terraform-visualizer',
  audience: 'terraform-visualizer-api',
  clockTolerance: 30, // Seconds of clock drift allowed
  maxAge: '1h',
  clockTimestamp: Date.now(),
  jwtid: require('uuid').v4() // Unique identifier for JWT tokens
};

/**
 * GitHub OAuth Configuration
 * Settings for secure GitHub authentication integration
 */
export const github = {
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  callbackUrl: process.env.GITHUB_CALLBACK_URL!,
  scope: ['repo', 'read:user', 'user:email'] as const,
  userAgent: 'Terraform-Visualizer',
  allowSignup: false,
  proxySettings: null,
  enterpriseSettings: null
};

/**
 * Token Management Configuration
 * Defines secure token lifecycle and storage policies
 * Implements OWASP security best practices
 */
export const tokens = {
  access: {
    expiresIn: '1h',
    type: 'Bearer',
    storage: 'memory',
    renewThreshold: '15m' // Threshold for token renewal
  },
  refresh: {
    expiresIn: '30d',
    type: 'HttpOnly Cookie',
    storage: 'secure-cookie',
    sameSite: 'strict' as const,
    path: '/api/auth'
  }
};

/**
 * Security Headers and Policies
 * Implements recommended security headers and access control policies
 */
export const security = {
  headers: {
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    contentSecurityPolicy: "default-src 'self'",
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff'
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Maximum 100 requests per windowMs
  },
  cors: {
    origin: ['https://terraform-visualizer.com'],
    methods: ['GET', 'POST'] as const,
    credentials: true
  }
};

/**
 * Combined authentication configuration object
 * Exports comprehensive security and authentication settings
 */
const authConfig = {
  jwt,
  github,
  tokens,
  security
};

export default authConfig;

/**
 * Type definitions for configuration objects
 * Ensures type safety throughout the application
 */
export type JWTConfig = typeof jwt;
export type GitHubConfig = typeof github;
export type TokenConfig = typeof tokens;
export type SecurityConfig = typeof security;
export type AuthConfig = typeof authConfig;