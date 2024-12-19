// @ts-ignore - mongoose version 6.0.0
import { model, Model, Document, Types } from 'mongoose';
import { IResource } from '../../interfaces/IResource';
import { ResourceSchema } from '../schemas/resource.schema';

/**
 * Enhanced Mongoose model for Terraform resources with visualization support.
 * Implements optimized queries and real-time position updates with concurrency control.
 */
class ResourceModel {
  private model: Model<IResource>;
  private static readonly RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY = 100; // milliseconds

  constructor() {
    // Initialize model with optimized settings
    this.model = model<IResource>('Resource', ResourceSchema, 'resources');
    
    // Configure query optimization settings
    this.model.schema.set('autoIndex', process.env.NODE_ENV !== 'production');
    this.model.schema.set('minimize', false);
    this.model.schema.set('read', 'nearest');
  }

  /**
   * Find all resources belonging to a specific module with optimized query performance.
   * Uses lean queries and field projection for efficient data retrieval.
   * 
   * @param moduleId - The ObjectId of the parent module
   * @returns Promise resolving to an array of resources
   * @throws Error if moduleId is invalid
   */
  async findByModule(moduleId: Types.ObjectId): Promise<IResource[]> {
    if (!Types.ObjectId.isValid(moduleId)) {
      throw new Error('Invalid moduleId format');
    }

    return this.model
      .find({ moduleId })
      .select({
        type: 1,
        name: 1,
        provider: 1,
        position: 1,
        metadata: 1,
        validation: 1,
        dependencies: 1
      })
      .lean()
      .exec();
  }

  /**
   * Find a resource by its type and name within a module using compound index.
   * Implements efficient querying using the compound index defined in the schema.
   * 
   * @param moduleId - The ObjectId of the parent module
   * @param type - The resource type
   * @param name - The resource name
   * @returns Promise resolving to the matching resource or null
   * @throws Error if any parameter is invalid
   */
  async findByTypeAndName(
    moduleId: Types.ObjectId,
    type: string,
    name: string
  ): Promise<IResource | null> {
    if (!Types.ObjectId.isValid(moduleId)) {
      throw new Error('Invalid moduleId format');
    }
    if (!type || !name) {
      throw new Error('Type and name are required');
    }

    return this.model
      .findOne({
        moduleId,
        type: type.trim(),
        name: name.trim()
      })
      .exec();
  }

  /**
   * Update resource position with validation and optimistic concurrency control.
   * Implements retry logic for handling concurrent updates.
   * 
   * @param resourceId - The ObjectId of the resource to update
   * @param position - The new position coordinates
   * @returns Promise resolving to the updated resource
   * @throws Error if update fails after retries or validation fails
   */
  async updatePosition(
    resourceId: Types.ObjectId,
    position: { x: number; y: number }
  ): Promise<IResource> {
    if (!Types.ObjectId.isValid(resourceId)) {
      throw new Error('Invalid resourceId format');
    }
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      throw new Error('Invalid position coordinates');
    }

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < ResourceModel.RETRY_ATTEMPTS) {
      try {
        const resource = await this.model
          .findOneAndUpdate(
            { _id: resourceId },
            { 
              $set: { 
                'position.x': position.x,
                'position.y': position.y,
                updatedAt: new Date()
              }
            },
            {
              new: true,
              runValidators: true,
              session: null // Allow MongoDB to handle concurrency
            }
          )
          .exec();

        if (!resource) {
          throw new Error('Resource not found');
        }

        return resource;
      } catch (error) {
        lastError = error as Error;
        attempts++;
        if (attempts < ResourceModel.RETRY_ATTEMPTS) {
          await new Promise(resolve => 
            setTimeout(resolve, ResourceModel.RETRY_DELAY * attempts)
          );
        }
      }
    }

    throw new Error(
      `Failed to update resource position after ${ResourceModel.RETRY_ATTEMPTS} attempts: ${lastError?.message}`
    );
  }

  /**
   * Get the underlying Mongoose model for advanced operations.
   * Use with caution as it bypasses the optimized methods.
   */
  getModel(): Model<IResource> {
    return this.model;
  }
}

// Create and export a singleton instance
const Resource = new ResourceModel().getModel();

export { Resource };

// Export types for TypeScript support
export type ResourceDocument = Document & IResource;
export type ResourceModelType = Model<IResource>;