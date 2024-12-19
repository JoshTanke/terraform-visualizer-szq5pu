/**
 * @fileoverview Authentication interfaces and types for the Terraform Visualization Tool
 * Defines comprehensive type definitions for authentication flow, token management,
 * and authorization levels supporting GitHub OAuth integration.
 */

/**
 * Enumeration of user authorization roles for role-based access control (RBAC).
 * Defines strictly typed access levels for system functionality.
 */
export enum UserRole {
  /** Read-only access to visualizations and code */
  VIEWER = 'VIEWER',
  /** Modify code, update visualizations */
  EDITOR = 'EDITOR',
  /** Full access, manage users, configure settings */
  ADMIN = 'ADMIN'
}

/**
 * Interface defining comprehensive user data structure with GitHub integration support.
 * Contains all essential user information and metadata.
 */
export interface IUser {
  /** Unique identifier for the user */
  id: string;
  /** User's display name or handle */
  username: string;
  /** User's email address */
  email: string;
  /** User's authorization role */
  role: UserRole;
  /** URL to user's avatar image */
  avatarUrl: string;
  /** GitHub user identifier */
  githubId: string;
  /** Timestamp of last login */
  lastLogin: Date;
  /** Flag indicating if the account is active */
  isActive: boolean;
}

/**
 * Interface defining secure token data structure with expiration handling.
 * Implements comprehensive token management for both JWT and OAuth tokens.
 */
export interface IToken {
  /** JWT or OAuth access token */
  accessToken: string;
  /** Token used for refreshing access */
  refreshToken: string;
  /** Token lifetime in seconds */
  expiresIn: number;
  /** Token type (e.g., 'Bearer') */
  tokenType: string;
  /** Array of granted permission scopes */
  scope: string[];
  /** Unix timestamp of token issuance */
  issuedAt: number;
}

/**
 * Interface defining comprehensive authentication state management structure.
 * Maintains complete authentication context including user data and session management.
 */
export interface IAuthState {
  /** Flag indicating if user is currently authenticated */
  isAuthenticated: boolean;
  /** Current user data or null if not authenticated */
  user: IUser | null;
  /** Current token data or null if not authenticated */
  token: IToken | null;
  /** Flag indicating if authentication operation is in progress */
  loading: boolean;
  /** Authentication error message or null if no error */
  error: string | null;
  /** Unix timestamp of last user activity */
  lastActivity: number;
  /** Unix timestamp when session will expire */
  sessionExpiry: number;
}

/**
 * Interface defining complete GitHub OAuth callback response structure.
 * Handles both successful authentication and error scenarios.
 */
export interface IGithubAuthResponse {
  /** OAuth authorization code */
  code: string;
  /** State parameter for CSRF protection */
  state: string;
  /** Space-separated list of granted scopes */
  scope: string;
  /** Error code if authentication failed */
  error: string | null;
  /** Detailed error description if authentication failed */
  error_description: string | null;
}