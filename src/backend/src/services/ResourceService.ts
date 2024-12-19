// External dependencies
import { Types } from 'mongoose'; // v6.0.0
import NodeCache from 'node-cache'; // v5.1.2

// Internal dependencies
import { IResource } from '../../interfaces/IResource';
import { Resource } from '../db/models/Resource';
import { NotFoundError, ValidationError } from '../utils/errors';
import { validateSchema, RESOURCE_SCHEMA } from '../utils/validation';
import { Logger } from '../utils/logger';

/**
 * Thread-safe singleton service class implementing comprehensive business logic
 * for managing Terraform resources with caching and performance optimizations.
 */
export class ResourceService {
  private static instance: ResourceService;
  private readonly cache: NodeCache;
  private readonly logger: Logger;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly BATCH_SIZE = 100;

  /**
   * Private constructor implementing singleton pattern with cache and logger initialization
   */
  private constructor() {
    this.cache = new NodeCache({
      stdTTL: this.CACHE_TTL,
      checkperiod: 60,
      useClones: false,
      maxKeys: 1000
    });

    this.logger = Logger.getInstance();
    this.setupCacheEvents();
  }

  /**
   * Thread-safe singleton instance getter using double-check locking pattern
   */
  public static getInstance(): ResourceService {
    if (!ResourceService.instance) {
      ResourceService.instance = new ResourceService();
    }
    return ResourceService.instance;
  }

  /**
   * Sets up cache event handlers for monitoring and error handling
   */
  private setupCacheEvents(): void {
    this.cache.on('expired', (key: string) => {
      this.logger.debug('Cache entry expired', { key });
    });

    this.cache.on('flush', () => {
      this.logger.info('Cache flushed');
    });
  }

  /**
   * Creates a new Terraform resource with validation and caching
   * @param resourceData Partial resource data to create
   * @returns Promise resolving to created resource
   * @throws ValidationError if data is invalid
   */
  public async createResource(resourceData: Partial<IResource>): Promise<IResource> {
    try {
      // Validate resource data against schema
      const validationResult = await validateSchema(resourceData, RESOURCE_SCHEMA);

      // Check for duplicate resources in the same module
      const existing = await Resource.findByTypeAndName(
        resourceData.moduleId!,
        resourceData.type!,
        resourceData.name!
      );

      if (existing) {
        throw new ValidationError(
          [{
            field: 'name',
            message: 'Resource with this name already exists in the module'
          }],
          'duplicate'
        );
      }

      // Create resource document
      const resource = await Resource.create({
        ...validationResult.data,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Update cache
      const cacheKey = this.getCacheKey(resource._id);
      this.cache.set(cacheKey, resource);

      this.logger.info('Resource created', {
        resourceId: resource._id,
        type: resource.type,
        name: resource.name
      });

      return resource;
    } catch (error) {
      this.logger.error('Failed to create resource', {
        error: error.message,
        data: resourceData
      });
      throw error;
    }
  }

  /**
   * Retrieves a resource by ID with caching
   * @param resourceId Resource ObjectId
   * @returns Promise resolving to resource or null
   */
  public async getResourceById(resourceId: Types.ObjectId): Promise<IResource | null> {
    const cacheKey = this.getCacheKey(resourceId);
    const cached = this.cache.get<IResource>(cacheKey);

    if (cached) {
      return cached;
    }

    const resource = await Resource.findById(resourceId).exec();
    
    if (resource) {
      this.cache.set(cacheKey, resource);
    }

    return resource;
  }

  /**
   * Retrieves all resources for a module with optimized batch loading
   * @param moduleId Module ObjectId
   * @returns Promise resolving to array of resources
   */
  public async getResourcesByModule(moduleId: Types.ObjectId): Promise<IResource[]> {
    const cacheKey = `module:${moduleId}:resources`;
    const cached = this.cache.get<IResource[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const resources = await Resource.findByModule(moduleId);
    this.cache.set(cacheKey, resources);

    return resources;
  }

  /**
   * Updates a resource with validation and cache management
   * @param resourceId Resource ObjectId
   * @param updateData Partial resource update data
   * @returns Promise resolving to updated resource
   * @throws NotFoundError if resource doesn't exist
   */
  public async updateResource(
    resourceId: Types.ObjectId,
    updateData: Partial<IResource>
  ): Promise<IResource> {
    try {
      // Validate update data
      await validateSchema(updateData, RESOURCE_SCHEMA.fork(
        Object.keys(updateData),
        (schema) => schema.optional()
      ));

      const resource = await Resource.findByIdAndUpdate(
        resourceId,
        {
          ...updateData,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!resource) {
        throw new NotFoundError('Resource not found');
      }

      // Update cache
      const cacheKey = this.getCacheKey(resourceId);
      this.cache.set(cacheKey, resource);

      // Invalidate module cache
      this.cache.del(`module:${resource.moduleId}:resources`);

      return resource;
    } catch (error) {
      this.logger.error('Failed to update resource', {
        resourceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Deletes a resource and updates caches
   * @param resourceId Resource ObjectId
   * @returns Promise resolving to deleted resource
   * @throws NotFoundError if resource doesn't exist
   */
  public async deleteResource(resourceId: Types.ObjectId): Promise<IResource> {
    const resource = await Resource.findByIdAndDelete(resourceId);

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    // Clear caches
    const cacheKey = this.getCacheKey(resourceId);
    this.cache.del(cacheKey);
    this.cache.del(`module:${resource.moduleId}:resources`);

    return resource;
  }

  /**
   * Updates resource position with optimistic concurrency control
   * @param resourceId Resource ObjectId
   * @param position New position coordinates
   * @returns Promise resolving to updated resource
   */
  public async updateResourcePosition(
    resourceId: Types.ObjectId,
    position: { x: number; y: number }
  ): Promise<IResource> {
    const resource = await Resource.updatePosition(resourceId, position);
    
    // Update cache
    const cacheKey = this.getCacheKey(resourceId);
    this.cache.set(cacheKey, resource);

    return resource;
  }

  /**
   * Performs bulk update of resources with optimized database operations
   * @param updates Array of resource updates
   * @returns Promise resolving to number of updated resources
   */
  public async bulkUpdateResources(
    updates: Array<{ id: Types.ObjectId; data: Partial<IResource> }>
  ): Promise<number> {
    try {
      let updatedCount = 0;
      
      // Process updates in batches
      for (let i = 0; i < updates.length; i += this.BATCH_SIZE) {
        const batch = updates.slice(i, i + this.BATCH_SIZE);
        const result = await Resource.bulkWrite(
          batch.map(update => ({
            updateOne: {
              filter: { _id: update.id },
              update: { ...update.data, updatedAt: new Date() },
              upsert: false
            }
          }))
        );
        updatedCount += result.modifiedCount;

        // Update cache for batch
        batch.forEach(update => {
          const cacheKey = this.getCacheKey(update.id);
          this.cache.del(cacheKey);
        });
      }

      return updatedCount;
    } catch (error) {
      this.logger.error('Bulk update failed', {
        error: error.message,
        updateCount: updates.length
      });
      throw error;
    }
  }

  /**
   * Generates a cache key for a resource
   * @param resourceId Resource ObjectId
   * @returns Cache key string
   */
  private getCacheKey(resourceId: Types.ObjectId): string {
    return `resource:${resourceId.toString()}`;
  }
}

// Export singleton instance
export default ResourceService.getInstance();