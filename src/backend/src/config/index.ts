// External dependencies
import dotenv from 'dotenv'; // ^16.0.0 - Environment variable management

// Internal imports
import { authConfig, jwt, github, tokens } from './auth.config';
import { cacheConfig } from './cache.config';
import { databaseConfig } from './database.config';
import { githubConfig } from './github.config';
import { PARSER_CONFIG } from './parser.config';
import { websocketConfig } from './websocket.config';
import Logger from '../utils/logger';

// Initialize environment variables
dotenv.config();

// Initialize logger
const logger = Logger.getInstance();

// Global environment variable
export const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Interface for validation results
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  metadata: {
    timestamp: Date;
    environment: string;
    configVersion: string;
  };
}

/**
 * Interface for configuration manager
 */
interface ConfigurationManager {
  auth: typeof authConfig;
  cache: typeof cacheConfig;
  database: typeof databaseConfig;
  github: typeof githubConfig;
  parser: typeof PARSER_CONFIG;
  websocket: typeof websocketConfig;
  validateConfigurations: () => Promise<ValidationResult>;
  reloadConfiguration: () => Promise<void>;
  getConfigurationVersion: () => string;
  getAuditLog: () => Promise<any[]>;
}

/**
 * Configuration version management
 */
const CONFIG_VERSION = '1.0.0';
const configAuditLog: any[] = [];

/**
 * @configValidator
 * @performanceMonitor
 * Validates all configuration settings and their dependencies
 * @returns {Promise<ValidationResult>} Validation results with metadata
 */
async function validateConfigurations(): Promise<ValidationResult> {
  const errors: string[] = [];
  logger.debug('Starting configuration validation');

  try {
    // Validate environment variables
    if (!process.env.NODE_ENV) {
      errors.push('NODE_ENV environment variable is required');
    }

    // Validate authentication configuration
    if (!jwt.secret || !github.clientId || !github.clientSecret) {
      errors.push('Invalid authentication configuration');
    }

    // Validate cache configuration
    const cacheValidation = cacheConfig.validateCacheConfig(cacheConfig.redis);
    if (!cacheValidation.isValid) {
      errors.push(...cacheValidation.errors);
    }

    // Validate database configuration
    try {
      databaseConfig.validateDatabaseConfig();
    } catch (error) {
      errors.push(`Database configuration error: ${error.message}`);
    }

    // Validate GitHub integration settings
    try {
      githubConfig.validateConfig();
    } catch (error) {
      errors.push(`GitHub configuration error: ${error.message}`);
    }

    // Validate parser configuration
    if (!PARSER_CONFIG.validateParserConfig(PARSER_CONFIG)) {
      errors.push('Invalid parser configuration');
    }

    // Log validation results
    const validationResult: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      metadata: {
        timestamp: new Date(),
        environment: NODE_ENV,
        configVersion: CONFIG_VERSION
      }
    };

    // Add to audit log
    configAuditLog.push({
      ...validationResult,
      timestamp: new Date()
    });

    logger.info('Configuration validation completed', validationResult);
    return validationResult;

  } catch (error) {
    logger.error('Configuration validation failed', { error: error.message });
    throw error;
  }
}

/**
 * Reloads configuration settings with hot-reload support
 */
async function reloadConfiguration(): Promise<void> {
  logger.info('Initiating configuration reload');
  
  try {
    // Reload environment variables
    dotenv.config();

    // Validate new configuration
    const validationResult = await validateConfigurations();
    
    if (!validationResult.isValid) {
      throw new Error(`Configuration reload failed: ${validationResult.errors.join(', ')}`);
    }

    logger.info('Configuration reloaded successfully');
  } catch (error) {
    logger.error('Configuration reload failed', { error: error.message });
    throw error;
  }
}

/**
 * Returns the current configuration version
 */
function getConfigurationVersion(): string {
  return CONFIG_VERSION;
}

/**
 * Returns the configuration audit log
 */
async function getAuditLog(): Promise<any[]> {
  return configAuditLog;
}

/**
 * Central configuration manager with comprehensive settings and validation
 */
export const config: ConfigurationManager = {
  auth: authConfig,
  cache: cacheConfig,
  database: databaseConfig,
  github: githubConfig,
  parser: PARSER_CONFIG,
  websocket: websocketConfig,
  validateConfigurations,
  reloadConfiguration,
  getConfigurationVersion,
  getAuditLog
};

// Perform initial configuration validation
validateConfigurations().catch(error => {
  logger.error('Initial configuration validation failed', { error: error.message });
  process.exit(1);
});

// Export default configuration
export default config;

// Type exports for better type safety
export type { ValidationResult, ConfigurationManager };