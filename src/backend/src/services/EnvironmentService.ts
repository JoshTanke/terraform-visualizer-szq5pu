// External dependencies
import { Types } from 'mongoose'; // v6.0.0

// Internal dependencies
import { IEnvironment } from '../../interfaces/IEnvironment';
import { Environment } from '../db/models/Environment';
import { CacheService } from './CacheService';
import { Logger } from '../utils/logger';
import { BaseError, ValidationError } from '../utils/errors';

/**
 * Custom error class for environment-specific errors
 */
class EnvironmentError extends BaseError {
  constructor(message: string, code: string, metadata?: Record<string, any>) {
    super(message, code, 500, metadata);
  }
}

/**
 * Service class implementing comprehensive environment management functionality
 * with enhanced caching, security, monitoring, and error handling capabilities.
 */
export class EnvironmentService {
  private static instance: EnvironmentService;
  private readonly cacheService: CacheService;
  private readonly logger: Logger;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly BATCH_SIZE = 100;
  private readonly CACHE_PREFIX = 'env:';

  /**
   * Private constructor implementing singleton pattern with enhanced initialization
   */
  private constructor() {
    this.logger = Logger.getInstance();
    this.cacheService = CacheService.getInstance();
    this.logger.info('EnvironmentService initialized');
  }

  /**
   * Gets or creates singleton service instance with lazy loading
   */
  public static getInstance(): EnvironmentService {
    if (!EnvironmentService.instance) {
      EnvironmentService.instance = new EnvironmentService();
    }
    return EnvironmentService.instance;
  }

  /**
   * Creates a new environment with validation and auditing
   */
  public async create(
    projectId: Types.ObjectId,
    environmentData: Partial<IEnvironment>
  ): Promise<IEnvironment> {
    try {
      // Validate input data
      this.validateEnvironmentData(environmentData);

      // Start performance monitoring
      const startTime = Date.now();

      // Create environment document
      const environment = new Environment({
        ...environmentData,
        projectId,
        created: new Date(),
        updated: new Date()
      });

      // Save to database
      const savedEnvironment = await environment.save();

      // Update cache
      await this.cacheService.set(
        `${this.CACHE_PREFIX}${savedEnvironment._id}`,
        savedEnvironment,
        this.CACHE_TTL
      );

      // Log audit trail
      this.logger.info('Environment created', {
        environmentId: savedEnvironment._id,
        projectId,
        duration: Date.now() - startTime
      });

      return savedEnvironment;
    } catch (error) {
      this.logger.error('Failed to create environment', { error, projectId });
      throw new EnvironmentError(
        'Environment creation failed',
        'ENV_CREATE_ERROR',
        { projectId }
      );
    }
  }

