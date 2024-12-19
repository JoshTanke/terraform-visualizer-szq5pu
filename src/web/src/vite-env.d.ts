/// <reference types="vite/client" /> // v4.3.9

/**
 * Type declaration for Vite environment variables used throughout the application.
 * These environment variables should be defined in the .env file and must be prefixed with VITE_
 * to be exposed to the client-side code.
 */
interface ImportMetaEnv {
  /**
   * Backend API base URL for all API communications
   * @example "http://localhost:3000/api"
   */
  readonly VITE_API_URL: string;

  /**
   * GitHub OAuth application client ID for authentication
   * @example "1234567890abcdef1234"
   */
  readonly VITE_GITHUB_CLIENT_ID: string;

  /**
   * OAuth callback URL for GitHub authentication flow
   * @example "http://localhost:3000/auth/callback"
   */
  readonly VITE_GITHUB_CALLBACK_URL: string;

  /**
   * WebSocket server base URL for real-time communications
   * @example "ws://localhost"
   */
  readonly VITE_WS_URL: string;

  /**
   * WebSocket server port for connection establishment
   * @example "8080"
   */
  readonly VITE_WS_PORT: string;
}

/**
 * Type declaration for Vite's import.meta object with environment access.
 * This interface extends the default ImportMeta interface to include our custom environment variables.
 */
interface ImportMeta {
  /**
   * Environment variables accessible through import.meta.env
   * All variables are made readonly to prevent accidental modification at runtime
   */
  readonly env: ImportMetaEnv;
}