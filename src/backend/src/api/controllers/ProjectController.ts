// External dependencies
import { Request, Response, NextFunction } from 'express'; // v4.18.2
import rateLimit from 'express-rate-limit'; // v6.0.0
import { Counter, Gauge } from 'prom-client'; // v14.0.0

// Internal dependencies
import { IProject, ProjectStatus } from '../../interfaces/IProject';
import { ProjectService } from '../../services/ProjectService';
import { validateProjectCreation, validateProjectUpdate } from '../validators/project.validator';
import { ValidationError, formatErrorResponse } from '../../utils/errors';
import Logger from '../../utils/logger';
import GithubClient from '../../github/GithubClient';

/**
 * Enhanced controller class handling project-related HTTP requests with security,
 * validation, monitoring, and comprehensive error handling
 */
export class ProjectController {
    private readonly projectService: ProjectService;
    private readonly logger: Logger;
    private readonly githubClient: GithubClient;

    // Metrics collectors
    private readonly requestCounter: Counter;
    private readonly activeProjectsGauge: Gauge;
    private readonly operationDurationHistogram: Histogram;

    // Rate limiter configuration
    private readonly rateLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per window
        message: 'Too many requests from this IP, please try again later',
        standardHeaders: true,
        legacyHeaders: false
    });

    /**
     * Initializes ProjectController with required services and monitoring
     */
    constructor() {
        this.projectService = ProjectService.getInstance();
        this.logger = Logger.getInstance();
        this.githubClient = GithubClient.getInstance();

        // Initialize metrics collectors
        this.requestCounter = new Counter({
            name: 'project_api_requests_total',
            help: 'Total number of project API requests',
            labelNames: ['method', 'endpoint', 'status']
        });

        this.activeProjectsGauge = new Gauge({
            name: 'active_projects_total',
            help: 'Total number of active projects'
        });

        this.operationDurationHistogram = new Histogram({
            name: 'project_operation_duration_seconds',
            help: 'Duration of project operations in seconds',
            labelNames: ['operation']
        });
    }

    /**
     * Creates a new project with enhanced validation and security
     */
    public async createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
        const startTime = Date.now();
        const correlationId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Apply rate limiting
            await this.rateLimiter(req, res, () => {});

            // Validate request body
            await validateProjectCreation(req.body);

            // Create project
            const project = await this.projectService.createProject({
                ...req.body,
                status: ProjectStatus.ACTIVE,
                created: new Date(),
                updated: new Date(),
                version: 1
            });

            // Update metrics
            this.requestCounter.inc({ method: 'POST', endpoint: '/projects', status: 200 });
            this.activeProjectsGauge.inc();
            this.operationDurationHistogram.observe(
                { operation: 'create' },
                (Date.now() - startTime) / 1000
            );

            // Log success
            this.logger.info('Project created successfully', {
                correlationId,
                projectId: project.id,
                duration: Date.now() - startTime
            });

            res.status(201).json({
                success: true,
                data: project
            });

        } catch (error) {
            // Update error metrics
            this.requestCounter.inc({ method: 'POST', endpoint: '/projects', status: error.status || 500 });

            // Log error
            this.logger.error('Project creation failed', {
                correlationId,
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime
            });

            next(error);
        }
    }

    /**
     * Retrieves a project by ID with security checks
     */
    public async getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
        const startTime = Date.now();
        const correlationId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Apply rate limiting
            await this.rateLimiter(req, res, () => {});

            const project = await this.projectService.getProject(req.params.id);

            if (!project) {
                throw new ValidationError(
                    [{ field: 'id', message: 'Project not found' }],
                    'project_retrieval',
                    { projectId: req.params.id }
                );
            }

            // Update metrics
            this.requestCounter.inc({ method: 'GET', endpoint: '/projects/:id', status: 200 });
            this.operationDurationHistogram.observe(
                { operation: 'get' },
                (Date.now() - startTime) / 1000
            );

            // Log success
            this.logger.info('Project retrieved successfully', {
                correlationId,
                projectId: project.id,
                duration: Date.now() - startTime
            });

            res.status(200).json({
                success: true,
                data: project
            });

        } catch (error) {
            // Update error metrics
            this.requestCounter.inc({ method: 'GET', endpoint: '/projects/:id', status: error.status || 500 });

            // Log error
            this.logger.error('Project retrieval failed', {
                correlationId,
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime
            });

            next(error);
        }
    }

    /**
     * Updates a project with validation and security checks
     */
    public async updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
        const startTime = Date.now();
        const correlationId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Apply rate limiting
            await this.rateLimiter(req, res, () => {});

            // Validate update data
            await validateProjectUpdate(req.body);

            const updatedProject = await this.projectService.updateProject(
                req.params.id,
                req.body
            );

            // Update metrics
            this.requestCounter.inc({ method: 'PUT', endpoint: '/projects/:id', status: 200 });
            this.operationDurationHistogram.observe(
                { operation: 'update' },
                (Date.now() - startTime) / 1000
            );

            // Log success
            this.logger.info('Project updated successfully', {
                correlationId,
                projectId: updatedProject.id,
                duration: Date.now() - startTime
            });

            res.status(200).json({
                success: true,
                data: updatedProject
            });

        } catch (error) {
            // Update error metrics
            this.requestCounter.inc({ method: 'PUT', endpoint: '/projects/:id', status: error.status || 500 });

            // Log error
            this.logger.error('Project update failed', {
                correlationId,
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime
            });

            next(error);
        }
    }

    /**
     * Deletes a project with security checks
     */
    public async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
        const startTime = Date.now();
        const correlationId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Apply rate limiting
            await this.rateLimiter(req, res, () => {});

            await this.projectService.deleteProject(req.params.id);

            // Update metrics
            this.requestCounter.inc({ method: 'DELETE', endpoint: '/projects/:id', status: 200 });
            this.activeProjectsGauge.dec();
            this.operationDurationHistogram.observe(
                { operation: 'delete' },
                (Date.now() - startTime) / 1000
            );

            // Log success
            this.logger.info('Project deleted successfully', {
                correlationId,
                projectId: req.params.id,
                duration: Date.now() - startTime
            });

            res.status(204).send();

        } catch (error) {
            // Update error metrics
            this.requestCounter.inc({ method: 'DELETE', endpoint: '/projects/:id', status: error.status || 500 });

            // Log error
            this.logger.error('Project deletion failed', {
                correlationId,
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime
            });

            next(error);
        }
    }

    /**
     * Synchronizes project with GitHub repository
     */
    public async syncWithGithub(req: Request, res: Response, next: NextFunction): Promise<void> {
        const startTime = Date.now();
        const correlationId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Apply rate limiting
            await this.rateLimiter(req, res, () => {});

            const project = await this.projectService.syncWithGithub(req.params.id);

            // Update metrics
            this.requestCounter.inc({ method: 'POST', endpoint: '/projects/:id/sync', status: 200 });
            this.operationDurationHistogram.observe(
                { operation: 'sync' },
                (Date.now() - startTime) / 1000
            );

            // Log success
            this.logger.info('Project synchronized successfully', {
                correlationId,
                projectId: project.id,
                duration: Date.now() - startTime
            });

            res.status(200).json({
                success: true,
                data: project
            });

        } catch (error) {
            // Update error metrics
            this.requestCounter.inc({ method: 'POST', endpoint: '/projects/:id/sync', status: error.status || 500 });

            // Log error
            this.logger.error('Project synchronization failed', {
                correlationId,
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime
            });

            next(error);
        }
    }
}

export default ProjectController;