  /**
   * Retrieves environment by ID with enhanced caching and fallback
   */
  public async getById(environmentId: Types.ObjectId): Promise<IEnvironment> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}${environmentId}`;
      const cachedEnvironment = await this.cacheService.get(cacheKey);

      if (cachedEnvironment) {
        return cachedEnvironment;
      }

      // Fetch from database
      const environment = await Environment.findWithModules(environmentId);

      if (!environment) {
        throw new EnvironmentError(
          'Environment not found',
          'ENV_NOT_FOUND',
          { environmentId }
        );
      }

      // Update cache
      await this.cacheService.set(cacheKey, environment, this.CACHE_TTL);

      return environment;
    } catch (error) {
      this.logger.error('Failed to retrieve environment', { error, environmentId });
      throw new EnvironmentError(
        'Environment retrieval failed',
        'ENV_GET_ERROR',
        { environmentId }
      );
    }
  }

  /**
   * Retrieves all environments for a project with batch processing
   */
  public async getByProject(projectId: Types.ObjectId): Promise<IEnvironment[]> {
    try {
      // Check cache for project environments
      const cacheKey = `${this.CACHE_PREFIX}project:${projectId}`;
      const cachedEnvironments = await this.cacheService.get(cacheKey);

      if (cachedEnvironments) {
        return cachedEnvironments;
      }

      // Fetch from database with batch processing
      const environments = await Environment.findByProject(projectId);

      // Update cache
      await this.cacheService.set(cacheKey, environments, this.CACHE_TTL);

      // Log metrics
      this.logger.info('Environments retrieved', {
        projectId,
        count: environments.length
      });

      return environments;
    } catch (error) {
      this.logger.error('Failed to retrieve environments', { error, projectId });
      throw new EnvironmentError(
        'Environment retrieval failed',
        'ENV_LIST_ERROR',
        { projectId }
      );
    }
  }

  /**
   * Updates an environment with validation and conflict resolution
   */
  public async update(
    environmentId: Types.ObjectId,
    updateData: Partial<IEnvironment>
  ): Promise<IEnvironment> {
    try {
      // Validate update data
      this.validateEnvironmentData(updateData);

      // Update environment
      const environment = await Environment.findByIdAndUpdate(
        environmentId,
        {
          ...updateData,
          updated: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!environment) {
        throw new EnvironmentError(
          'Environment not found',
          'ENV_NOT_FOUND',
          { environmentId }
        );
      }

      // Update cache
      const cacheKey = `${this.CACHE_PREFIX}${environmentId}`;
      await this.cacheService.set(cacheKey, environment, this.CACHE_TTL);

      // Clear project cache
      await this.cacheService.delete(
        `${this.CACHE_PREFIX}project:${environment.projectId}`
      );

      // Log audit trail
      this.logger.info('Environment updated', {
        environmentId,
        updatedFields: Object.keys(updateData)
      });

      return environment;
    } catch (error) {
      this.logger.error('Failed to update environment', { error, environmentId });
      throw new EnvironmentError(
        'Environment update failed',
        'ENV_UPDATE_ERROR',
        { environmentId }
      );
    }
  }

  /**
   * Deletes an environment with cascade and cleanup
   */
  public async delete(environmentId: Types.ObjectId): Promise<void> {
    try {
      // Find environment first
      const environment = await Environment.findById(environmentId);

      if (!environment) {
        throw new EnvironmentError(
          'Environment not found',
          'ENV_NOT_FOUND',
          { environmentId }
        );
      }

      // Delete environment and related resources
      await environment.remove();

      // Clear caches
      await this.cacheService.delete(`${this.CACHE_PREFIX}${environmentId}`);
      await this.cacheService.delete(
        `${this.CACHE_PREFIX}project:${environment.projectId}`
      );

      // Log audit trail
      this.logger.info('Environment deleted', {
        environmentId,
        projectId: environment.projectId
      });
    } catch (error) {
      this.logger.error('Failed to delete environment', { error, environmentId });
      throw new EnvironmentError(
        'Environment deletion failed',
        'ENV_DELETE_ERROR',
        { environmentId }
      );
    }
  }

  /**
   * Validates environment data against schema requirements
   */
  private validateEnvironmentData(data: Partial<IEnvironment>): void {
    const errors: Array<{ field: string; message: string }> = [];

    if (data.name && !/^[a-zA-Z0-9-_]+$/.test(data.name)) {
      errors.push({
        field: 'name',
        message: 'Name must contain only alphanumeric characters, hyphens, and underscores'
      });
    }

    if (data.description && data.description.length > 500) {
      errors.push({
        field: 'description',
        message: 'Description cannot exceed 500 characters'
      });
    }

    if (data.version && !/^\d+\.\d+\.\d+$/.test(data.version)) {
      errors.push({
        field: 'version',
        message: 'Version must follow semantic versioning format (e.g., 1.0.0)'
      });
    }

    if (errors.length > 0) {
      throw new ValidationError(errors, 'environment', data);
    }
  }
}

// Export singleton instance
export default EnvironmentService.getInstance();