/**
 * @fileoverview Interface definition for Terraform resources, supporting both data model
 * requirements and graph visualization needs in the frontend application.
 * @version 1.0.0
 */

import { Types } from '@types/mongoose'; // v6.0.0 - MongoDB ObjectId type definitions

/**
 * Interface representing a Terraform resource with comprehensive metadata and visualization properties.
 * Supports full resource block functionality including count/forEach operations and graph rendering.
 * 
 * @interface IResource
 * @property {string} id - Unique identifier for the resource
 * @property {string} moduleId - Reference to the parent module
 * @property {string} type - Terraform resource type (e.g., 'aws_instance')
 * @property {string} name - Resource name identifier
 * @property {string} provider - Associated provider (e.g., 'aws', 'google')
 * @property {Record<string, any>} attributes - Key-value pairs of resource attributes
 * @property {string[]} dependencies - Array of resource IDs this resource depends on
 * @property {number | undefined} count - Optional numeric count for multiple instances
 * @property {Record<string, any> | undefined} forEach - Optional for_each map configuration
 * @property {{ x: number; y: number }} position - Coordinates for graph visualization
 * @property {boolean} selected - Selection state in the visualization
 * @property {string | undefined} icon - Optional resource type icon path
 * @property {string} createdAt - Resource creation timestamp
 * @property {string} updatedAt - Last modification timestamp
 */
export interface IResource {
    // Core Identity Properties
    id: string;
    moduleId: string;
    type: string;
    name: string;
    provider: string;

    // Resource Configuration
    attributes: Record<string, any>;
    dependencies: string[];
    count?: number;
    forEach?: Record<string, any>;

    // Visualization Properties
    position: {
        x: number;
        y: number;
    };
    selected: boolean;
    icon?: string;

    // Metadata
    createdAt: string;
    updatedAt: string;
}

/**
 * Type guard to check if an object is a valid IResource
 * @param obj - Object to validate
 * @returns {boolean} True if object conforms to IResource interface
 */
export function isIResource(obj: any): obj is IResource {
    return (
        typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.moduleId === 'string' &&
        typeof obj.type === 'string' &&
        typeof obj.name === 'string' &&
        typeof obj.provider === 'string' &&
        typeof obj.attributes === 'object' &&
        Array.isArray(obj.dependencies) &&
        (obj.count === undefined || typeof obj.count === 'number') &&
        (obj.forEach === undefined || typeof obj.forEach === 'object') &&
        typeof obj.position === 'object' &&
        typeof obj.position.x === 'number' &&
        typeof obj.position.y === 'number' &&
        typeof obj.selected === 'boolean' &&
        (obj.icon === undefined || typeof obj.icon === 'string') &&
        typeof obj.createdAt === 'string' &&
        typeof obj.updatedAt === 'string'
    );
}