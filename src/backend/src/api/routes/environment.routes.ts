// External dependencies
import { Router } from 'express'; // v4.18.2
import rateLimit from 'express-rate-limit'; // v6.7.0

// Internal dependencies
import { EnvironmentController } from '../controllers/EnvironmentController';
import { 
  authenticateToken, 
  authorizeRole 
} from '../middleware/auth';
import { 
  validateRequestBody, 
  validateRequestParams 
} from '../middleware/validation';

// Initialize router
const router = Router();

// Get controller instance
const environmentController = EnvironmentController.getInstance();

// Rate limiting configuration for environment endpoints
const environmentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Validation schemas
const projectIdSchema = {
  projectId: {
    in: ['params'],
    isMongoId: true,
    errorMessage: 'Invalid project ID format'
  }
};

const environmentIdSchema = {
  id: {
    in: ['params'],
    isMongoId: true,
    errorMessage: 'Invalid environment ID format'
  }
};

const createEnvironmentSchema = {
  name: {
    in: ['body'],
    isString: true,
    trim: true,
    notEmpty: true,
    matches: /^[a-zA-Z0-9-_]+$/,
    errorMessage: 'Name must contain only alphanumeric characters, hyphens, and underscores'
  },
  projectId: {
    in: ['body'],
    isMongoId: true,
    errorMessage: 'Invalid project ID format'
  },
  description: {
    in: ['body'],
    optional: true,
    isString: true,
    trim: true,
    isLength: {
      options: { max: 500 },
      errorMessage: 'Description cannot exceed 500 characters'
    }
  }
};

const updateEnvironmentSchema = {
  ...createEnvironmentSchema,
  projectId: {
    in: ['body'],
    optional: true,
    isMongoId: true,
    errorMessage: 'Invalid project ID format'
  }
};

/**
 * @route GET /api/projects/:projectId/environments
 * @desc Get all environments for a project with role-based access control
 * @access Private - Viewer, Editor, Admin
 */
router.get(
  '/projects/:projectId/environments',
  authenticateToken,
  authorizeRole(['viewer', 'editor', 'admin']),
  validateRequestParams(projectIdSchema),
  environmentRateLimit,
  environmentController.getProjectEnvironments
);

/**
 * @route GET /api/environments/:id
 * @desc Get environment by ID with proper authentication
 * @access Private - Viewer, Editor, Admin
 */
router.get(
  '/environments/:id',
  authenticateToken,
  authorizeRole(['viewer', 'editor', 'admin']),
  validateRequestParams(environmentIdSchema),
  environmentRateLimit,
  environmentController.getEnvironment
);

/**
 * @route POST /api/environments
 * @desc Create new environment with validation and logging
 * @access Private - Editor, Admin
 */
router.post(
  '/environments',
  authenticateToken,
  authorizeRole(['editor', 'admin']),
  validateRequestBody(createEnvironmentSchema),
  environmentRateLimit,
  environmentController.createEnvironment
);

/**
 * @route PUT /api/environments/:id
 * @desc Update existing environment with full validation
 * @access Private - Editor, Admin
 */
router.put(
  '/environments/:id',
  authenticateToken,
  authorizeRole(['editor', 'admin']),
  validateRequestParams(environmentIdSchema),
  validateRequestBody(updateEnvironmentSchema),
  environmentRateLimit,
  environmentController.updateEnvironment
);

/**
 * @route DELETE /api/environments/:id
 * @desc Delete environment with admin-only access
 * @access Private - Admin only
 */
router.delete(
  '/environments/:id',
  authenticateToken,
  authorizeRole(['admin']),
  validateRequestParams(environmentIdSchema),
  environmentRateLimit,
  environmentController.deleteEnvironment
);

// Export configured router
export default router;