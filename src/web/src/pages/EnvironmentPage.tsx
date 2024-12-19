/**
 * @fileoverview React page component that serves as the container for the environment-level visualization view.
 * Manages environment state, routing, real-time updates, and error handling.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Alert } from '@mui/material';

import MainLayout from '../components/layout/MainLayout';
import EnvironmentView from '../components/views/EnvironmentView';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorBoundary from '../components/common/ErrorBoundary';
import useAuth from '../hooks/useAuth';

/**
 * EnvironmentPage - Container component for the environment visualization view
 * with comprehensive error handling and real-time updates.
 */
const EnvironmentPage: React.FC = () => {
  // Initialize hooks
  const { environmentId } = useParams<{ environmentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, checkPermission } = useAuth();

  // Local state management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates user access and environment ID
   */
  useEffect(() => {
    const validateAccess = async () => {
      try {
        // Check authentication
        if (!isAuthenticated) {
          navigate('/login', { state: { from: location } });
          return;
        }

        // Check environment ID
        if (!environmentId) {
          throw new Error('Environment ID is required');
        }

        // Check permissions
        if (!checkPermission('read')) {
          throw new Error('Insufficient permissions to view environment');
        }

        setIsLoading(false);
      } catch (error) {
        setError((error as Error).message);
        setIsLoading(false);
      }
    };

    validateAccess();
  }, [isAuthenticated, environmentId, navigate, location, checkPermission]);

  /**
   * Handles errors from child components
   */
  const handleError = useCallback((error: Error) => {
    console.error('Environment view error:', error);
    setError(error.message);

    // Update ARIA live region for accessibility
    const liveRegion = document.getElementById('error-announcer');
    if (liveRegion) {
      liveRegion.textContent = `Error: ${error.message}`;
    }
  }, []);

  /**
   * Handles navigation back to environments list
   */
  const handleBackToList = useCallback(() => {
    navigate('/environments');
  }, [navigate]);

  // Show loading state
  if (isLoading) {
    return (
      <MainLayout>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%'
          }}
        >
          <LoadingSpinner
            size={40}
            message="Loading environment visualization..."
          />
        </Box>
      </MainLayout>
    );
  }

  // Show error state
  if (error) {
    return (
      <MainLayout>
        <Box
          sx={{
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <Alert
            severity="error"
            sx={{ mb: 2, width: '100%', maxWidth: 600 }}
          >
            <Typography variant="h6" component="h1" gutterBottom>
              Error Loading Environment
            </Typography>
            <Typography>{error}</Typography>
          </Alert>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <ErrorBoundary
        onError={handleError}
        fallback={
          <Box
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <Alert severity="error" sx={{ width: '100%', maxWidth: 600 }}>
              <Typography variant="h6" component="h1" gutterBottom>
                Visualization Error
              </Typography>
              <Typography>
                An error occurred while rendering the environment visualization.
                Please try refreshing the page.
              </Typography>
            </Alert>
          </Box>
        }
      >
        <EnvironmentView
          environmentId={environmentId!}
          onError={handleError}
        />
      </ErrorBoundary>

      {/* Accessibility enhancements */}
      <div
        id="error-announcer"
        role="alert"
        aria-live="assertive"
        className="sr-only"
      />
    </MainLayout>
  );
};

export default EnvironmentPage;