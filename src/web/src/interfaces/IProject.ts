/**
 * @fileoverview Interface definition for Terraform project entities, supporting GitHub integration,
 * environment relationships, and real-time sync status tracking in the frontend application.
 * @version 1.0.0
 */

import { IEnvironment } from './IEnvironment';

/**
 * Interface representing a Terraform project with comprehensive metadata, GitHub integration,
 * and environment relationships. Supports the three-tier visualization hierarchy and real-time
 * project state management.
 * 
 * @interface IProject
 * @property {string} id - Unique identifier for the project
 * @property {string} name - Project name identifier
 * @property {string} description - Human-readable project description
 * @property {string} githubUrl - GitHub repository URL for project source
 * @property {string} githubBranch - Active GitHub branch for the project
 * @property {IEnvironment[]} environments - Array of deployment environments
 * @property {Date | null} lastSyncedAt - Timestamp of last GitHub synchronization
 * @property {Date} created - Project creation timestamp
 * @property {Date} updated - Last modification timestamp
 */
export interface IProject {
    // Core Identity Properties
    id: string;
    name: string;
    description: string;

    // GitHub Integration Properties
    githubUrl: string;
    githubBranch: string;

    // Environment Relationships
    environments: IEnvironment[];

    // Sync Status
    lastSyncedAt: Date | null;

    // Metadata
    created: Date;
    updated: Date;
}

/**
 * Type guard to check if an object is a valid IProject
 * @param obj - Object to validate
 * @returns {boolean} True if object conforms to IProject interface
 */
export function isIProject(obj: any): obj is IProject {
    return (
        typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.name === 'string' &&
        typeof obj.description === 'string' &&
        typeof obj.githubUrl === 'string' &&
        typeof obj.githubBranch === 'string' &&
        Array.isArray(obj.environments) &&
        obj.environments.every((env: any) => typeof env === 'object') &&
        (obj.lastSyncedAt === null || obj.lastSyncedAt instanceof Date) &&
        obj.created instanceof Date &&
        obj.updated instanceof Date
    );
}

/**
 * Creates a default empty project structure
 * @returns {IProject} A new project instance with default values
 */
export function createEmptyProject(): IProject {
    return {
        id: '',
        name: '',
        description: '',
        githubUrl: '',
        githubBranch: 'main',
        environments: [],
        lastSyncedAt: null,
        created: new Date(),
        updated: new Date()
    };
}