/**
 * @fileoverview React component implementing the project details page with GitHub
 * synchronization, environment management, and real-time updates.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  Alert, 
  Skeleton 
} from '@mui/material';
import { 
  Sync as SyncIcon, 
  Error as ErrorIcon, 
  Refresh as RefreshIcon 
} from '@mui/icons-material';
import { debounce } from 'lodash';

import MainLayout from '../components/layout/MainLayout';
import { IProject } from '../interfaces/IProject';
import { ApiService } from '../services/api.service';
import { useAuth } from '../hooks/useAuth';
import { getLogger } from '../utils/logger';
import { handleApiError } from '../utils/errorHandling';

// Constants for performance optimization
const SYNC_DEBOUNCE_MS = 1000;
const REFRESH_INTERVAL_MS = 30000;
const ERROR_DISPLAY_DURATION = 5000;

/**
 * Interface for project page URL parameters
 */
interface ProjectPageParams {
  projectId: string;
}

/**
 * Interface for project operation errors
 */
interface ProjectError {
  code: string;
  message: string;
  details?: any;
}

/**
 * ProjectPage component implementing project management functionality
 */
const ProjectPage: React.FC = () => {
  // Router and navigation hooks
  const { projectId } = useParams<ProjectPageParams>();
  const navigate = useNavigate();
  const location = useLocation();

  // Authentication and services
  const { isAuthenticated, checkPermission } = useAuth();
  const apiService = useRef(new ApiService());
  const logger = useRef(getLogger());

  // Component state
  const [project, setProject] = useState<IProject | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ProjectError | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Refs for cleanup and async operation handling
  const refreshInterval = useRef<NodeJS.Timeout>();
  const errorTimeout = useRef<NodeJS.Timeout>();

  /**
   * Fetches project data with retry mechanism
   */
  const fetchProjectData = useCallback(async () => {
    if (!projectId || !isAuthenticated) return;

    try {
      setLoading(true);
      const projectData = await apiService.current.getProject(projectId);
      setProject(projectData);
      setError(null);
      setRetryCount(0);

      // Log successful fetch
      logger.current.log('Project data fetched successfully', {
        projectId,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      const error = await handleApiError(err as Error, {
        projectId,
        retryCount,
        component: 'ProjectPage'
      });

      setError({
        code: error.type,
        message: error.message,
        details: error.context
      });

      // Implement exponential backoff for retries
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchProjectData();
        }, Math.pow(2, retryCount) * 1000);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, isAuthenticated, retryCount]);

  /**
   * Handles GitHub synchronization with debouncing and progress tracking
   */
  const handleSync = useCallback(
    debounce(async () => {
      if (!project || !checkPermission('write')) return;

      try {
        setSyncing(true);
        setSyncProgress(0);

        const syncStartTime = Date.now();
        await apiService.current.syncWithGitHub(project.id);

        // Update sync progress
        const progressInterval = setInterval(() => {
          setSyncProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 500);

        // Refresh project data after sync
        await fetchProjectData();
        setSyncProgress(100);

        // Log sync completion
        logger.current.log('Project sync completed', {
          projectId: project.id,
          duration: Date.now() - syncStartTime
        });

      } catch (err) {
        const error = await handleApiError(err as Error, {
          projectId: project.id,
          operation: 'sync'
        });
        setError({
          code: 'SYNC_ERROR',
          message: 'Failed to sync with GitHub',
          details: error.context
        });
      } finally {
        setSyncing(false);
        setSyncProgress(0);
      }
    }, SYNC_DEBOUNCE_MS),
    [project, checkPermission, fetchProjectData]
  );

  /**
   * Sets up periodic data refresh and cleanup
   */
  useEffect(() => {
    if (!loading && project) {
      refreshInterval.current = setInterval(fetchProjectData, REFRESH_INTERVAL_MS);
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
      if (errorTimeout.current) {
        clearTimeout(errorTimeout.current);
      }
    };
  }, [loading, project, fetchProjectData]);

  /**
   * Initial data fetch
   */
  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  /**
   * Error display timeout handler
   */
  useEffect(() => {
    if (error) {
      errorTimeout.current = setTimeout(() => {
        setError(null);
      }, ERROR_DISPLAY_DURATION);
    }
    return () => {
      if (errorTimeout.current) {
        clearTimeout(errorTimeout.current);
      }
    };
  }, [error]);

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        {/* Header Section */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 3 
          }}
        >
          {loading ? (
            <Skeleton width={300} height={40} />
          ) : (
            <Typography variant="h4" component="h1">
              {project?.name || 'Project Details'}
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => fetchProjectData()}
              disabled={loading}
              aria-label="Refresh project data"
            >
              Refresh
            </Button>

            <Button
              variant="contained"
              startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
              onClick={() => handleSync()}
              disabled={syncing || !checkPermission('write')}
              aria-label="Sync with GitHub"
            >
              {syncing ? `Syncing ${syncProgress}%` : 'Sync with GitHub'}
            </Button>
          </Box>
        </Box>

        {/* Error Display */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            action={
              <Button 
                color="inherit" 
                size="small"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            }
          >
            <Typography variant="subtitle2">{error.message}</Typography>
            {error.details && (
              <Typography variant="caption" display="block">
                Error Code: {error.code}
              </Typography>
            )}
          </Alert>
        )}

        {/* Project Content */}
        {loading ? (
          <Box sx={{ mt: 3 }}>
            <Skeleton variant="rectangular" height={200} />
            <Box sx={{ mt: 2 }}>
              <Skeleton width="60%" height={30} />
              <Skeleton width="40%" height={30} />
            </Box>
          </Box>
        ) : project ? (
          <Box>
            {/* Project Details */}
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              Repository: {project.githubUrl}
            </Typography>
            <Typography variant="body1" paragraph>
              {project.description}
            </Typography>

            {/* Last Sync Status */}
            <Typography variant="caption" display="block" sx={{ mb: 3 }}>
              Last synced: {project.lastSyncedAt 
                ? new Date(project.lastSyncedAt).toLocaleString()
                : 'Never'}
            </Typography>

            {/* Environments List */}
            {/* Environment components would be rendered here */}
          </Box>
        ) : (
          <Alert severity="info">
            No project data available
          </Alert>
        )}
      </Box>
    </MainLayout>
  );
};

export default ProjectPage;