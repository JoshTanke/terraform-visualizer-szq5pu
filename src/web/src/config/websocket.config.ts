// @ts-check
import { ManagerOptions } from 'socket.io-client'; // ^4.6.0

/**
 * WebSocket event types for code-related operations
 */
interface CodeEvents {
  update: 'code.update';
  validate: 'code.validate';
}

/**
 * WebSocket event types for graph-related operations
 */
interface GraphEvents {
  update: 'graph.update';
  layout: 'graph.layout';
}

/**
 * WebSocket event types for validation-related operations
 */
interface ValidationEvents {
  result: 'validation.result';
  error: 'validation.error';
}

/**
 * WebSocket event types for sync-related operations
 */
interface SyncEvents {
  status: 'sync.status';
  error: 'sync.error';
}

/**
 * Aggregated WebSocket event types
 */
export interface WebSocketEvents {
  code: CodeEvents;
  graph: GraphEvents;
  validation: ValidationEvents;
  sync: SyncEvents;
}

/**
 * Configuration for WebSocket reconnection strategy
 */
interface ReconnectConfig {
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
}

/**
 * Complete WebSocket configuration interface
 */
export interface WebSocketConfig {
  url: string;
  options: ManagerOptions;
  events: WebSocketEvents;
  reconnect: ReconnectConfig;
}

// Environment-specific configurations
const configurations: Record<string, WebSocketConfig> = {
  development: {
    url: 'ws://localhost:3001/ws',
    options: {
      autoConnect: true,
      reconnection: true,
      timeout: 5000,
      transports: ['websocket'],
      path: '/ws'
    },
    events: {
      code: {
        update: 'code.update',
        validate: 'code.validate'
      },
      graph: {
        update: 'graph.update',
        layout: 'graph.layout'
      },
      validation: {
        result: 'validation.result',
        error: 'validation.error'
      },
      sync: {
        status: 'sync.status',
        error: 'sync.error'
      }
    },
    reconnect: {
      maxAttempts: 5,
      delay: 1000,
      backoffMultiplier: 1.5
    }
  },
  production: {
    url: 'wss://api.example.com/ws',
    options: {
      autoConnect: true,
      reconnection: true,
      timeout: 3000,
      transports: ['websocket'],
      path: '/ws'
    },
    events: {
      code: {
        update: 'code.update',
        validate: 'code.validate'
      },
      graph: {
        update: 'graph.update',
        layout: 'graph.layout'
      },
      validation: {
        result: 'validation.result',
        error: 'validation.error'
      },
      sync: {
        status: 'sync.status',
        error: 'sync.error'
      }
    },
    reconnect: {
      maxAttempts: 10,
      delay: 1000,
      backoffMultiplier: 2
    }
  }
};

/**
 * Environment variables with fallbacks
 */
const WEBSOCKET_URL = process.env.VITE_WEBSOCKET_URL || 'ws://localhost:3001/ws';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Retrieves environment-specific WebSocket configuration with enhanced type safety and validation
 * @returns {WebSocketConfig} Environment-specific WebSocket configuration object
 * @throws {Error} If configuration validation fails
 */
const getWebSocketConfig = (): WebSocketConfig => {
  // Get base configuration for current environment
  const baseConfig = configurations[NODE_ENV] || configurations.development;

  // Override URL if provided through environment variable
  const config: WebSocketConfig = {
    ...baseConfig,
    url: WEBSOCKET_URL
  };

  // Validate configuration
  if (!config.url || !config.options || !config.events || !config.reconnect) {
    throw new Error('Invalid WebSocket configuration: missing required fields');
  }

  // Validate reconnection configuration
  if (
    config.reconnect.maxAttempts <= 0 ||
    config.reconnect.delay <= 0 ||
    config.reconnect.backoffMultiplier <= 0
  ) {
    throw new Error('Invalid reconnection configuration: values must be positive');
  }

  return config;
};

/**
 * Exported WebSocket configuration
 * @type {WebSocketConfig}
 */
export const websocketConfig: WebSocketConfig = getWebSocketConfig();

/**
 * Export individual configuration properties for convenience
 */
export const {
  url,
  options,
  events,
  reconnect
} = websocketConfig;