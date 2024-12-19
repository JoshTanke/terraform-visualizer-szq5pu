// External dependencies
import express, { Router } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import cors from 'cors'; // v2.8.5

// Internal dependencies
import { ProjectController } from '../controllers/ProjectController';
import { authenticateToken, authorizeRole, validateGithubToken } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validation';
import { Logger } from '../../utils/logger';

// Initialize logger
const logger = Logger.getInstance();

/**
 * Rate limiting configuration for project endpoints
 * Implements distributed rate limiting with Redis backend
 */
const RATE_LIMIT_OPTIONS = {
  windowMs: 60000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyPrefix: 'tfv:project:',
  handler: (req: express.Request, res: express.Response) => {
    logger.warn('Rate limit exceeded', {
      path: req.path,
      ip: req.ip,
      userId: (req as any).user?.id
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later'
    });
  }
};

/**
 * CORS configuration for project endpoints
 * Implements strict security policies
 */
const CORS_OPTIONS = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

/**
 * Configures and returns Express router with secure project endpoints
 * Implements comprehensive middleware stack for security, validation, and monitoring
 */
function configureProjectRoutes(): Router {
  const router = Router();
  const projectController = new ProjectController();

  // Apply security middleware
  router.use(helmet());
  router.use(cors(CORS_OPTIONS));

  // Create rate limiter instance
  const rateLimiter = createRateLimiter(RATE_LIMIT_OPTIONS);

  // Project creation endpoint
  router.post('/api/v1/projects',
    authenticateToken,
    authorizeRole(['admin', 'editor']),
    validateRequest(PROJECT_CREATION_SCHEMA, 'body'),
    rateLimiter,
    async (req, res, next) => {
      try {
        await projectController.createProject(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get project by ID endpoint
  router.get('/api/v1/projects/:id',
    authenticateToken,
    validateRequest(PROJECT_GET_SCHEMA, 'params'),
    rateLimiter,
    async (req, res, next) => {
      try {
        await projectController.getProject(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update project endpoint
  router.put('/api/v1/projects/:id',
    authenticateToken,
    authorizeRole(['admin', 'editor']),
    validateRequest(PROJECT_UPDATE_SCHEMA, 'body'),
    rateLimiter,
    async (req, res, next) => {
      try {
        await projectController.updateProject(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Delete project endpoint
  router.delete('/api/v1/projects/:id',
    authenticateToken,
    authorizeRole(['admin']),
    validateRequest(PROJECT_DELETE_SCHEMA, 'params'),
    rateLimiter,
    async (req, res, next) => {
      try {
        await projectController.deleteProject(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // GitHub sync endpoint
  router.post('/api/v1/projects/:id/sync',
    authenticateToken,
    validateGithubToken,
    authorizeRole(['admin', 'editor']),
    validateRequest(PROJECT_SYNC_SCHEMA, 'params'),
    rateLimiter,
    async (req, res, next) => {
      try {
        await projectController.syncWithGithub(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Project health check endpoint
  router.get('/api/v1/projects/:id/health',
    authenticateToken,
    validateRequest(PROJECT_HEALTH_SCHEMA, 'params'),
    rateLimiter,
    async (req, res, next) => {
      try {
        await projectController.getProjectHealth(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handling middleware
  router.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Project route error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id
    });

    res.status(error.status || 500).json({
      success: false,
      error: error.message
    });
  });

  return router;
}

// Export configured router
export default configureProjectRoutes();