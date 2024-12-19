/**
 * @fileoverview Secure route protection component with role-based access control
 * Implements comprehensive authentication validation and security measures
 * following OWASP security guidelines.
 * @version 1.0.0
 */

import React, { FC, useEffect, useMemo } from 'react'; // v18.x
import { Navigate, useLocation } from 'react-router-dom'; // v6.x
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { UserRole } from '../../interfaces/IAuth';

/**
 * Props interface for the PrivateRoute component
 */
interface PrivateRouteProps {
  /** Protected component to render if authenticated and authorized */
  element: React.ReactElement;
  /** Optional role requirement for granular access control */
  requiredRole?: UserRole;
  /** Optional custom redirect path for unauthorized access */
  redirectPath?: string;
}

/**
 * Higher-order component that provides secure route protection with role-based
 * access control and comprehensive security validations.
 *
 * @param props - Component properties
 * @returns Protected route component, redirect, or loading indicator
 */
export const PrivateRoute: FC<PrivateRouteProps> = ({
  element,
  requiredRole,
  redirectPath = '/login'
}) => {
  // Get authentication state and user role from auth hook
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  // Cache role validation result for performance
  const isAuthorized = useMemo(() => {
    if (!requiredRole || !user) return true;
    
    // Admin role has access to everything
    if (user.role === UserRole.ADMIN) return true;
    
    // Check specific role requirements
    switch (requiredRole) {
      case UserRole.ADMIN:
        return user.role === UserRole.ADMIN;
      case UserRole.EDITOR:
        return user.role === UserRole.ADMIN || user.role === UserRole.EDITOR;
      case UserRole.VIEWER:
        return true; // All authenticated users can view
      default:
        return false;
    }
  }, [requiredRole, user]);

  // Effect for security audit logging
  useEffect(() => {
    if (!isAuthenticated || !isAuthorized) {
      console.warn(
        `Access denied to ${location.pathname}`,
        {
          timestamp: new Date().toISOString(),
          path: location.pathname,
          requiredRole,
          userRole: user?.role,
          isAuthenticated,
          isAuthorized
        }
      );
    }
  }, [isAuthenticated, isAuthorized, location.pathname, requiredRole, user?.role]);

  // Show loading spinner while authentication state is being determined
  if (loading) {
    return (
      <LoadingSpinner 
        size={40}
        message="Verifying authentication..."
      />
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Preserve attempted URL for post-login redirect
    const loginRedirect = `${redirectPath}?redirect=${encodeURIComponent(
      location.pathname + location.search
    )}`;
    
    return <Navigate to={loginRedirect} state={{ from: location }} replace />;
  }

  // Check role-based authorization
  if (!isAuthorized) {
    // Redirect to unauthorized page if role check fails
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  // Render protected component if all security checks pass
  return element;
};

export default PrivateRoute;