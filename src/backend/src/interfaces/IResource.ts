// @ts-ignore - mongoose version 6.0.0
import { Types } from 'mongoose';

/**
 * Interface defining the structure of a Terraform resource entity.
 * Represents infrastructure resources parsed from Terraform configurations
 * with support for graph visualization, meta-arguments, and MongoDB document structure.
 */
export interface IResource {
  /**
   * MongoDB document identifier
   */
  _id: Types.ObjectId;

  /**
   * Reference to the parent module containing this resource
   */
  moduleId: Types.ObjectId;

  /**
   * Terraform resource type (e.g., 'aws_instance', 'azurerm_virtual_machine')
   */
  type: string;

  /**
   * Resource name/identifier within the Terraform configuration
   */
  name: string;

  /**
   * Provider namespace for the resource (e.g., 'aws', 'azurerm')
   */
  provider: string;

  /**
   * Key-value map of resource attributes from the Terraform configuration
   */
  attributes: Record<string, unknown>;

  /**
   * Array of resource IDs that this resource depends on
   */
  dependencies: Types.ObjectId[];

  /**
   * Optional count meta-argument for creating multiple instances
   */
  count?: number;

  /**
   * Optional for_each meta-argument for creating multiple instances with unique configurations
   */
  forEach?: Record<string, unknown>;

  /**
   * Graph visualization positioning data
   */
  position: {
    /** X coordinate in the visualization canvas */
    x: number;
    /** Y coordinate in the visualization canvas */
    y: number;
    /** Optional width of the node in pixels */
    width?: number;
    /** Optional height of the node in pixels */
    height?: number;
  };

  /**
   * Additional metadata for enhanced visualization and documentation
   */
  metadata: {
    /** Optional resource type icon URL or identifier */
    icon?: string;
    /** Optional color code for node visualization */
    color?: string;
    /** Optional resource description or documentation */
    description?: string;
  };

  /**
   * Validation status and details
   */
  validation: {
    /** Indicates if the resource configuration is valid */
    isValid: boolean;
    /** Optional array of validation error messages */
    errors?: string[];
    /** Optional array of validation warning messages */
    warnings?: string[];
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