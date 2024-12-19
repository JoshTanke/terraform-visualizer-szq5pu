// External dependencies
import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { Types } from 'mongoose'; // v6.0.0

// Internal dependencies
import { IEnvironment } from '../../../interfaces/IEnvironment';
import { EnvironmentService } from '../../../services/EnvironmentService';
import { 
  validateEnvironmentCreate,
  validateEnvironmentUpdate,
  validateEnvironmentDelete 
} from '../validators/environment.validator';
import { Logger } from '../../../utils/logger';
import { BaseError, ValidationError, formatErrorResponse } from '../../../utils/errors';

/**
 * Controller class that handles HTTP requests for environment-related operations
 * in the Terraform visualization system. Implements comprehensive validation,
 * error handling, and auditing.
 */
export class EnvironmentController {
  private static instance: EnvironmentController;
  private readonly environmentService: EnvironmentService;
  private readonly logger: Logger;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  /**
   * Private constructor implementing singleton pattern with enhanced initialization
   */
  private constructor() {
    this.environmentService = EnvironmentService.getInstance();
    this.logger = Logger.getInstance();
    this.logger.info('EnvironmentController initialized');
  }

  /**
   * Gets singleton instance of EnvironmentController
   */
  public static getInstance(): EnvironmentController {
    if (!EnvironmentController.instance) {
      EnvironmentController.instance = new EnvironmentController();
    }
    return EnvironmentController.instance;
  }

  /**
   * Creates a new environment with comprehensive validation and auditing
   */
  public async createEnvironment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      this.logger.info('Creating environment', {
        correlationId,
        projectId: req.body.projectId,
        name: req.body.name
      });

      // Validate request data
      await validateEnvironmentCreate(req.body);

      // Create environment
      const environment = await this.environmentService.create(
        new Types.ObjectId(req.body.projectId),
        req.body
      );

      this.logger.info('Environment created successfully', {
        correlationId,
        environmentId: environment._id,
        duration: Date.now() - startTime
      });

      res.status(201).json({
        success: true,
        data: environment,
        metadata: {
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.logger.error('Failed to create environment', {
        correlationId,
        error: error.message,
        requestBody: req.body
      });
      next(error);
    }
  }

  /**
   * Retrieves environment by ID with caching and error handling
   */
  public async getEnvironment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;
    const environmentId = req.params.id;

    try {
      this.logger.info('Retrieving environment', {
        correlationId,
        environmentId
      });

      if (!Types.ObjectId.isValid(environmentId)) {
        throw new ValidationError(
          [{ field: 'id', message: 'Invalid environment ID format' }],
          'retrieve'
        );
      }

      const environment = await this.environmentService.getById(
        new Types.ObjectId(environmentId)
      );

      this.logger.info('Environment retrieved successfully', {
        correlationId,
        environmentId,
        duration: Date.now() - startTime
      });

      res.status(200).json({
        success: true,
        data: environment,
        metadata: {
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.logger.error('Failed to retrieve environment', {
        correlationId,
        environmentId,
        error: error.message
      });
      next(error);
    }
  }

  /**
   * Updates an environment with validation and conflict resolution
   */
  public async updateEnvironment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;
    const environmentId = req.params.id;

    try {
      this.logger.info('Updating environment', {
        correlationId,
        environmentId,
        updateData: req.body
      });

      // Validate request data
      await validateEnvironmentUpdate(environmentId, req.body);

      const environment = await this.environmentService.update(
        new Types.ObjectId(environmentId),
        req.body
      );

      this.logger.info('Environment updated successfully', {
        correlationId,
        environmentId,
        duration: Date.now() - startTime
      });

      res.status(200).json({
        success: true,
        data: environment,
        metadata: {
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.logger.error('Failed to update environment', {
        correlationId,
        environmentId,
        error: error.message,
        requestBody: req.body
      });
      next(error);
    }
  }

  /**
   * Deletes an environment with dependency checking and cleanup
   */
  public async deleteEnvironment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;
    const environmentId = req.params.id;

    try {
      this.logger.info('Deleting environment', {
        correlationId,
        environmentId
      });

      // Validate deletion request
      await validateEnvironmentDelete(environmentId);

      await this.environmentService.delete(new Types.ObjectId(environmentId));

      this.logger.info('Environment deleted successfully', {
        correlationId,
        environmentId,
        duration: Date.now() - startTime
      });

      res.status(204).send();
    } catch (error) {
      this.logger.error('Failed to delete environment', {
        correlationId,
        environmentId,
        error: error.message
      });
      next(error);
    }
  }

  /**
   * Retrieves all environments for a project with pagination and filtering
   */
  public async getProjectEnvironments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;
    const projectId = req.params.projectId;

    try {
      this.logger.info('Retrieving project environments', {
        correlationId,
        projectId
      });

      if (!Types.ObjectId.isValid(projectId)) {
        throw new ValidationError(
          [{ field: 'projectId', message: 'Invalid project ID format' }],
          'retrieve'
        );
      }

      const environments = await this.environmentService.getByProject(
        new Types.ObjectId(projectId)
      );

      this.logger.info('Project environments retrieved successfully', {
        correlationId,
        projectId,
        count: environments.length,
        duration: Date.now() - startTime
      });

      res.status(200).json({
        success: true,
        data: environments,
        metadata: {
          correlationId,
          timestamp: new Date().toISOString(),
          count: environments.length
        }
      });
    } catch (error) {
      this.logger.error('Failed to retrieve project environments', {
        correlationId,
        projectId,
        error: error.message
      });
      next(error);
    }
  }
}

// Export singleton instance
export default EnvironmentController.getInstance();