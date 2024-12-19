// @ts-nocheck
import dotenv from 'dotenv'; // ^16.0.0
import { ConnectOptions, ConnectionStates } from 'mongoose'; // ^6.0.0

// Load environment variables
dotenv.config();

// Global configuration constants
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/terraform-visualizer';
const MONGODB_USER = process.env.MONGODB_USER;
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_SSL_CA = process.env.MONGODB_SSL_CA;
const MONGODB_REPLICA_SET = process.env.MONGODB_REPLICA_SET || 'rs0';

/**
 * Validates MongoDB URI format
 * @param uri MongoDB connection URI
 * @returns boolean
 */
const isValidMongoUri = (uri: string): boolean => {
    const mongoUriPattern = /^mongodb(\+srv)?:\/\/.+/;
    return mongoUriPattern.test(uri);
};

/**
 * Validates the database configuration settings based on environment and security requirements
 * @throws Error if configuration is invalid
 * @returns boolean
 */
export const validateDatabaseConfig = (): boolean => {
    // Validate MongoDB URI
    if (!MONGODB_URI || !isValidMongoUri(MONGODB_URI)) {
        throw new Error('Invalid or missing MongoDB URI configuration');
    }

    // Validate credentials for non-development environments
    if (NODE_ENV !== 'development') {
        if (!MONGODB_USER || !MONGODB_PASSWORD) {
            throw new Error('MongoDB credentials are required for non-development environments');
        }
    }

    // Validate SSL configuration for production
    if (NODE_ENV === 'production' && !MONGODB_SSL_CA) {
        throw new Error('SSL certificate configuration is required for production environment');
    }

    // Validate replica set configuration
    if (NODE_ENV !== 'development' && !MONGODB_REPLICA_SET) {
        throw new Error('Replica set configuration is required for non-development environments');
    }

    return true;
};

/**
 * Returns environment-specific MongoDB connection options
 * @param environment Current environment (development, staging, production)
 * @returns ConnectOptions
 */
export const getEnvironmentSpecificOptions = (environment: string): ConnectOptions => {
    // Base configuration options
    const baseOptions: ConnectOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        retryWrites: true,
        w: 'majority',
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
        ssl: true,
        authSource: 'admin',
        replicaSet: MONGODB_REPLICA_SET,
        readPreference: 'primaryPreferred',
        connectTimeoutMS: 30000,
        heartbeatFrequencyMS: 10000,
        retryReads: true,
        compression: ['snappy', 'zlib'],
        autoIndex: false,
        maxStalenessSeconds: 120,
        loggerLevel: 'warn',
        validateOptions: true,
    };

    // Environment-specific configurations
    const environmentConfigs: { [key: string]: Partial<ConnectOptions> } = {
        development: {
            ssl: false,
            maxPoolSize: 5,
            autoIndex: true,
            loggerLevel: 'debug',
        },
        staging: {
            maxPoolSize: 7,
            loggerLevel: 'info',
        },
        production: {
            maxPoolSize: 10,
            ssl: true,
            sslCA: MONGODB_SSL_CA,
            loggerLevel: 'warn',
            autoIndex: false,
        },
    };

    return {
        ...baseOptions,
        ...(environmentConfigs[environment] || {}),
    };
};

/**
 * Database configuration object with environment-aware settings
 */
export const databaseConfig = {
    uri: MONGODB_URI,
    options: getEnvironmentSpecificOptions(NODE_ENV),
    validateDatabaseConfig,
    getEnvironmentSpecificOptions,
};

/**
 * Connection state type definition
 */
export type DatabaseConnectionState = keyof typeof ConnectionStates;

// Export default configuration
export default databaseConfig;