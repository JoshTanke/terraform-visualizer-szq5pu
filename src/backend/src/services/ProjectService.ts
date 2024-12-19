// External dependencies
import { Types } from 'mongoose'; // v6.0.0
import CircuitBreaker from 'opossum'; // v6.0.0
import { Cache } from 'node-cache'; // v5.1.2
import { injectable } from 'inversify'; // v6.0.0
import { Gauge, Counter } from 'prom-client'; // v14.0.0

// Internal dependencies
import { IProject, ProjectStatus } from '../../interfaces/IProject';
import { Project, ProjectDocument } from '../db/models/Project';
import { GithubClient } from '../github/GithubClient';
import Logger from '../utils/logger';
import { ValidationError, ParseError } from '../utils/errors';

/**
 * Enhanced service class implementing business logic for Terraform project management
 * with comprehensive security, monitoring, and performance features
 */
@injectable()
export class ProjectService {
    private readonly githubClient: GithubClient;
    private readonly logger: Logger;
    private readonly cache: Cache;
    private readonly githubBreaker: CircuitBreaker;

    // Metrics collectors
    private readonly projectsGauge: Gauge;
    private readonly operationsCounter: Counter;
    private readonly errorCounter: Counter;

    /**
     * Initializes ProjectService with enhanced dependencies and monitoring
     */
    constructor(
        githubClient: GithubClient,
        logger: Logger,
        cache: Cache
    ) {
        this.githubClient = githubClient;
        this.logger = logger;
        this.cache = new Cache({
            stdTTL: 3600, // 1 hour cache TTL
            checkperiod: 120, // Check for expired keys every 2 minutes
            useClones: false // Performance optimization
        });

        // Initialize circuit breaker for GitHub operations
        this.githubBreaker = new CircuitBreaker(async (operation: Function) => {
            return await operation();
        }, {
            timeout: 10000, // 10 second timeout
            errorThresholdPercentage: 50,
            resetTimeout: 30000,
            name: 'github-operations'
        });

        // Initialize metrics collectors
        this.projectsGauge = new Gauge({
            name: 'terraform_visualizer_projects_total',
            help: 'Total number of Terraform projects'
        });

        this.operationsCounter = new Counter({
            name: 'terraform_visualizer_project_operations_total',
            help: 'Total number of project operations',
            labelNames: ['operation', 'status']
        });

        this.errorCounter = new Counter({
            name: 'terraform_visualizer_project_errors_total',
            help: 'Total number of project operation errors',
            labelNames: ['error_type']
        });

        // Setup circuit breaker event handlers
        this.setupCircuitBreakerEvents();
    }

    /**
     * Sets up circuit breaker monitoring events
     */
    private setupCircuitBreakerEvents(): void {
        this.githubBreaker.on('open', () => {
            this.logger.error('GitHub operations circuit breaker opened');
            this.errorCounter.inc({ error_type: 'circuit_breaker_open' });
        });

        this.githubBreaker.on('halfOpen', () => {
            this.logger.info('GitHub operations circuit breaker half-open');
        });

        this.githubBreaker.on('close', () => {
            this.logger.info('GitHub operations circuit breaker closed');
        });
    }

    /**
     * Creates a new Terraform project with enhanced validation and security
     */
    public async createProject(projectData: Partial<IProject>): Promise<IProject> {
        const correlationId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();

        try {
            // Input validation
            this.validateProjectInput(projectData);

            // Start transaction
            const session = await Project.startTransaction();

            try {
                // Check for existing project
                const existingProject = await Project.findByGithubUrl(projectData.githubUrl!);
                if (existingProject) {
                    throw new ValidationError(
                        [{ field: 'githubUrl', message: 'Project with this GitHub URL already exists' }],
                        'uniqueness',
                        { githubUrl: projectData.githubUrl }
                    );
                }

                // Verify GitHub repository access
                await this.githubBreaker.fire(async () => {
                    const [owner, repo] = projectData.githubUrl!.split('/').slice(-2);
                    await this.githubClient.getRepository(owner, repo.replace('.git', ''));
                });

                // Create project with audit trail
                const project = await Project.validateAndCreateProject({
                    ...projectData,
                    status: ProjectStatus.ACTIVE,
                    created: new Date(),
                    updated: new Date(),
                    version: 1
                });

                // Commit transaction
                await session.commitTransaction();

                // Update cache
                const cacheKey = `project:${project.id}`;
                await this.cache.set(cacheKey, project, 3600);

                // Update metrics
                this.projectsGauge.inc();
                this.operationsCounter.inc({ operation: 'create', status: 'success' });

                // Log success
                this.logger.info('Project created successfully', {
                    correlationId,
                    projectId: project.id,
                    duration: Date.now() - startTime
                });

                return project;
            } catch (error) {
                // Rollback transaction on error
                await session.abortTransaction();
                throw error;
            }
        } catch (error) {
            // Error handling and monitoring
            this.errorCounter.inc({ error_type: error.name || 'unknown' });
            this.operationsCounter.inc({ operation: 'create', status: 'failure' });

            this.logger.error('Project creation failed', {
                correlationId,
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime
            });

            throw error;
        }
    }

    /**
     * Validates project input data
     */
    private validateProjectInput(projectData: Partial<IProject>): void {
        const errors: Array<{ field: string; message: string }> = [];

        if (!projectData.name) {
            errors.push({ field: 'name', message: 'Project name is required' });
        } else if (projectData.name.length > 100) {
            errors.push({ field: 'name', message: 'Project name cannot exceed 100 characters' });
        }

        if (!projectData.githubUrl) {
            errors.push({ field: 'githubUrl', message: 'GitHub URL is required' });
        } else {
            const githubUrlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w-]+(?:\.git)?$/;
            if (!githubUrlPattern.test(projectData.githubUrl)) {
                errors.push({ field: 'githubUrl', message: 'Invalid GitHub repository URL format' });
            }
        }

        if (errors.length > 0) {
            throw new ValidationError(errors, 'project_creation', projectData);
        }
    }
}

export default ProjectService;