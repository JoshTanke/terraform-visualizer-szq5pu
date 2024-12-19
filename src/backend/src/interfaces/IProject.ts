// @version mongoose@6.0.0
import { Types } from 'mongoose';

/**
 * Enumeration defining the possible states of a Terraform project
 * Used to track project lifecycle and synchronization status
 */
export enum ProjectStatus {
    /** Project is active and available for visualization/editing */
    ACTIVE = 'ACTIVE',
    /** Project has been archived and is read-only */
    ARCHIVED = 'ARCHIVED',
    /** Project is currently synchronizing with GitHub */
    SYNCING = 'SYNCING',
    /** Project encountered an error during operation */
    ERROR = 'ERROR'
}

/**
 * Interface defining the complete structure of a Terraform project
 * Includes GitHub integration details, environment relationships, and audit information
 * 
 * @interface IProject
 */
export interface IProject {
    /** Unique identifier for the project */
    id: Types.ObjectId;

    /** Human-readable name of the project */
    name: string;

    /** Detailed description of the project's purpose */
    description: string;

    /** GitHub repository URL containing Terraform configurations */
    githubUrl: string;

    /** Target branch for GitHub integration */
    githubBranch: string;

    /** Encrypted GitHub access token for repository operations */
    githubToken: string;

    /** Array of associated environment ObjectIds */
    environmentIds: Types.ObjectId[];

    /** Timestamp of last successful GitHub synchronization */
    lastSyncedAt: Date | null;

    /** Timestamp of project creation */
    created: Date;

    /** Timestamp of last project update */
    updated: Date;

    /** Schema version for data migration support */
    version: number;

    /** Current operational status of the project */
    status: ProjectStatus;
}