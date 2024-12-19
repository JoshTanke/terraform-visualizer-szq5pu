// External dependencies
import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import jwt from 'jsonwebtoken'; // ^9.0.0
import helmet from 'helmet'; // ^7.0.0

// Internal dependencies
import { authConfig } from '../../config/auth.config';
import { AuthenticationError, AuthorizationError } from '../../utils/errors';
import { Logger } from '../../utils/logger';

// Constants
const TOKEN_BLACKLIST = new Set<string>();
const ROLE_HIERARCHY = {
  admin: ['editor', 'viewer'],
  editor: ['viewer'],
  viewer: []
};

// Types
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    permissions: string[];
    githubToken?: string;
  };
}

/**
 * Enhanced JWT token validation middleware with comprehensive security checks
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const logger = Logger.getInstance();
  const correlationId = req.headers['x-correlation-id'] as string;

  try {
    // Apply security headers
    helmet()(req, res, () => {});

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError(
        'Missing or invalid authorization header',
        'SEC_AUTH_001',
        401,
        { correlationId }
      );
    }

    const token = authHeader.split(' ')[1];

    // Check token blacklist
    if (TOKEN_BLACKLIST.has(token)) {
      throw new AuthenticationError(
        'Token has been revoked',
        'SEC_AUTH_002',
        401,
        { correlationId }
      );
    }

    // Verify token with comprehensive checks
    const decoded = jwt.verify(token, authConfig.jwt.secret, {
      algorithms: [authConfig.jwt.algorithm],
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience,
      clockTolerance: authConfig.jwt.clockTolerance,
      maxAge: authConfig.jwt.maxAge
    }) as jwt.JwtPayload;

    // Check token expiration and refresh requirements
    const tokenAge = Date.now() - (decoded.iat || 0) * 1000;
    const refreshThreshold = parseInt(authConfig.tokens.access.renewThreshold) * 60 * 1000;

    if (tokenAge > refreshThreshold) {
      res.setHeader('X-Token-Refresh-Required', 'true');
    }

    // Attach user data to request
    req.user = {
      id: decoded.sub as string,
      role: decoded.role as string,
      permissions: decoded.permissions as string[],
      githubToken: decoded.githubToken as string
    };

    // Log successful authentication
    logger.info('Authentication successful', {
      userId: req.user.id,
      role: req.user.role,
      correlationId,
      securityEvent: 'authentication'
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.error('JWT validation failed', {
        error: error.message,
        correlationId,
        securityEvent: 'authentication_failure'
      });

      next(new AuthenticationError(
        'Invalid or expired token',
        'SEC_AUTH_003',
        401,
        { correlationId }
      ));
    } else {
      next(error);
    }
  }
};

/**
 * Enhanced role-based authorization middleware factory with hierarchical permissions
 */
export const authorizeRole = (
  allowedRoles: string[],
  options: { requireAll?: boolean; customPermissions?: string[] } = {}
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const logger = Logger.getInstance();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      if (!req.user) {
        throw new AuthorizationError(
          'User not authenticated',
          'SEC_AUTH_004',
          401,
          { correlationId }
        );
      }

      const userRole = req.user.role;
      const hasRole = allowedRoles.some(role => 
        role === userRole || ROLE_HIERARCHY[role]?.includes(userRole)
      );

      if (!hasRole) {
        throw new AuthorizationError(
          'Insufficient permissions',
          'SEC_AUTH_005',
          403,
          { 
            correlationId,
            userRole,
            requiredRoles: allowedRoles
          }
        );
      }

      // Check custom permissions if specified
      if (options.customPermissions?.length) {
        const hasPermissions = options.requireAll
          ? options.customPermissions.every(p => req.user!.permissions.includes(p))
          : options.customPermissions.some(p => req.user!.permissions.includes(p));

        if (!hasPermissions) {
          throw new AuthorizationError(
            'Missing required permissions',
            'SEC_AUTH_006',
            403,
            {
              correlationId,
              requiredPermissions: options.customPermissions
            }
          );
        }
      }

      // Log successful authorization
      logger.info('Authorization successful', {
        userId: req.user.id,
        role: userRole,
        correlationId,
        securityEvent: 'authorization'
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Enhanced GitHub OAuth token validation middleware
 */
export const validateGithubToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const logger = Logger.getInstance();
  const correlationId = req.headers['x-correlation-id'] as string;

  try {
    if (!req.user?.githubToken) {
      throw new AuthenticationError(
        'GitHub token not found',
        'SEC_AUTH_007',
        401,
        { correlationId }
      );
    }

    // Apply security headers for GitHub-related requests
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...authConfig.security.headers,
          'connect-src': ["'self'", 'api.github.com']
        }
      }
    })(req, res, () => {});

    // Verify token scopes and permissions
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${req.user.githubToken}`,
        'User-Agent': authConfig.github.userAgent,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new AuthenticationError(
        'Invalid GitHub token',
        'SEC_AUTH_008',
        401,
        { correlationId }
      );
    }

    // Log successful GitHub authentication
    logger.info('GitHub authentication successful', {
      userId: req.user.id,
      correlationId,
      securityEvent: 'github_authentication'
    });

    next();
  } catch (error) {
    next(error);
  }
};