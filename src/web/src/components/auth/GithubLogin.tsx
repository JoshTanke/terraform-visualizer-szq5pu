/**
 * @fileoverview Secure GitHub OAuth login component with enhanced security measures
 * Implements comprehensive error handling, rate limiting, and accessibility features
 * following OWASP security guidelines and WCAG 2.1 Level AA standards.
 * @version 1.0.0
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Button, CircularProgress, Alert, Box } from '@mui/material'; // v5.x
import { GitHub as GitHubIcon } from '@mui/icons-material'; // v5.x
import { useAuth } from '../../hooks/useAuth';

// Rate limiting configuration
const RATE_LIMIT = {
  MAX_ATTEMPTS: 3,
  WINDOW_MS: 60000, // 1 minute
  COOLDOWN_MS: 300000 // 5 minutes
};

interface GithubLoginProps {
  className?: string;
  onLoginStart?: () => void;
  onLoginError?: (error: Error) => void;
}

/**
 * Secure GitHub login component with comprehensive security features
 * Implements OAuth flow with PKCE, rate limiting, and accessibility
 */
const GithubLogin: React.FC<GithubLoginProps> = ({
  className,
  onLoginStart,
  onLoginError
}) => {
  const { login, loading, error } = useAuth();
  const [attempts, setAttempts] = useState<number>(0);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [localError, setLocalError] = useState<string | null>(null);

  /**
   * Reset rate limiting after cooldown period
   */
  useEffect(() => {
    if (cooldownUntil > 0 && Date.now() >= cooldownUntil) {
      setAttempts(0);
      setCooldownUntil(0);
      setLocalError(null);
    }
  }, [cooldownUntil]);

  /**
   * Securely handle GitHub login with rate limiting and error handling
   * @param event - Click event
   */
  const handleLogin = useCallback(async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();

    // Check rate limiting
    if (Date.now() < cooldownUntil) {
      const remainingTime = Math.ceil((cooldownUntil - Date.now()) / 1000);
      setLocalError(`Too many attempts. Please try again in ${remainingTime} seconds.`);
      return;
    }

    if (attempts >= RATE_LIMIT.MAX_ATTEMPTS) {
      setCooldownUntil(Date.now() + RATE_LIMIT.COOLDOWN_MS);
      setLocalError('Too many login attempts. Please try again later.');
      return;
    }

    try {
      setLocalError(null);
      onLoginStart?.();
      
      // Increment attempt counter
      setAttempts(prev => prev + 1);
      
      // Initiate secure GitHub OAuth flow
      await login();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setLocalError(errorMessage);
      onLoginError?.(error instanceof Error ? error : new Error(errorMessage));
      
      // Log security event
      console.error('GitHub login error:', {
        timestamp: new Date().toISOString(),
        attempts,
        error: errorMessage
      });
    }
  }, [login, attempts, cooldownUntil, onLoginStart, onLoginError]);

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        alignItems: 'center'
      }}
    >
      {/* Error Display */}
      {(error || localError) && (
        <Alert 
          severity="error"
          role="alert"
          sx={{ width: '100%' }}
        >
          {localError || error}
        </Alert>
      )}

      {/* Login Button */}
      <Button
        variant="contained"
        color="primary"
        onClick={handleLogin}
        disabled={loading || Date.now() < cooldownUntil}
        startIcon={loading ? <CircularProgress size={20} /> : <GitHubIcon />}
        aria-label="Sign in with GitHub"
        aria-busy={loading}
        aria-disabled={loading || Date.now() < cooldownUntil}
        sx={{
          minWidth: 200,
          position: 'relative',
          '&:disabled': {
            backgroundColor: 'action.disabledBackground',
            cursor: 'not-allowed'
          }
        }}
      >
        {loading ? 'Signing in...' : 'Sign in with GitHub'}
      </Button>

      {/* Rate Limit Warning */}
      {attempts > 0 && attempts < RATE_LIMIT.MAX_ATTEMPTS && (
        <Alert 
          severity="warning"
          sx={{ width: '100%' }}
        >
          {`${RATE_LIMIT.MAX_ATTEMPTS - attempts} login attempts remaining`}
        </Alert>
      )}
    </Box>
  );
};

export default GithubLogin;