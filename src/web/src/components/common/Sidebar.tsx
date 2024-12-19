/**
 * @fileoverview Collapsible sidebar navigation component with responsive behavior,
 * theme integration, and accessibility support.
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useEffect } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
  Box,
  Typography
} from '@mui/material'; // v5.0.0
import {
  AccountTree,
  Storage,
  Code,
  Settings,
  ChevronLeft
} from '@mui/icons-material'; // v5.0.0
import { useNavigate, useLocation } from 'react-router-dom'; // v6.0.0
import useAuth from '../../hooks/useAuth';
import useSettings from '../../hooks/useSettings';

/**
 * Props interface for the Sidebar component
 */
export interface ISidebarProps {
  open: boolean;
  onClose: () => void;
  width: number;
}

/**
 * Navigation items configuration with proper typing
 */
const NAVIGATION_ITEMS = [
  {
    path: '/pipeline',
    label: 'Pipeline View',
    icon: AccountTree,
    description: 'View and manage deployment pipelines',
    requiredPermission: 'read'
  },
  {
    path: '/environments',
    label: 'Environments',
    icon: Storage,
    description: 'Manage infrastructure environments',
    requiredPermission: 'read'
  },
  {
    path: '/modules',
    label: 'Modules',
    icon: Code,
    description: 'Browse and edit Terraform modules',
    requiredPermission: 'read'
  }
] as const;

/**
 * Sidebar component implementing collapsible navigation with accessibility support
 */
const Sidebar: React.FC<ISidebarProps> = ({ open, onClose, width }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isAuthenticated, checkPermission } = useAuth();
  const { settings } = useSettings();

  // Memoized styles based on theme and settings
  const styles = useMemo(() => ({
    drawer: {
      width,
      flexShrink: 0,
      '& .MuiDrawer-paper': {
        width,
        boxSizing: 'border-box',
        backgroundColor: settings.theme.customTheme.surface,
        color: settings.theme.customTheme.text,
        borderRight: `1px solid ${settings.theme.customTheme.border}`
      }
    },
    listItem: {
      marginBottom: theme.spacing(1),
      borderRadius: theme.shape.borderRadius,
      '&:hover': {
        backgroundColor: settings.theme.customTheme.hover
      },
      '&.Mui-selected': {
        backgroundColor: settings.theme.customTheme.active,
        '&:hover': {
          backgroundColor: settings.theme.customTheme.active
        }
      }
    },
    icon: {
      color: settings.theme.customTheme.text
    },
    divider: {
      backgroundColor: settings.theme.customTheme.border
    }
  }), [theme, settings.theme.customTheme, width]);

  /**
   * Enhanced navigation handler with validation and analytics
   */
  const handleNavigation = useCallback((path: string) => {
    if (!isAuthenticated) {
      console.warn('User not authenticated, redirecting to login');
      navigate('/login');
      return;
    }

    // Track navigation event
    try {
      // Analytics tracking would go here
      console.debug(`Navigating to: ${path}`);
    } catch (error) {
      console.error('Navigation tracking error:', error);
    }

    navigate(path);
    if (isMobile) {
      onClose();
    }
  }, [isAuthenticated, navigate, isMobile, onClose]);

  // Setup keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      open={open}
      onClose={onClose}
      sx={styles.drawer}
      aria-label="Navigation sidebar"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: theme.spacing(2)
        }}
      >
        <Typography variant="h6" component="h1">
          Terraform Visualizer
        </Typography>
        {isMobile && (
          <IconButton onClick={onClose} aria-label="Close sidebar">
            <ChevronLeft />
          </IconButton>
        )}
      </Box>

      <Divider sx={styles.divider} />

      <List component="nav" aria-label="Main navigation">
        {NAVIGATION_ITEMS.map(({ path, label, icon: Icon, description, requiredPermission }) => {
          const isSelected = location.pathname === path;
          const hasPermission = checkPermission(requiredPermission);

          return (
            <Tooltip
              key={path}
              title={hasPermission ? description : 'Insufficient permissions'}
              placement="right"
              arrow
            >
              <ListItem
                button
                selected={isSelected}
                onClick={() => hasPermission && handleNavigation(path)}
                sx={styles.listItem}
                disabled={!hasPermission}
                aria-current={isSelected ? 'page' : undefined}
              >
                <ListItemIcon sx={styles.icon}>
                  <Icon />
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  primaryTypographyProps={{
                    variant: 'body1',
                    color: 'inherit'
                  }}
                />
              </ListItem>
            </Tooltip>
          );
        })}
      </List>

      <Divider sx={styles.divider} />

      <List>
        <ListItem
          button
          onClick={() => handleNavigation('/settings')}
          sx={styles.listItem}
        >
          <ListItemIcon sx={styles.icon}>
            <Settings />
          </ListItemIcon>
          <ListItemText
            primary="Settings"
            primaryTypographyProps={{
              variant: 'body1',
              color: 'inherit'
            }}
          />
        </ListItem>
      </List>
    </Drawer>
  );
};

export default Sidebar;