// External dependencies
import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import compression from 'compression'; // v1.7.4

// Internal dependencies
import { ModuleService } from '../../services/ModuleService';
import { IModule } from '../../interfaces/IModule';
import { ValidationError } from '../../utils/errors';
import { Logger } from '../../utils/logger';
import { validateSchema, MODULE_SCHEMA } from '../../utils/validation';

/**
 * Controller handling module-related HTTP requests with comprehensive error handling,
 * validation, and performance monitoring.
 */
export class ModuleController {
    private readonly moduleService: ModuleService;
    private readonly logger: Logger;
    private readonly rateLimiter: any;

    /**
     * Initializes ModuleController with required dependencies and middleware
     */
    constructor() {
        this.moduleService = ModuleService.getInstance();
        this.logger = Logger.getInstance();
        
        // Configure rate limiting
        this.rateLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later'
        });
    }

    /**
     * Creates a new module with validation and performance monitoring
     * @param req Express request object
     * @param res Express response object
     * @param next Express next function
     */
    public async createModule = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now();
        
        try {
            // Validate request body
            const validationResult = await validateSchema(req.body, MODULE_SCHEMA);
            
            // Create module
            const module = await this.moduleService.createModule(validationResult.data);

            // Set cache control headers
            res.set('Cache-Control', 'private, max-age=0, no-cache');
            
            // Send response
            res.status(StatusCodes.CREATED).json({
                success: true,
                data: module,
                metadata: {
                    processingTime: Date.now() - startTime
                }
            });

            // Log success
            this.logger.info('Module created successfully', {
                moduleId: module._id,
                processingTime: Date.now() - startTime
            });

        } catch (error) {
            next(error);
        }
    };

    /**
     * Retrieves modules by environment with pagination and caching
     * @param req Express request object
     * @param res Express response object
     * @param next Express next function
     */
    public getModulesByEnvironment = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now();
        
        try {
            const { environmentId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            // Validate environment ID
            if (!environmentId) {
                throw new ValidationError(
                    [{ field: 'environmentId', message: 'Environment ID is required' }],
                    'validation'
                );
            }

            // Get modules
            const modules = await this.moduleService.getModulesByEnvironment(environmentId);

            // Set cache control headers
            res.set('Cache-Control', 'private, max-age=300'); // 5 minutes cache

            // Send response
            res.status(StatusCodes.OK).json({
                success: true,
                data: modules,
                metadata: {
                    processingTime: Date.now() - startTime,
                    total: modules.length,
                    page: Number(page),
                    limit: Number(limit)
                }
            });

        } catch (error) {
            next(error);
        }
    };

    /**
     * Retrieves a module with its dependencies
     * @param req Express request object
     * @param res Express response object
     * @param next Express next function
     */
    public getModuleWithDependencies = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now();
        
        try {
            const { moduleId } = req.params;

            // Validate module ID
            if (!moduleId) {
                throw new ValidationError(
                    [{ field: 'moduleId', message: 'Module ID is required' }],
                    'validation'
                );
            }

            // Get module with dependencies
            const module = await this.moduleService.getModuleWithDependencies(moduleId);

            if (!module) {
                res.status(StatusCodes.NOT_FOUND).json({
                    success: false,
                    error: 'Module not found'
                });
                return;
            }

            // Set cache control headers
            res.set('Cache-Control', 'private, max-age=300'); // 5 minutes cache

            // Send response
            res.status(StatusCodes.OK).json({
                success: true,
                data: module,
                metadata: {
                    processingTime: Date.now() - startTime
                }
            });

        } catch (error) {
            next(error);
        }
    };

    /**
     * Updates an existing module with validation
     * @param req Express request object
     * @param res Express response object
     * @param next Express next function
     */
    public updateModule = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now();
        
        try {
            const { moduleId } = req.params;
            
            // Validate request body
            const validationResult = await validateSchema(req.body, MODULE_SCHEMA);

            // Update module
            const updatedModule = await this.moduleService.updateModule(
                moduleId,
                validationResult.data
            );

            // Set cache control headers
            res.set('Cache-Control', 'no-cache');

            // Send response
            res.status(StatusCodes.OK).json({
                success: true,
                data: updatedModule,
                metadata: {
                    processingTime: Date.now() - startTime
                }
            });

        } catch (error) {
            next(error);
        }
    };

    /**
     * Deletes a module and its associated resources
     * @param req Express request object
     * @param res Express response object
     * @param next Express next function
     */
    public deleteModule = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now();
        
        try {
            const { moduleId } = req.params;

            // Delete module
            const result = await this.moduleService.deleteModule(moduleId);

            // Set cache control headers
            res.set('Cache-Control', 'no-cache');

            // Send response
            res.status(StatusCodes.OK).json({
                success: true,
                data: { deleted: result },
                metadata: {
                    processingTime: Date.now() - startTime
                }
            });

        } catch (error) {
            next(error);
        }
    };

    /**
     * Validates module configuration without saving
     * @param req Express request object
     * @param res Express response object
     * @param next Express next function
     */
    public validateModuleConfiguration = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now();
        
        try {
            const configuration = req.body;

            // Validate configuration
            const validationResult = await this.moduleService.validateModuleConfiguration(
                configuration
            );

            // Send response
            res.status(StatusCodes.OK).json({
                success: true,
                data: validationResult,
                metadata: {
                    processingTime: Date.now() - startTime
                }
            });

        } catch (error) {
            next(error);
        }
    };

    /**
     * Gets rate limiter middleware
     * @returns Rate limiter middleware
     */
    public getRateLimiter(): any {
        return this.rateLimiter;
    }
}

// Export singleton instance
export default new ModuleController();