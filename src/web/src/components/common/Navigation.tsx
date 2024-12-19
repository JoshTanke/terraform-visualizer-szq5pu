/**
 * @fileoverview Enhanced Navigation component with comprehensive security features
 * Implements secure navigation controls, GitHub integration, and user profile management
 * following OWASP security guidelines and WCAG 2.1 Level AA standards.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  CircularProgress
} from '@mui/material'; // v5.0.0
import {
  Settings,
  Help,
  AccountCircle,
  Security
} from '@mui/icons-material'; // v5.0.0
import { useNavigate } from 'react-router-dom'; // v6.0.0
import Breadcrumbs from './Breadcrumbs';
import GithubLogin from '../auth/GithubLogin';
import useAuth from '../../hooks/useAuth';

/**
 * Props interface for the Navigation component
 */
interface INavigationProps {
  /** Handler for settings button click */
  onSettingsClick: () => void;
  /** Handler for help button click */
  onHelpClick: () => void;
}

/**
 * Internal state interface for Navigation component
 */
interface INavigationState {
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error state for operation failures */
  error: string | null;
}

/**
 * Enhanced Navigation component with security features and accessibility
 * Implements secure user session management and navigation controls
 */
const Navigation: React.FC<INavigationProps> = memo(({
  onSettingsClick,
  onHelpClick
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, validateSession } = useAuth();
  
  // Local state management
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [state, setState] = useState<INavigationState>({
    isLoading: false,
    error: null
  });

  /**
   * Validates session on component mount and sets up interval check
   */
  useEffect(() => {
    const validateUserSession = async () => {
      try {
        if (isAuthenticated && !validateSession()) {
          await handleLogout();
        }
      } catch (error) {
        console.error('Session validation error:', error);
      }
    };

    validateUserSession();
    const interval = setInterval(validateUserSession, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, validateSession]);

  /**
   * Secure handler for user menu click with session validation
   */
  const handleUserMenuClick = useCallback(async (
    event: React.MouseEvent<HTMLElement>
  ) => {
    try {
      if (!validateSession()) {
        await handleLogout();
        return;
      }
      setAnchorEl(event.currentTarget);
    } catch (error) {
      console.error('Menu click error:', error);
      setState(prev => ({ ...prev, error: 'Session validation failed' }));
    }
  }, [validateSession]);

  /**
   * Secure handler for user menu close
   */
  const handleUserMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  /**
   * Secure handler for user logout with cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      await logout();
      setAnchorEl(null);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      setState(prev => ({
        ...prev,
        error: 'Logout failed. Please try again.'
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [logout, navigate]);

  /**
   * Secure handler for security settings
   */
  const handleSecuritySettings = useCallback(() => {
    if (validateSession()) {
      setAnchorEl(null);
      navigate('/security-settings');
    }
  }, [navigate, validateSession]);

  return (
    <AppBar 
      position="fixed"
      sx={{
        zIndex: theme => theme.zIndex.drawer + 1,
        backgroundColor: 'background.paper',
        color: 'text.primary'
      }}
    >
      <Toolbar>
        {/* Application Title */}
        <Typography
          variant="h6"
          component="h1"
          sx={{
            flexGrow: 0,
            marginRight: 3,
            fontWeight: 600
          }}
        >
          Terraform Visualizer
        </Typography>

        {/* Enhanced Breadcrumbs Navigation */}
        <Breadcrumbs
          className="navigation-breadcrumbs"
          ariaLabel="Application navigation"
        />

        <div style={{ flexGrow: 1 }} />

        {/* Action Buttons */}
        <IconButton
          aria-label="Help"
          onClick={onHelpClick}
          sx={{ marginRight: 1 }}
        >
          <Help />
        </IconButton>

        <IconButton
          aria-label="Settings"
          onClick={onSettingsClick}
          sx={{ marginRight: 2 }}
        >
          <Settings />
        </IconButton>

        {/* Authentication Section */}
        {isAuthenticated ? (
          <>
            <IconButton
              aria-label="User account"
              aria-controls="user-menu"
              aria-haspopup="true"
              onClick={handleUserMenuClick}
              disabled={state.isLoading}
            >
              {user?.avatarUrl ? (
                <Avatar
                  src={user.avatarUrl}
                  alt={user.username}
                  sx={{ width: 32, height: 32 }}
                />
              ) : (
                <AccountCircle />
              )}
            </IconButton>

            <Menu
              id="user-menu"
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleUserMenuClose}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right'
              }}
            >
              <MenuItem disabled>
                <Typography variant="body2" color="textSecondary">
                  {user?.email}
                </Typography>
              </MenuItem>
              
              <MenuItem onClick={handleSecuritySettings}>
                <Security sx={{ marginRight: 1 }} />
                Security Settings
              </MenuItem>

              <MenuItem
                onClick={handleLogout}
                disabled={state.isLoading}
              >
                {state.isLoading ? (
                  <CircularProgress size={20} sx={{ marginRight: 1 }} />
                ) : null}
                Sign Out
              </MenuItem>
            </Menu>
          </>
        ) : (
          <GithubLogin
            onLoginError={(error) => {
              setState(prev => ({ ...prev, error: error.message }));
            }}
          />
        )}
      </Toolbar>
    </AppBar>
  );
});

Navigation.displayName = 'Navigation';

export default Navigation;