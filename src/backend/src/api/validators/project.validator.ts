// External dependencies
import Joi from 'joi'; // v17.9.0

// Internal dependencies
import { IProject } from '../../interfaces/IProject';
import { ValidationError } from '../../utils/errors';
import { validateSchema } from '../../utils/validation';
import { Logger } from '../../utils/logger';

// Initialize logger
const logger = Logger.getInstance();

// Constants
const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/;
const VALIDATION_CACHE_TTL = 300000; // 5 minutes
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

// Cache for validation results
const validationCache = new Map<string, {
  result: boolean;
  timestamp: number;
}>();

/**
 * Enhanced Joi schema for project creation with strict validation rules
 */
const PROJECT_CREATION_SCHEMA = Joi.object({
  name: Joi.string()
    .required()
    .min(3)
    .max(MAX_NAME_LENGTH)
    .pattern(/^[\w\s-]+$/)
    .messages({
      'string.pattern.base': 'Project name must contain only letters, numbers, spaces, and hyphens',
      'string.min': 'Project name must be at least 3 characters long',
      'string.max': `Project name cannot exceed ${MAX_NAME_LENGTH} characters`
    }),

  description: Joi.string()
    .optional()
    .max(MAX_DESCRIPTION_LENGTH)
    .messages({
      'string.max': `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`
    }),

  githubUrl: Joi.string()
    .required()
    .pattern(GITHUB_URL_PATTERN)
    .messages({
      'string.pattern.base': 'Invalid GitHub repository URL format'
    }),

  githubBranch: Joi.string()
    .default('main')
    .pattern(/^[\w.-]+$/)
    .messages({
      'string.pattern.base': 'Invalid branch name format'
    }),

  version: Joi.number()
    .default(1)
    .positive()
    .integer(),

  status: Joi.string()
    .valid('ACTIVE', 'ARCHIVED', 'SYNCING', 'ERROR')
    .default('ACTIVE')
}).strict();

/**
 * Enhanced Joi schema for project updates with partial validation support
 */
const PROJECT_UPDATE_SCHEMA = PROJECT_CREATION_SCHEMA.fork(
  ['name', 'githubUrl'],
  (schema) => schema.optional()
);

/**
 * Validates project data for creation with enhanced security checks and caching
 * @param projectData Partial project data to validate
 * @throws ValidationError if validation fails
 */
export async function validateProjectCreation(
  projectData: Partial<IProject>
): Promise<void> {
  const startTime = performance.now();
  const cacheKey = JSON.stringify(projectData);

  try {
    // Check validation cache
    const cached = validationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < VALIDATION_CACHE_TTL)) {
      if (!cached.result) {
        throw new ValidationError(
          [{ field: 'cached', message: 'Previous validation failure' }],
          'project_creation',
          { cached: true }
        );
      }
      return;
    }

    // Perform schema validation
    await validateSchema(projectData, PROJECT_CREATION_SCHEMA, {
      abortEarly: false,
      cache: true
    });

    // Additional GitHub URL validation
    if (projectData.githubUrl) {
      await validateGithubUrl(projectData.githubUrl);
    }

    // Cache successful validation
    validationCache.set(cacheKey, {
      result: true,
      timestamp: Date.now()
    });

    // Log validation success
    logger.debug('Project creation validation successful', {
      duration: performance.now() - startTime,
      projectName: projectData.name
    });

  } catch (error) {
    // Cache validation failure
    validationCache.set(cacheKey, {
      result: false,
      timestamp: Date.now()
    });

    // Log validation failure
    logger.error('Project creation validation failed', {
      error: error.message,
      duration: performance.now() - startTime,
      projectData: JSON.stringify(projectData)
    });

    throw error;
  }
}

/**
 * Validates project data for updates with partial validation support
 * @param projectData Partial project data to validate
 * @throws ValidationError if validation fails
 */
export async function validateProjectUpdate(
  projectData: Partial<IProject>
): Promise<void> {
  const startTime = performance.now();

  try {
    // Perform schema validation
    await validateSchema(projectData, PROJECT_UPDATE_SCHEMA, {
      abortEarly: false,
      cache: true
    });

    // Additional GitHub URL validation if provided
    if (projectData.githubUrl) {
      await validateGithubUrl(projectData.githubUrl);
    }

    // Log validation success
    logger.debug('Project update validation successful', {
      duration: performance.now() - startTime,
      projectData: JSON.stringify(projectData)
    });

  } catch (error) {
    // Log validation failure
    logger.error('Project update validation failed', {
      error: error.message,
      duration: performance.now() - startTime,
      projectData: JSON.stringify(projectData)
    });

    throw error;
  }
}

/**
 * Validates GitHub URL format and accessibility
 * @param githubUrl GitHub repository URL to validate
 * @returns Promise<boolean> True if URL is valid and accessible
 * @throws ValidationError if validation fails
 */
export async function validateGithubUrl(githubUrl: string): Promise<boolean> {
  const startTime = performance.now();

  try {
    // Basic URL format validation
    if (!GITHUB_URL_PATTERN.test(githubUrl)) {
      throw new ValidationError(
        [{ field: 'githubUrl', message: 'Invalid GitHub repository URL format' }],
        'github_url',
        { url: githubUrl }
      );
    }

    // Extract owner and repo from URL
    const [, owner, repo] = githubUrl.match(/github\.com\/([\w-]+)\/([\w.-]+)/) || [];
    
    if (!owner || !repo) {
      throw new ValidationError(
        [{ field: 'githubUrl', message: 'Unable to extract repository information' }],
        'github_url',
        { url: githubUrl }
      );
    }

    // Log successful validation
    logger.debug('GitHub URL validation successful', {
      duration: performance.now() - startTime,
      url: githubUrl,
      owner,
      repo
    });

    return true;

  } catch (error) {
    // Log validation failure
    logger.error('GitHub URL validation failed', {
      error: error.message,
      duration: performance.now() - startTime,
      url: githubUrl
    });

    throw error;
  }
}