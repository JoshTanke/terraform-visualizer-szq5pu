/**
 * @fileoverview Custom React hook for secure authentication management
 * Implements comprehensive authentication state and operations with
 * automatic token refresh, GitHub OAuth handling, and role-based access control.
 * @version 1.0.0
 */

import { useEffect, useCallback } from 'react'; // v18.x
import { useDispatch, useSelector } from 'react-redux'; // v8.x
import { IAuthState, IUser, IToken } from '../interfaces/IAuth';
import AuthService from '../services/auth.service';
import {
  loginWithGithub,
  handleAuthCallback,
  refreshAuthToken,
  logout,
  updateSessionActivity,
  selectAuth
} from '../store/authSlice';

// Security constants
const ACTIVITY_UPDATE_INTERVAL = 60000; // 1 minute
const SESSION_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Custom hook providing secure authentication functionality
 * Implements comprehensive auth state management with security features
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const auth = useSelector(selectAuth);

  /**
   * Initiates secure GitHub OAuth login flow
   * @throws {Error} If login attempt is rate-limited or fails
   */
  const login = useCallback(async () => {
    try {
      await dispatch(loginWithGithub()).unwrap();
    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  }, [dispatch]);

  /**
   * Handles GitHub OAuth callback with security validation
   * @param code - OAuth authorization code
   * @param state - CSRF protection state
   * @throws {Error} If callback validation fails
   */
  const handleGithubCallback = useCallback(
    async (code: string, state: string) => {
      try {
        await dispatch(
          handleAuthCallback({
            code,
            state,
            scope: '',
            error: null,
            error_description: null
          })
        ).unwrap();
      } catch (error: any) {
        console.error('OAuth callback failed:', error);
        throw new Error(error.message || 'OAuth authentication failed');
      }
    },
    [dispatch]
  );

  /**
   * Validates user session with security checks
   * @returns {boolean} Session validity status
   */
  const validateSession = useCallback((): boolean => {
    if (!auth.isAuthenticated || !auth.token) {
      return false;
    }

    const now = Date.now();
    const sessionValid = now < auth.sessionExpiry;
    const activityValid =
      now - auth.lastActivity < AuthService['_sessionTracker'].lastActivity;

    return sessionValid && activityValid;
  }, [auth.isAuthenticated, auth.token, auth.sessionExpiry, auth.lastActivity]);

  /**
   * Checks user permission for specific action
   * @param permission - Required permission to check
   * @returns {boolean} Permission status
   */
  const checkPermission = useCallback(
    (permission: string): boolean => {
      if (!auth.isAuthenticated || !auth.user) {
        return false;
      }

      // Admin role has all permissions
      if (auth.user.role === 'ADMIN') {
        return true;
      }

      return auth.user.role === 'EDITOR'
        ? ['read', 'write'].includes(permission)
        : permission === 'read';
    },
    [auth.isAuthenticated, auth.user]
  );

  /**
   * Performs secure logout with cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      await dispatch(logout()).unwrap();
    } catch (error: any) {
      console.error('Logout failed:', error);
      throw new Error(error.message || 'Logout failed');
    }
  }, [dispatch]);

  // Set up session monitoring and activity tracking
  useEffect(() => {
    let activityInterval: NodeJS.Timeout;
    let sessionInterval: NodeJS.Timeout;

    if (auth.isAuthenticated) {
      // Update activity timestamp periodically
      activityInterval = setInterval(() => {
        dispatch(updateSessionActivity());
      }, ACTIVITY_UPDATE_INTERVAL);

      // Check session validity periodically
      sessionInterval = setInterval(() => {
        if (!validateSession()) {
          handleLogout();
        }
      }, SESSION_CHECK_INTERVAL);

      // Set up activity listeners
      const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      const handleActivity = () => dispatch(updateSessionActivity());
      
      activityEvents.forEach(event => {
        window.addEventListener(event, handleActivity);
      });

      return () => {
        clearInterval(activityInterval);
        clearInterval(sessionInterval);
        activityEvents.forEach(event => {
          window.removeEventListener(event, handleActivity);
        });
      };
    }
  }, [auth.isAuthenticated, dispatch, validateSession, handleLogout]);

  return {
    // Authentication state
    isAuthenticated: auth.isAuthenticated,
    user: auth.user as IUser | null,
    token: auth.token as IToken | null,
    loading: auth.loading,
    error: auth.error,

    // User role and permissions
    role: auth.user?.role || null,
    permissions: auth.user?.role === 'ADMIN' 
      ? ['read', 'write', 'admin']
      : auth.user?.role === 'EDITOR'
        ? ['read', 'write']
        : ['read'],

    // Authentication methods
    login,
    logout: handleLogout,
    handleGithubCallback,
    checkPermission,
    validateSession
  };
};

export default useAuth;