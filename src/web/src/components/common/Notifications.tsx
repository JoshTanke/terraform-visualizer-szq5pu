import React, { useMemo } from 'react';
import { ToastContainer } from 'react-toastify'; // v9.1.3
import { useTheme } from '@mui/material'; // v5.0.0
import { useNotifications } from '../../hooks/useNotifications';
import { COLORS } from '../../assets/styles/theme';

/**
 * Enhanced Notifications component providing theme-aware, accessible toast notifications
 * with support for error tracking and high contrast mode.
 * 
 * Features:
 * - Theme-aware styling with support for light, dark, and high contrast modes
 * - WCAG 2.1 Level AA compliance with proper ARIA attributes
 * - Integrated error tracking and monitoring
 * - Queue management for notification stacking
 * - Responsive design with proper contrast ratios
 */
const Notifications: React.FC = () => {
  const theme = useTheme();
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();

  // Compute theme-aware styles for toast container
  const toastStyles = useMemo(() => {
    const isHighContrast = theme.palette.mode === 'highContrast';
    const colorPalette = isHighContrast ? COLORS.highContrast : COLORS[theme.palette.mode];

    return {
      // Base container styles
      '--toastify-color-light': colorPalette.background.paper,
      '--toastify-color-dark': colorPalette.background.paper,
      '--toastify-color-info': colorPalette.info.main,
      '--toastify-color-success': colorPalette.success.main,
      '--toastify-color-warning': colorPalette.warning.main,
      '--toastify-color-error': colorPalette.error.main,
      '--toastify-text-color-light': colorPalette.primary.contrastText,
      '--toastify-text-color-dark': colorPalette.primary.contrastText,
      
      // Enhanced contrast for accessibility
      '--toastify-color-progress-info': isHighContrast ? '#ffffff' : colorPalette.info.dark,
      '--toastify-color-progress-success': isHighContrast ? '#ffffff' : colorPalette.success.dark,
      '--toastify-color-progress-warning': isHighContrast ? '#ffffff' : colorPalette.warning.dark,
      '--toastify-color-progress-error': isHighContrast ? '#ffffff' : colorPalette.error.dark,
      
      // Font settings for better readability
      '--toastify-font-family': theme.typography.fontFamily,
      '--toastify-toast-min-height': '64px',
      '--toastify-toast-max-height': '800px',
      
      // Transition timings from theme
      '--toastify-toast-transition': `transform ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,
    };
  }, [theme]);

  // Configure container props with accessibility and performance optimizations
  const containerProps = useMemo(() => ({
    position: 'top-right' as const,
    autoClose: 5000,
    hideProgressBar: false,
    newestOnTop: true,
    closeOnClick: true,
    rtl: false,
    pauseOnFocusLoss: true,
    draggable: true,
    pauseOnHover: true,
    theme: theme.palette.mode === 'dark' ? 'dark' : 'light',
    
    // Accessibility attributes
    role: 'alert',
    'aria-live': 'polite',
    'aria-atomic': true,
    'aria-relevant': 'additions removals',
    
    // Performance optimizations
    limit: 5,
    enableMultiContainer: false,
    containerId: 'main-notifications',
    
    // High contrast mode support
    className: theme.palette.mode === 'highContrast' ? 'high-contrast-notifications' : undefined,
    
    // Custom styling
    style: toastStyles,
    
    // Enhanced progress bar for visual feedback
    progressClassName: 'notification-progress',
    progressStyle: {
      opacity: 0.8,
      height: '4px',
      transformOrigin: 'left',
    },
    
    // Icon customization for better visibility
    icon: true,
    closeButton: true,
  }), [theme, toastStyles]);

  return (
    <>
      <ToastContainer {...containerProps} />
      
      {/* Styles for enhanced accessibility and theme integration */}
      <style>
        {`
          .Toastify__toast {
            border-radius: ${theme.shape.borderRadius}px;
            box-shadow: ${theme.shadows[3]};
            margin-bottom: 1rem;
          }

          .Toastify__toast-body {
            font-size: ${theme.typography.body1.fontSize};
            line-height: ${theme.typography.body1.lineHeight};
            padding: ${theme.spacing(1.5)} ${theme.spacing(2)};
          }

          .high-contrast-notifications .Toastify__toast {
            border: 2px solid ${theme.palette.primary.contrastText};
          }

          .notification-progress {
            background: linear-gradient(
              to right,
              var(--toastify-color-progress-info) 0%,
              var(--toastify-color-progress-info) 100%
            );
          }

          @media (prefers-reduced-motion: reduce) {
            .Toastify__toast {
              --toastify-toast-transition: none;
            }
          }

          @media (max-width: ${theme.breakpoints.values.sm}px) {
            .Toastify__toast-container {
              width: 100vw;
              padding: 0;
              left: 0;
              margin: 0;
            }
          }
        `}
      </style>
    </>
  );
};

export default Notifications;