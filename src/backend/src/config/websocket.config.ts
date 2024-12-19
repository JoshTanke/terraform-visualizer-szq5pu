// External dependencies
import { WebSocket } from 'ws'; // v8.13.0

// Internal dependencies
import { Logger } from '../utils/logger';

// Get logger instance
const logger = Logger.getInstance();

// Environment variable
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * WebSocket security configuration interface
 */
interface WebSocketSecurityConfig {
  maxConnectionsPerIp: number;
  rateLimit: number;
  authTimeout: number;
  allowedOrigins: string[];
}

/**
 * WebSocket performance configuration interface
 */
interface WebSocketPerformanceConfig {
  compression: boolean;
  compressionLevel: number;
  bufferSize: number;
  batchingEnabled: boolean;
  batchTimeout: number;
}

/**
 * WebSocket monitoring configuration interface
 */
interface WebSocketMonitoringConfig {
  metricsEnabled: boolean;
  logLevel: string;
  connectionTracking: boolean;
}

/**
 * WebSocket cluster configuration interface
 */
interface WebSocketClusterConfig {
  enabled: boolean;
  sticky: boolean;
  migrationTimeout: number;
}

/**
 * Main WebSocket configuration interface
 */
interface WebSocketConfig {
  port: number;
  path: string;
  maxConnections: number;
  heartbeatInterval: number;
  reconnectTimeout: number;
  updateDebounceTime: number;
  maxPayloadSize: number;
  security: WebSocketSecurityConfig;
  performance: WebSocketPerformanceConfig;
  monitoring: WebSocketMonitoringConfig;
  clustering: WebSocketClusterConfig;
}

/**
 * Configuration validation decorator
 */
function validateConfig(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = function(...args: any[]) {
    const config: WebSocketConfig = originalMethod.apply(this, args);

    // Validate required fields
    if (!config.port || !config.path) {
      throw new Error('Required WebSocket configuration fields missing');
    }

    // Validate numeric ranges
    if (config.port < 1 || config.port > 65535) {
      throw new Error('Invalid port number');
    }

    if (config.maxPayloadSize < 0) {
      throw new Error('Invalid maxPayloadSize');
    }

    // Validate intervals
    if (config.heartbeatInterval < 1000) {
      throw new Error('Heartbeat interval too low');
    }

    // Validate security settings
    if (config.security.maxConnectionsPerIp < 1) {
      throw new Error('Invalid maxConnectionsPerIp');
    }

    return config;
  };

  return descriptor;
}

/**
 * Environment-specific configurations
 */
const configurations: Record<string, WebSocketConfig> = {
  development: {
    port: 3001,
    path: '/ws',
    maxConnections: 100,
    heartbeatInterval: 30000,
    reconnectTimeout: 5000,
    updateDebounceTime: 500,
    maxPayloadSize: 1048576, // 1MB
    security: {
      maxConnectionsPerIp: 5,
      rateLimit: 100,
      authTimeout: 5000,
      allowedOrigins: ['localhost']
    },
    performance: {
      compression: true,
      compressionLevel: 6,
      bufferSize: 65536, // 64KB
      batchingEnabled: true,
      batchTimeout: 50
    },
    monitoring: {
      metricsEnabled: true,
      logLevel: 'debug',
      connectionTracking: true
    },
    clustering: {
      enabled: false,
      sticky: true,
      migrationTimeout: 5000
    }
  },
  production: {
    port: 443,
    path: '/ws',
    maxConnections: 1000,
    heartbeatInterval: 30000,
    reconnectTimeout: 3000,
    updateDebounceTime: 500,
    maxPayloadSize: 1048576, // 1MB
    security: {
      maxConnectionsPerIp: 20,
      rateLimit: 500,
      authTimeout: 3000,
      allowedOrigins: ['*.domain.com']
    },
    performance: {
      compression: true,
      compressionLevel: 4,
      bufferSize: 131072, // 128KB
      batchingEnabled: true,
      batchTimeout: 100
    },
    monitoring: {
      metricsEnabled: true,
      logLevel: 'info',
      connectionTracking: true
    },
    clustering: {
      enabled: true,
      sticky: true,
      migrationTimeout: 3000
    }
  }
};

/**
 * Retrieves environment-specific WebSocket configuration with validation
 * @returns {WebSocketConfig} Validated WebSocket configuration object
 */
@validateConfig
function getWebSocketConfig(): WebSocketConfig {
  try {
    logger.debug(`Loading WebSocket configuration for environment: ${NODE_ENV}`);

    // Get environment-specific configuration
    const config = configurations[NODE_ENV];

    if (!config) {
      logger.error(`No configuration found for environment: ${NODE_ENV}`);
      throw new Error(`Invalid environment: ${NODE_ENV}`);
    }

    logger.info('WebSocket configuration loaded successfully');
    return config;
  } catch (error) {
    logger.error('Failed to load WebSocket configuration', { error: error.message });
    throw error;
  }
}

// Export the configuration
export const websocketConfig = getWebSocketConfig();

// Export individual configuration properties for selective imports
export const {
  port,
  path,
  maxConnections,
  heartbeatInterval,
  reconnectTimeout,
  updateDebounceTime,
  maxPayloadSize,
  security,
  performance,
  monitoring,
  clustering
} = websocketConfig;