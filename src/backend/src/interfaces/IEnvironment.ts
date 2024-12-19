// @ts-ignore - mongoose version 6.0.0
import { Types } from 'mongoose';
import { IModule } from './IModule';

/**
 * Interface defining the structure of an environment entity in the Terraform visualization system.
 * Represents a deployment context (e.g., development, staging, production) that contains
 * multiple Terraform modules and their configurations. Supports the three-tier visualization
 * hierarchy (Pipeline > Environment > Module) with comprehensive tracking capabilities.
 */
export interface IEnvironment {
  /**
   * MongoDB document identifier
   */
  _id: Types.ObjectId;

  /**
   * Reference to the parent project containing this environment
   */
  projectId: Types.ObjectId;

  /**
   * Environment name/identifier (e.g., 'development', 'staging', 'production')
   */
  name: string;

  /**
   * Human-readable description of the environment's purpose and characteristics
   */
  description: string;

  /**
   * Environment-specific configuration settings
   * Includes provider configurations, backend settings, and environment-level variables
   */
  configuration: Record<string, any>;

  /**
   * Array of Terraform modules deployed in this environment
   * Each module represents a reusable infrastructure component
   */
  modules: IModule[];

  /**
   * Environment-level variables that can be referenced by modules
   * Key-value map of variable names to their values and metadata
   */
  variables: Record<string, any>;

  /**
   * Semantic version identifier for the environment configuration
   * Follows SemVer format (MAJOR.MINOR.PATCH)
   */
  version: string;

  /**
   * Current status of the environment
   * Possible values: 'active', 'inactive', 'error', 'syncing'
   */
  status: string;

  /**
   * Timestamp of the last successful synchronization with version control
   */
  lastSync: Date;

  /**
   * Timestamp for document creation
   */
  created: Date;

  /**
   * Timestamp for last document update
   */
  updated: Date;
}