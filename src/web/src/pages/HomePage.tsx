/**
 * @fileoverview Enhanced home page component for the Terraform Visualization Tool
 * Implements secure authentication flow, accessibility features, and responsive design
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { Box, Typography, Container, Paper, Alert, CircularProgress } from '@mui/material';
import { useNavigate, Navigate } from 'react-router-dom';
import { useMonitoring } from '@monitoring/client';

import MainLayout from '../components/layout/MainLayout';
import GithubLogin from '../components/auth/GithubLogin';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * Enhanced home page component with comprehensive authentication handling,
 * security features, and accessibility compliance.
 */
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { startView, endView } = useMonitoring();
  const {
    isAuthenticated,
    user,
    isLoading,
    error,
    validateSession,
    checkPermission
  } = useAuth();

  /**
   * Monitors session activity and validates authentication
   */
  useEffect(() => {
    startView('HomePage');
    
    // Validate session on mount
    if (isAuthenticated && !validateSession()) {
      navigate('/login');
    }

    return () => {
      endView('HomePage');
    };
  }, [isAuthenticated, validateSession, navigate, startView, endView]);

  /**
   * Handles GitHub login errors with enhanced error reporting
   */
  const handleLoginError = useCallback((error: Error) => {
    console.error('Login failed:', error);
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default'
        }}
      >
        <LoadingSpinner 
          size={40}
          message="Initializing application..."
        />
      </Box>
    );
  }

  // Redirect authenticated users to projects page
  if (isAuthenticated && user) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <MainLayout>
      <Container
        maxWidth="lg"
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: theme => theme.spacing(4)
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: theme => theme.spacing(4),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 600,
            width: '100%',
            borderRadius: theme => theme.shape.borderRadius,
            bgcolor: 'background.paper'
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            align="center"
            sx={{
              fontWeight: theme => theme.typography.fontWeightBold,
              color: 'text.primary',
              mb: 4
            }}
          >
            Welcome to Terraform Visualizer
          </Typography>

          <Typography
            variant="body1"
            align="center"
            sx={{
              color: 'text.secondary',
              mb: 4,
              maxWidth: '80%'
            }}
          >
            Visualize and manage your Terraform infrastructure with an intuitive,
            interactive interface. Sign in with GitHub to get started.
          </Typography>

          {error && (
            <Alert 
              severity="error"
              sx={{ width: '100%', mb: 2 }}
            >
              {error}
            </Alert>
          )}

          <GithubLogin
            onLoginError={handleLoginError}
          />

          <Typography
            variant="caption"
            align="center"
            sx={{
              mt: 4,
              color: 'text.secondary'
            }}
          >
            By signing in, you agree to our Terms of Service and Privacy Policy
          </Typography>
        </Paper>
      </Container>
    </MainLayout>
  );
};

export default HomePage;