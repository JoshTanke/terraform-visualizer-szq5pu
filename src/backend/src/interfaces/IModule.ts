// @ts-ignore - mongoose version 6.0.0
import { Types } from 'mongoose';
import { IResource } from './IResource';

/**
 * Interface defining the structure of a Terraform module entity.
 * Represents a reusable infrastructure component containing resources, variables, and outputs,
 * with enhanced support for visualization, metadata, and database storage.
 */
export interface IModule {
  /**
   * MongoDB document identifier
   */
  _id: Types.ObjectId;

  /**
   * Reference to the parent environment containing this module
   */
  environmentId: Types.ObjectId;

  /**
   * Module name/identifier within the Terraform configuration
   */
  name: string;

  /**
   * Source location of the module (e.g., local path, Git URL, Terraform Registry)
   */
  source: string;

  /**
   * Module version identifier (semantic versioning)
   */
  version: string;

  /**
   * Human-readable description of the module's purpose and functionality
   */
  description: string;

  /**
   * Module-specific configuration settings and parameters
   * Includes provider configurations, backend settings, and other module-level options
   */
  configuration: Record<string, any>;

  /**
   * Array of resources contained within this module
   * Each resource represents an infrastructure component defined in the module
   */
  resources: IResource[];

  /**
   * Input variables defined for the module
   * Key-value map of variable names to their configurations including type, default, description
   */
  variables: Record<string, any>;

  /**
   * Output values exposed by the module
   * Key-value map of output names to their configurations including value, description, sensitive flag
   */
  outputs: Record<string, any>;

  /**
   * Graph visualization positioning data for the module node
   */
  position: {
    /** X coordinate in the visualization canvas */
    x: number;
    /** Y coordinate in the visualization canvas */
    y: number;
  };

  /**
   * Timestamp for document creation
   */
  createdAt: Date;

  /**
   * Timestamp for last document update
   */
  updatedAt: Date;
}