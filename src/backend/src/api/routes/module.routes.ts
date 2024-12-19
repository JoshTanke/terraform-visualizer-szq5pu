// External dependencies
import { Router } from 'express'; // v4.18.2

// Internal dependencies
import { ModuleController } from '../controllers/ModuleController';
import { 
  validateCreateModule, 
  validateUpdateModule, 
  validateModuleQuery 
} from '../validators/module.validator';
import { 
  authenticateToken, 
  authorizeRole 
} from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import { Logger } from '../../utils/logger';

/**
 * Router configuration for module-related API endpoints with comprehensive
 * security, validation, and performance optimizations.
 */
const router = Router();
const logger = Logger.getInstance();

// Initialize rate limiter with custom configuration for module endpoints
const rateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per window
  keyPrefix: 'tfv:module:',
  standardHeaders: true,
  legacyHeaders: false
});

// Initialize controller
const moduleController = new ModuleController();

/**
 * @route POST /api/modules
 * @description Create a new module with visualization metadata
 * @access Private - Editor, Admin
 */
router.post('/',
  authenticateToken,
  authorizeRole(['editor', 'admin']),
  rateLimiter,
  validateCreateModule(),
  async (req, res, next) => {
    try {
      logger.debug('Creating new module', { 
        correlationId: req.headers['x-correlation-id'] 
      });
      await moduleController.createModule(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/modules/environment/:environmentId
 * @description Get all modules in an environment with optimized query parameters
 * @access Private - All authenticated users
 */
router.get('/environment/:environmentId',
  authenticateToken,
  rateLimiter,
  validateModuleQuery(),
  async (req, res, next) => {
    try {
      logger.debug('Fetching modules by environment', { 
        environmentId: req.params.environmentId,
        correlationId: req.headers['x-correlation-id']
      });
      await moduleController.getModulesByEnvironment(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/modules/:moduleId
 * @description Get module with enhanced dependency tracking
 * @access Private - All authenticated users
 */
router.get('/:moduleId',
  authenticateToken,
  rateLimiter,
  async (req, res, next) => {
    try {
      logger.debug('Fetching module with dependencies', { 
        moduleId: req.params.moduleId,
        correlationId: req.headers['x-correlation-id']
      });
      await moduleController.getModuleWithDependencies(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /api/modules/:moduleId
 * @description Update module with position and visualization validation
 * @access Private - Editor, Admin
 */
router.put('/:moduleId',
  authenticateToken,
  authorizeRole(['editor', 'admin']),
  rateLimiter,
  validateUpdateModule(),
  async (req, res, next) => {
    try {
      logger.debug('Updating module', { 
        moduleId: req.params.moduleId,
        correlationId: req.headers['x-correlation-id']
      });
      await moduleController.updateModule(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route DELETE /api/modules/:moduleId
 * @description Delete module with dependency cleanup
 * @access Private - Admin only
 */
router.delete('/:moduleId',
  authenticateToken,
  authorizeRole(['admin']),
  rateLimiter,
  async (req, res, next) => {
    try {
      logger.debug('Deleting module', { 
        moduleId: req.params.moduleId,
        correlationId: req.headers['x-correlation-id']
      });
      await moduleController.deleteModule(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/modules/validate
 * @description Validate module configuration and visualization metadata
 * @access Private - All authenticated users
 */
router.post('/validate',
  authenticateToken,
  rateLimiter,
  async (req, res, next) => {
    try {
      logger.debug('Validating module configuration', {
        correlationId: req.headers['x-correlation-id']
      });
      await moduleController.validateModuleConfiguration(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

export { router as moduleRouter };