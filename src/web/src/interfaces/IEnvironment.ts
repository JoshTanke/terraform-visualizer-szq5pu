/**
 * @fileoverview Interface definition for environment entities in the Terraform visualization tool.
 * Supports the three-tier visualization hierarchy and real-time environment management.
 * @version 1.0.0
 */

import { IModule } from './IModule';

/**
 * Enumeration of possible environment states for real-time status tracking.
 * Used to indicate the current operational state of an environment.
 */
export enum EnvironmentStatus {
    ACTIVE = 'ACTIVE',     // Environment is operational and healthy
    INACTIVE = 'INACTIVE', // Environment is disabled or dormant
    ERROR = 'ERROR',       // Environment has configuration or operational errors
    UPDATING = 'UPDATING'  // Environment is currently being modified
}

/**
 * Interface representing a deployment environment containing Terraform modules
 * and their configurations. Supports visualization and real-time management capabilities.
 * 
 * @interface IEnvironment
 * @property {string} id - Unique identifier for the environment
 * @property {string} projectId - Reference to the parent project
 * @property {string} name - Environment name (e.g., 'development', 'staging', 'production')
 * @property {string | undefined} description - Optional human-readable environment description
 * @property {Record<string, any>} configuration - Environment-level configuration settings
 * @property {Record<string, any>} variables - Environment-scoped variables
 * @property {IModule[]} modules - Array of Terraform modules in this environment
 * @property {EnvironmentStatus} status - Current operational status
 * @property {string} version - Environment version identifier
 * @property {Date} created - Environment creation timestamp
 * @property {Date} updated - Last modification timestamp
 */
export interface IEnvironment {
    // Core Identity Properties
    id: string;
    projectId: string;
    name: string;
    description?: string;

    // Environment Configuration
    configuration: Record<string, any>;
    variables: Record<string, any>;
    modules: IModule[];

    // Status and Versioning
    status: EnvironmentStatus;
    version: string;

    // Metadata
    created: Date;
    updated: Date;
}

/**
 * Type guard to check if an object is a valid IEnvironment
 * @param obj - Object to validate
 * @returns {boolean} True if object conforms to IEnvironment interface
 */
export function isIEnvironment(obj: any): obj is IEnvironment {
    return (
        typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.projectId === 'string' &&
        typeof obj.name === 'string' &&
        (obj.description === undefined || typeof obj.description === 'string') &&
        typeof obj.configuration === 'object' &&
        typeof obj.variables === 'object' &&
        Array.isArray(obj.modules) &&
        obj.modules.every((module: any) => typeof module === 'object') &&
        Object.values(EnvironmentStatus).includes(obj.status) &&
        typeof obj.version === 'string' &&
        obj.created instanceof Date &&
        obj.updated instanceof Date
    );
}

/**
 * Creates a default empty environment structure
 * @param projectId - ID of the parent project
 * @returns {IEnvironment} A new environment instance with default values
 */
export function createEmptyEnvironment(projectId: string): IEnvironment {
    return {
        id: '',
        projectId,
        name: '',
        description: undefined,
        configuration: {},
        variables: {},
        modules: [],
        status: EnvironmentStatus.INACTIVE,
        version: '1.0.0',
        created: new Date(),
        updated: new Date()
    };
}