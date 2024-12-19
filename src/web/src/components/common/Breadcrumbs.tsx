/**
 * @fileoverview Enhanced Breadcrumbs component for hierarchical navigation
 * Implements three-tier navigation system (Pipeline > Environment > Module)
 * with comprehensive accessibility and error handling.
 * @version 1.0.0
 */

import React, { useMemo, useCallback } from 'react'; // v18.x
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography, Skeleton } from '@mui/material'; // v5.x
import { NavigateNext } from '@mui/icons-material'; // v5.x
import { useLocation, useNavigate } from 'react-router-dom'; // v6.x
import { useAuth } from '../../hooks/useAuth';

/**
 * Props interface for the Breadcrumbs component
 */
interface IBreadcrumbsProps {
  /** Optional CSS class name for styling */
  className?: string;
  /** Accessibility label for breadcrumbs navigation */
  ariaLabel?: string;
}

/**
 * Interface for breadcrumb navigation items
 */
interface IBreadcrumbItem {
  /** Display text for the breadcrumb */
  label: string;
  /** Navigation path for the breadcrumb */
  path: string;
  /** Whether this is the current active item */
  active: boolean;
  /** Unique identifier for the breadcrumb */
  key: string;
}

/**
 * Enhanced Breadcrumbs component for hierarchical navigation
 * Implements three-tier navigation with accessibility and error handling
 */
const Breadcrumbs: React.FC<IBreadcrumbsProps> = ({
  className = '',
  ariaLabel = 'Navigation breadcrumbs'
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentProject, isLoading } = useAuth();

  /**
   * Generates breadcrumb items based on current location
   * @param location Current router location
   * @param currentProject Current project context
   * @returns Array of validated breadcrumb items
   */
  const generateBreadcrumbs = useCallback((
    location: string,
    currentProject: any
  ): IBreadcrumbItem[] => {
    try {
      const pathSegments = location.split('/').filter(Boolean);
      const breadcrumbs: IBreadcrumbItem[] = [];

      // Add root/project level
      if (currentProject?.name) {
        breadcrumbs.push({
          label: currentProject.name,
          path: '/pipeline',
          active: pathSegments.length === 1,
          key: 'project'
        });
      }

      // Add environment level if present
      if (pathSegments.includes('environment') && pathSegments.length >= 3) {
        const envName = decodeURIComponent(pathSegments[2]);
        breadcrumbs.push({
          label: envName,
          path: `/environment/${envName}`,
          active: pathSegments.length === 3,
          key: 'environment'
        });
      }

      // Add module level if present
      if (pathSegments.includes('module') && pathSegments.length >= 5) {
        const moduleName = decodeURIComponent(pathSegments[4]);
        breadcrumbs.push({
          label: moduleName,
          path: `/environment/${pathSegments[2]}/module/${moduleName}`,
          active: true,
          key: 'module'
        });
      }

      return breadcrumbs;
    } catch (error) {
      console.error('Error generating breadcrumbs:', error);
      return [];
    }
  }, []);

  /**
   * Memoized breadcrumb items to prevent unnecessary recalculation
   */
  const breadcrumbItems = useMemo(() => 
    generateBreadcrumbs(location.pathname, currentProject),
    [location.pathname, currentProject, generateBreadcrumbs]
  );

  /**
   * Handles breadcrumb navigation with error catching
   * @param path Navigation path
   * @param event Click event
   */
  const handleNavigation = useCallback((
    path: string,
    event: React.MouseEvent<HTMLAnchorElement>
  ) => {
    event.preventDefault();
    try {
      navigate(path);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [navigate]);

  /**
   * Handles keyboard navigation for accessibility
   * @param path Navigation path
   * @param event Keyboard event
   */
  const handleKeyDown = useCallback((
    path: string,
    event: React.KeyboardEvent
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(path);
    }
  }, [navigate]);

  // Show loading skeleton while auth state is loading
  if (isLoading) {
    return (
      <Skeleton
        variant="text"
        width="50%"
        height={40}
        className={className}
        role="progressbar"
        aria-label="Loading breadcrumbs"
      />
    );
  }

  return (
    <MuiBreadcrumbs
      className={className}
      separator={<NavigateNext fontSize="small" />}
      aria-label={ariaLabel}
      sx={{
        '& .MuiBreadcrumbs-ol': {
          flexWrap: 'nowrap',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }}
    >
      {breadcrumbItems.map((item, index) => (
        item.active ? (
          <Typography
            key={item.key}
            color="text.primary"
            aria-current="page"
            sx={{
              fontWeight: 500,
              fontSize: '0.875rem'
            }}
          >
            {item.label}
          </Typography>
        ) : (
          <Link
            key={item.key}
            href={item.path}
            onClick={(e) => handleNavigation(item.path, e)}
            onKeyDown={(e) => handleKeyDown(item.path, e)}
            color="inherit"
            underline="hover"
            sx={{
              fontSize: '0.875rem',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
            tabIndex={0}
            role="link"
          >
            {item.label}
          </Link>
        )
      ))}
    </MuiBreadcrumbs>
  );
};

export default Breadcrumbs;