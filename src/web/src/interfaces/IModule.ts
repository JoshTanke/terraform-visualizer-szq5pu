/**
 * @fileoverview Interface definition for Terraform modules, supporting visualization
 * and interaction requirements in the frontend application.
 * @version 1.0.0
 */

import { IResource } from './IResource';
import { Position } from '@types/react-flow-renderer'; // v11.x

/**
 * Enumeration of possible module validation states.
 * Used to indicate the current status of a module's configuration and resources.
 */
export enum ModuleStatus {
    VALID = 'VALID',
    WARNING = 'WARNING',
    ERROR = 'ERROR',
    LOADING = 'LOADING'
}

/**
 * Interface representing a Terraform module with its properties, resources,
 * variables, and outputs for frontend visualization and interaction.
 * 
 * @interface IModule
 * @property {string} id - Unique identifier for the module
 * @property {string} environmentId - Reference to the parent environment
 * @property {string} name - Module name identifier
 * @property {string} source - Module source location (e.g., Git repository, Terraform Registry)
 * @property {string} version - Module version specification
 * @property {string} description - Human-readable module description
 * @property {Record<string, any>} configuration - Module-level configuration settings
 * @property {IResource[]} resources - Array of resources contained within the module
 * @property {Record<string, any>} variables - Input variables defined for the module
 * @property {Record<string, any>} outputs - Output values exposed by the module
 * @property {{ x: number; y: number }} position - Coordinates for graph visualization
 * @property {ModuleStatus} status - Current validation status of the module
 */
export interface IModule {
    // Core Identity Properties
    id: string;
    environmentId: string;
    name: string;
    source: string;
    version: string;
    description: string;

    // Module Configuration
    configuration: Record<string, any>;
    resources: IResource[];
    variables: Record<string, any>;
    outputs: Record<string, any>;

    // Visualization Properties
    position: {
        x: number;
        y: number;
    };
    status: ModuleStatus;
}

/**
 * Type guard to check if an object is a valid IModule
 * @param obj - Object to validate
 * @returns {boolean} True if object conforms to IModule interface
 */
export function isIModule(obj: any): obj is IModule {
    return (
        typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.environmentId === 'string' &&
        typeof obj.name === 'string' &&
        typeof obj.source === 'string' &&
        typeof obj.version === 'string' &&
        typeof obj.description === 'string' &&
        typeof obj.configuration === 'object' &&
        Array.isArray(obj.resources) &&
        obj.resources.every((resource: any) => typeof resource === 'object') &&
        typeof obj.variables === 'object' &&
        typeof obj.outputs === 'object' &&
        typeof obj.position === 'object' &&
        typeof obj.position.x === 'number' &&
        typeof obj.position.y === 'number' &&
        Object.values(ModuleStatus).includes(obj.status)
    );
}

/**
 * Creates a default empty module structure
 * @param environmentId - ID of the parent environment
 * @returns {IModule} A new module instance with default values
 */
export function createEmptyModule(environmentId: string): IModule {
    return {
        id: '',
        environmentId,
        name: '',
        source: '',
        version: '',
        description: '',
        configuration: {},
        resources: [],
        variables: {},
        outputs: {},
        position: { x: 0, y: 0 },
        status: ModuleStatus.LOADING
    };
}