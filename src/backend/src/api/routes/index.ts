// External dependencies
import express, { Router } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import cors from 'cors'; // v2.8.5
import compression from 'compression'; // v1.7.4
import swaggerUi from 'swagger-ui-express'; // v4.6.3

// Internal dependencies
import projectRouter from './project.routes';
import environmentRouter from './environment.routes';
import moduleRouter from './module.routes';
import resourceRouter from './resource.routes';
import graphRouter from './graph.routes';
import { errorHandler } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import { Logger } from '../../utils/logger';

// Initialize logger
const logger = Logger.getInstance();

// API version constant
const API_VERSION = 'v1';

// CORS configuration with strict security settings
const CORS_OPTIONS = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://terraform-visualizer.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-Correlation-ID'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

/**
 * Configures and returns the main Express router with comprehensive middleware
 * and security features for the Terraform Visualization Tool.
 * @returns Configured Express router
 */
function configureRoutes(): Router {
  const router = Router();

  // Apply security middleware
  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.github.com']
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));

  // Apply CORS with strict configuration
  router.use(cors(CORS_OPTIONS));

  // Enable response compression
  router.use(compression());

  // Apply rate limiting to all routes
  router.use(rateLimiter({
    windowMs: 60000, // 1 minute
    max: 100, // limit each IP to 100 requests per minute
    standardHeaders: true,
    legacyHeaders: false
  }));

  // Health check endpoint
  router.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: API_VERSION
    });
  });

  // Mount API documentation
  if (process.env.NODE_ENV !== 'production') {
    router.use('/api/docs', swaggerUi.serve);
    router.get('/api/docs', swaggerUi.setup(undefined, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Terraform Visualizer API Documentation'
    }));
  }

  // Mount feature routers with versioning
  router.use(`/api/${API_VERSION}/projects`, projectRouter);
  router.use(`/api/${API_VERSION}/environments`, environmentRouter);
  router.use(`/api/${API_VERSION}/modules`, moduleRouter);
  router.use(`/api/${API_VERSION}/resources`, resourceRouter);
  router.use(`/api/${API_VERSION}/graph`, graphRouter);

  // Apply error handling middleware
  router.use(errorHandler);

  // Handle 404 errors
  router.use((req, res) => {
    logger.warn('Route not found', {
      path: req.path,
      method: req.method,
      correlationId: req.headers['x-correlation-id']
    });

    res.status(404).json({
      success: false,
      error: {
        message: 'Route not found',
        code: 'NOT_FOUND',
        correlationId: req.headers['x-correlation-id']
      }
    });
  });

  // Configure graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down API gracefully');
    // Implement graceful shutdown logic here
  });

  return router;
}

// Export configured router
export default configureRoutes();