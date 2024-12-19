/**
 * @fileoverview React page component for the pipeline visualization view
 * Implements the high-level infrastructure visualization with authentication,
 * error handling, and performance monitoring.
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';

// Internal components and hooks
import MainLayout from '../components/layout/MainLayout';
import PipelineView from '../components/views/PipelineView';
import useAuth from '../hooks/useAuth';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * PipelinePage component implementing the pipeline visualization view with
 * authentication, error handling, and performance monitoring.
 */
const PipelinePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading, error: authError } = useAuth();

  /**
   * Handles pipeline view errors with logging and user feedback
   */
  const handleError = useCallback((error: Error) => {
    logger.log('Pipeline view error', { error }, 'error', { 
      component: 'PipelinePage',
      notify: true 
    });
  }, []);

  /**
   * Effect to handle authentication state
   */
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      logger.log('Unauthorized access attempt to pipeline view', {}, 'warn');
      navigate('/login', { 
        replace: true,
        state: { from: '/pipeline' }
      });
    }
  }, [isAuthenticated, loading, navigate]);

  /**
   * Renders loading state during authentication
   */
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: 'background.default'
        }}
      >
        <CircularProgress
          size={40}
          aria-label="Authenticating user"
        />
      </Box>
    );
  }

  /**
   * Renders authentication error state
   */
  if (authError) {
    return (
      <Box
        sx={{
          maxWidth: '600px',
          margin: 'auto',
          marginTop: '24px',
          padding: '24px'
        }}
      >
        <Alert 
          severity="error"
          sx={{ marginBottom: 2 }}
        >
          <Typography variant="h6" gutterBottom>
            Authentication Error
          </Typography>
          <Typography>
            {authError}. Please try logging in again.
          </Typography>
        </Alert>
      </Box>
    );
  }

  /**
   * Renders main pipeline view for authenticated users
   */
  return (
    <MainLayout>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: '100vh',
          overflow: 'hidden',
          backgroundColor: 'background.default'
        }}
        role="main"
        aria-label="Pipeline visualization page"
      >
        {isAuthenticated && (
          <PipelineView
            projectId={window.location.pathname.split('/').pop() || ''}
            onError={handleError}
          />
        )}
      </Box>
    </MainLayout>
  );
};

export default PipelinePage;