// External dependencies
import express, { Router } from 'express'; // ^4.18.2

// Internal dependencies
import { ResourceController } from '../controllers/ResourceController';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import { validateRequestBody, validateRequestParams } from '../middleware/validation';
import { Logger } from '../../utils/logger';

// Initialize logger
const logger = Logger.getInstance();

/**
 * Rate limit configuration for resource endpoints
 * Implements strict rate limiting to prevent DoS attacks
 */
const RESOURCE_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per window
  keyPrefix: 'tfv:resource:',
  standardHeaders: true,
  legacyHeaders: false
};

/**
 * Configures and returns the resource router with comprehensive security middleware
 * and detailed error handling for all resource management endpoints.
 * @returns Configured Express router
 */
const configureResourceRoutes = (): Router => {
  const router = express.Router();
  const resourceController = ResourceController.getInstance();

  // Apply rate limiting middleware first for DoS protection
  const rateLimiter = createRateLimiter(RESOURCE_RATE_LIMIT);

  /**
   * POST /api/v1/resources
   * Creates a new Terraform resource with validation
   * Requires editor or admin role
   */
  router.post(
    '/api/v1/resources',
    rateLimiter,
    authenticateToken,
    authorizeRole(['editor', 'admin']),
    validateRequestBody(RESOURCE_CREATE_SCHEMA),
    async (req, res, next) => {
      try {
        await resourceController.createResource(req, res, next);
      } catch (error) {
        logger.error('Failed to create resource', {
          error: error.message,
          path: req.path,
          method: req.method
        });
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/resources/:resourceId
   * Retrieves a specific resource by ID
   * Requires authenticated user
   */
  router.get(
    '/api/v1/resources/:resourceId',
    rateLimiter,
    authenticateToken,
    validateRequestParams(RESOURCE_ID_SCHEMA),
    async (req, res, next) => {
      try {
        await resourceController.getResource(req, res, next);
      } catch (error) {
        logger.error('Failed to get resource', {
          error: error.message,
          resourceId: req.params.resourceId
        });
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/modules/:moduleId/resources
   * Retrieves all resources for a specific module
   * Requires authenticated user
   */
  router.get(
    '/api/v1/modules/:moduleId/resources',
    rateLimiter,
    authenticateToken,
    validateRequestParams(MODULE_ID_SCHEMA),
    async (req, res, next) => {
      try {
        await resourceController.getModuleResources(req, res, next);
      } catch (error) {
        logger.error('Failed to get module resources', {
          error: error.message,
          moduleId: req.params.moduleId
        });
        next(error);
      }
    }
  );

  /**
   * PUT /api/v1/resources/:resourceId
   * Updates an existing resource with validation
   * Requires editor or admin role
   */
  router.put(
    '/api/v1/resources/:resourceId',
    rateLimiter,
    authenticateToken,
    authorizeRole(['editor', 'admin']),
    validateRequestParams(RESOURCE_ID_SCHEMA),
    validateRequestBody(RESOURCE_UPDATE_SCHEMA),
    async (req, res, next) => {
      try {
        await resourceController.updateResource(req, res, next);
      } catch (error) {
        logger.error('Failed to update resource', {
          error: error.message,
          resourceId: req.params.resourceId
        });
        next(error);
      }
    }
  );

  /**
   * PUT /api/v1/resources/:resourceId/position
   * Updates resource position in visualization
   * Requires editor or admin role
   */
  router.put(
    '/api/v1/resources/:resourceId/position',
    rateLimiter,
    authenticateToken,
    authorizeRole(['editor', 'admin']),
    validateRequestParams(RESOURCE_ID_SCHEMA),
    validateRequestBody(POSITION_UPDATE_SCHEMA),
    async (req, res, next) => {
      try {
        await resourceController.updateResourcePosition(req, res, next);
      } catch (error) {
        logger.error('Failed to update resource position', {
          error: error.message,
          resourceId: req.params.resourceId
        });
        next(error);
      }
    }
  );

  /**
   * DELETE /api/v1/resources/:resourceId
   * Deletes a resource with cascade handling
   * Requires admin role
   */
  router.delete(
    '/api/v1/resources/:resourceId',
    rateLimiter,
    authenticateToken,
    authorizeRole(['admin']),
    validateRequestParams(RESOURCE_ID_SCHEMA),
    async (req, res, next) => {
      try {
        await resourceController.deleteResource(req, res, next);
      } catch (error) {
        logger.error('Failed to delete resource', {
          error: error.message,
          resourceId: req.params.resourceId
        });
        next(error);
      }
    }
  );

  return router;
};

// Create and export the configured router
export const resourceRouter = configureResourceRoutes();

// Export the router configuration function for testing
export default configureResourceRoutes;