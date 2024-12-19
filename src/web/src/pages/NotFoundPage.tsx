/**
 * @fileoverview Enhanced 404 Not Found page component with accessibility features,
 * animations, and consistent design system integration.
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { Box, Typography, Button, Fade } from '@mui/material'; // v5.0.0
import { useNavigate, useLocation } from 'react-router-dom'; // v6.0.0
import MainLayout from '../components/layout/MainLayout';
import { error as logError } from '../utils/logger';

/**
 * Enhanced 404 Not Found page component with accessibility features and error tracking
 */
const NotFoundPage: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Handles navigation back to home page
   */
  const handleNavigateHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  /**
   * Log 404 errors for monitoring
   */
  useEffect(() => {
    logError(
      `404 Page Not Found: ${location.pathname}`,
      {
        path: location.pathname,
        search: location.search,
        referrer: document.referrer
      },
      'warn',
      { notify: false }
    );
  }, [location]);

  return (
    <MainLayout>
      <Fade in={true} timeout={800}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: '2rem',
            gap: '2rem',
            textAlign: 'center'
          }}
          role="main"
          aria-labelledby="404-title"
        >
          {/* Error Code */}
          <Typography
            variant="h1"
            component="h1"
            id="404-title"
            sx={{
              fontSize: {
                xs: '4rem',
                sm: '6rem'
              },
              fontWeight: 'bold',
              color: 'error.main',
              marginBottom: '1rem'
            }}
          >
            404
          </Typography>

          {/* Error Message */}
          <Typography
            variant="h4"
            component="h2"
            sx={{
              marginBottom: '2rem',
              maxWidth: '600px'
            }}
          >
            The page you're looking for doesn't exist or has been moved.
          </Typography>

          {/* Helpful Message */}
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              marginBottom: '2rem',
              maxWidth: '600px'
            }}
          >
            Please check the URL or navigate back to the home page to continue
            exploring the Terraform Visualization Tool.
          </Typography>

          {/* Navigation Button */}
          <Button
            variant="contained"
            color="primary"
            onClick={handleNavigateHome}
            size="large"
            sx={{
              marginTop: '1rem',
              minWidth: '200px'
            }}
            aria-label="Return to home page"
          >
            Return to Home
          </Button>
        </Box>
      </Fade>
    </MainLayout>
  );
});

NotFoundPage.displayName = 'NotFoundPage';

export default NotFoundPage;