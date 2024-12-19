import { useCallback, useMemo } from 'react';
import { toast, ToastOptions, Id } from 'react-toastify'; // v9.1.3
import { useTheme } from '@mui/material'; // v5.0.0
import { ErrorHandler, ERROR_SEVERITY, formatErrorMessage } from '../utils/errorHandling';

// Global constants for notification configuration
const ANIMATION_DURATION = 300;
const MAX_QUEUE_SIZE = 5;

interface NotificationOptions extends Partial<ToastOptions> {
  priority?: boolean;
  persist?: boolean;
  retry?: boolean;
}

interface NotificationQueue {
  id: Id;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: number;
}

/**
 * Custom hook providing theme-aware, accessible notification management
 * Implements WCAG 2.1 Level AA compliance with proper ARIA attributes
 */
export const useNotifications = () => {
  const theme = useTheme();
  const errorHandler = ErrorHandler.getInstance();

  // Theme-aware default options
  const defaultOptions = useMemo((): ToastOptions => ({
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    role: 'alert',
    'aria-live': 'polite',
    style: {
      background: theme.palette.background.paper,
      color: theme.palette.text.primary,
      borderRadius: theme.shape.borderRadius,
      boxShadow: theme.shadows[3],
    },
    transition: {
      duration: ANIMATION_DURATION,
      timingFunction: theme.transitions.easing.easeInOut,
    },
  }), [theme]);

  // Queue management for notifications
  const notificationQueue = useMemo(() => new Set<NotificationQueue>(), []);

  /**
   * Shows a success notification with accessibility support
   */
  const showSuccess = useCallback((
    message: string,
    options?: NotificationOptions
  ): void => {
    const toastOptions: ToastOptions = {
      ...defaultOptions,
      ...options,
      className: 'notification-success',
      icon: '✓',
      style: {
        ...defaultOptions.style,
        borderLeft: `4px solid ${theme.palette.success.main}`,
      },
      'aria-label': `Success: ${message}`,
    };

    toast.success(message, toastOptions);
  }, [defaultOptions, theme]);

  /**
   * Shows an error notification with enhanced error handling
   */
  const showError = useCallback(async (
    message: string,
    error?: Error,
    options?: NotificationOptions
  ): Promise<void> => {
    const context = { timestamp: Date.now() };
    const standardizedError = error ? 
      await errorHandler.handleError(error, 'RUNTIME_ERROR', context) :
      undefined;

    const formattedMessage = standardizedError ? 
      formatErrorMessage(message, context, { severity: ERROR_SEVERITY.HIGH }) :
      message;

    const toastOptions: ToastOptions = {
      ...defaultOptions,
      ...options,
      autoClose: options?.persist ? false : defaultOptions.autoClose,
      className: 'notification-error',
      icon: '⚠',
      style: {
        ...defaultOptions.style,
        borderLeft: `4px solid ${theme.palette.error.main}`,
      },
      'aria-label': `Error: ${message}`,
      'aria-live': 'assertive',
    };

    toast.error(formattedMessage, toastOptions);
  }, [defaultOptions, theme, errorHandler]);

  /**
   * Shows a warning notification with medium priority
   */
  const showWarning = useCallback((
    message: string,
    options?: NotificationOptions
  ): void => {
    const toastOptions: ToastOptions = {
      ...defaultOptions,
      ...options,
      className: 'notification-warning',
      icon: '⚠',
      style: {
        ...defaultOptions.style,
        borderLeft: `4px solid ${theme.palette.warning.main}`,
      },
      'aria-label': `Warning: ${message}`,
    };

    toast.warning(message, toastOptions);
  }, [defaultOptions, theme]);

  /**
   * Shows an info notification with low priority
   */
  const showInfo = useCallback((
    message: string,
    options?: NotificationOptions
  ): void => {
    const toastOptions: ToastOptions = {
      ...defaultOptions,
      ...options,
      className: 'notification-info',
      icon: 'ℹ',
      style: {
        ...defaultOptions.style,
        borderLeft: `4px solid ${theme.palette.info.main}`,
      },
      'aria-label': `Information: ${message}`,
    };

    toast.info(message, toastOptions);
  }, [defaultOptions, theme]);

  /**
   * Clears all active notifications
   */
  const clearAll = useCallback((): void => {
    toast.dismiss();
    notificationQueue.clear();
  }, [notificationQueue]);

  /**
   * Gets the current notification queue
   */
  const getQueue = useCallback((): NotificationQueue[] => {
    return Array.from(notificationQueue)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_QUEUE_SIZE);
  }, [notificationQueue]);

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAll,
    getQueue,
  };
};

export type NotificationType = ReturnType<typeof useNotifications>;