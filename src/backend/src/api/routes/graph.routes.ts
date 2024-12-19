// External dependencies
import express, { Router } from 'express'; // v4.18.2
import compression from 'compression'; // v1.7.4
import helmet from 'helmet'; // v7.0.0
import rateLimit from 'express-rate-limit'; // v6.7.0

// Internal dependencies
import { GraphController } from '../controllers/GraphController';
import { authenticateToken } from '../middleware/auth';
import { validateRequestParams } from '../middleware/validation';
import { Logger } from '../../utils/logger';

// Initialize logger
const logger = Logger.getInstance();

// Create router instance
const router: Router = express.Router();

// Initialize controller
const graphController = new GraphController();

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Configure request parameter validation schemas
const idParamSchema = {
  environmentId: {
    in: ['params'],
    isUUID: true,
    errorMessage: 'Invalid environment ID format'
  },
  moduleId: {
    in: ['params'],
    isUUID: true,
    errorMessage: 'Invalid module ID format'
  }
};

/**
 * Health check endpoint
 * @route GET /api/graphs/health
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * Retrieves pipeline-level graph visualization
 * @route GET /api/graphs/pipeline
 * @security JWT
 */
router.get('/pipeline',
  helmet(),
  compression(),
  limiter,
  authenticateToken,
  async (req, res, next) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string;
      logger.info('Pipeline graph request received', { correlationId });

      const result = await graphController.getPipelineGraph(req, res);
      res.status(200).json(result);
    } catch (error) {
      logger.error('Pipeline graph request failed', { 
        error: error.message,
        correlationId: req.headers['x-correlation-id']
      });
      next(error);
    }
  }
);

/**
 * Retrieves environment-level graph visualization
 * @route GET /api/graphs/environment/:environmentId
 * @param {string} environmentId.path.required - Environment UUID
 * @security JWT
 */
router.get('/environment/:environmentId',
  helmet(),
  compression(),
  limiter,
  authenticateToken,
  validateRequestParams(idParamSchema),
  async (req, res, next) => {
    try {
      const { environmentId } = req.params;
      const correlationId = req.headers['x-correlation-id'] as string;
      
      logger.info('Environment graph request received', { 
        environmentId,
        correlationId 
      });

      const result = await graphController.getEnvironmentGraph(req, res);
      res.status(200).json(result);
    } catch (error) {
      logger.error('Environment graph request failed', {
        error: error.message,
        environmentId: req.params.environmentId,
        correlationId: req.headers['x-correlation-id']
      });
      next(error);
    }
  }
);

/**
 * Retrieves module-level graph visualization
 * @route GET /api/graphs/module/:moduleId
 * @param {string} moduleId.path.required - Module UUID
 * @security JWT
 */
router.get('/module/:moduleId',
  helmet(),
  compression(),
  limiter,
  authenticateToken,
  validateRequestParams(idParamSchema),
  async (req, res, next) => {
    try {
      const { moduleId } = req.params;
      const correlationId = req.headers['x-correlation-id'] as string;
      
      logger.info('Module graph request received', { 
        moduleId,
        correlationId 
      });

      const result = await graphController.getModuleGraph(req, res);
      res.status(200).json(result);
    } catch (error) {
      logger.error('Module graph request failed', {
        error: error.message,
        moduleId: req.params.moduleId,
        correlationId: req.headers['x-correlation-id']
      });
      next(error);
    }
  }
);

/**
 * Invalidates graph cache
 * @route POST /api/graphs/cache/invalidate
 * @security JWT
 */
router.post('/cache/invalidate',
  helmet(),
  limiter,
  authenticateToken,
  async (req, res, next) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string;
      logger.info('Cache invalidation request received', { correlationId });

      await graphController.invalidateGraphCache(req, res);
      res.status(200).json({
        success: true,
        message: 'Cache invalidated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Cache invalidation failed', {
        error: error.message,
        correlationId: req.headers['x-correlation-id']
      });
      next(error);
    }
  }
);

// Error handling middleware
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Graph route error occurred', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    correlationId: req.headers['x-correlation-id']
  });

  res.status(error.status || 500).json({
    success: false,
    error: {
      message: error.message,
      code: error.code || 'INTERNAL_ERROR',
      correlationId: req.headers['x-correlation-id']
    }
  });
});

export default router;