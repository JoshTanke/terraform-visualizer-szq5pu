// External dependencies
import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { Types } from 'mongoose'; // v6.0.0

// Internal dependencies
import { IResource } from '../../interfaces/IResource';
import { ResourceService } from '../../services/ResourceService';
import { 
  validateResourceCreate, 
  validateResourceUpdate, 
  validateResourceAttributes 
} from '../validators/resource.validator';
import { NotFoundError, ValidationError, SystemError } from '../../utils/errors';
import { Logger } from '../../utils/logger';

/**
 * Enhanced controller handling HTTP requests for Terraform resource operations
 * with comprehensive error handling, validation, and monitoring.
 */
export class ResourceController {
  private static instance: ResourceController;
  private readonly resourceService: ResourceService;
  private readonly logger: Logger;

  /**
   * Private constructor implementing singleton pattern
   */
  private constructor() {
    this.resourceService = ResourceService.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * Gets singleton instance of ResourceController
   */
  public static getInstance(): ResourceController {
    if (!ResourceController.instance) {
      ResourceController.instance = new ResourceController();
    }
    return ResourceController.instance;
  }

  /**
   * Creates a new Terraform resource with enhanced validation
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  public async createResource(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      this.logger.debug('Creating resource', { body: req.body });

      // Validate request body
      const validatedData = await validateResourceCreate(req.body);

      // Create resource
      const resource = await this.resourceService.createResource(validatedData);

      this.logger.info('Resource created successfully', {
        resourceId: resource._id,
        type: resource.type
      });

      res.status(201).json({
        success: true,
        data: resource,
        metadata: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves a specific resource by ID
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  public async getResource(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const resourceId = new Types.ObjectId(req.params.id);
      
      const resource = await this.resourceService.getResourceById(resourceId);
      
      if (!resource) {
        throw new NotFoundError('Resource not found');
      }

      res.status(200).json({
        success: true,
        data: resource
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves all resources for a specific module
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  public async getModuleResources(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const moduleId = new Types.ObjectId(req.params.moduleId);
      
      const resources = await this.resourceService.getResourcesByModule(moduleId);

      res.status(200).json({
        success: true,
        data: resources,
        metadata: {
          count: resources.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates an existing resource with validation
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  public async updateResource(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const resourceId = new Types.ObjectId(req.params.id);
      
      // Validate update data
      const validatedData = await validateResourceUpdate(req.body);

      // Update resource
      const updatedResource = await this.resourceService.updateResource(
        resourceId,
        validatedData
      );

      this.logger.info('Resource updated successfully', {
        resourceId: updatedResource._id,
        type: updatedResource.type
      });

      res.status(200).json({
        success: true,
        data: updatedResource,
        metadata: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes a resource and its dependencies
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  public async deleteResource(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const resourceId = new Types.ObjectId(req.params.id);
      
      const deletedResource = await this.resourceService.deleteResource(resourceId);

      this.logger.info('Resource deleted successfully', {
        resourceId: deletedResource._id,
        type: deletedResource.type
      });

      res.status(200).json({
        success: true,
        data: deletedResource,
        metadata: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates resource position in the visualization
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  public async updateResourcePosition(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const resourceId = new Types.ObjectId(req.params.id);
      const { x, y } = req.body;

      // Validate position data
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new ValidationError(
          [{
            field: 'position',
            message: 'Invalid position coordinates'
          }],
          'position'
        );
      }

      const updatedResource = await this.resourceService.updateResourcePosition(
        resourceId,
        { x, y }
      );

      res.status(200).json({
        success: true,
        data: updatedResource
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export default ResourceController.getInstance();