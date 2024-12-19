// React ^18.0.0
import React, { useCallback, useEffect, useState } from 'react';
// React-Redux ^8.0.0
import { useSelector } from 'react-redux';
// Material-UI ^5.0.0
import { Box, Typography, useTheme } from '@mui/material';

import { useWebSocket } from '../../hooks/useWebSocket';
import { ISettings } from '../../interfaces/ISettings';

// Constants for status bar configuration
const AUTOSAVE_CHECK_INTERVAL = 5000;
const STATUS_UPDATE_DEBOUNCE = 1000;
const MAX_ERROR_LENGTH = 100;

/**
 * Interface for StatusBar component props
 */
interface IStatusBarProps {
  className?: string;
  onError?: (error: string) => void;
}

/**
 * Interface for status bar state management
 */
interface IStatusState {
  isConnected: boolean;
  lastSaved: Date | null;
  autoSaveEnabled: boolean;
  error: string | null;
}

/**
 * Formats a timestamp into a human-readable relative time string
 * @param date - Date to format
 * @returns Formatted time string
 */
const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 30) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
};

/**
 * StatusBar component displays real-time application status in the footer
 * including GitHub connection status, auto-save state, and last saved timestamp
 */
const StatusBar: React.FC<IStatusBarProps> = ({ className, onError }) => {
  const theme = useTheme();
  const { isConnected, error: wsError } = useWebSocket();
  const settings = useSelector((state: { settings: ISettings }) => state.settings);

  // Local state for status management
  const [status, setStatus] = useState<IStatusState>({
    isConnected: false,
    lastSaved: null,
    autoSaveEnabled: settings.editor.autoSave,
    error: null
  });

  /**
   * Updates the connection status with debouncing
   */
  const updateConnectionStatus = useCallback(() => {
    setStatus(prevStatus => ({
      ...prevStatus,
      isConnected,
      error: wsError ? wsError.message.substring(0, MAX_ERROR_LENGTH) : null
    }));
  }, [isConnected, wsError]);

  /**
   * Updates the last saved timestamp
   */
  const updateLastSaved = useCallback(() => {
    setStatus(prevStatus => ({
      ...prevStatus,
      lastSaved: new Date()
    }));
  }, []);

  // Effect for handling WebSocket status updates
  useEffect(() => {
    const timer = setTimeout(updateConnectionStatus, STATUS_UPDATE_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [updateConnectionStatus]);

  // Effect for handling auto-save status updates
  useEffect(() => {
    if (settings.editor.autoSave) {
      const timer = setInterval(updateLastSaved, AUTOSAVE_CHECK_INTERVAL);
      return () => clearInterval(timer);
    }
  }, [settings.editor.autoSave, updateLastSaved]);

  // Effect for error handling
  useEffect(() => {
    if (status.error && onError) {
      onError(status.error);
    }
  }, [status.error, onError]);

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: theme.spacing(1, 2),
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper
      }}
    >
      {/* Connection Status */}
      <Typography
        variant="body2"
        sx={{
          display: 'flex',
          alignItems: 'center',
          color: status.isConnected ? theme.palette.success.main : theme.palette.error.main
        }}
      >
        Status: {status.isConnected ? 'Connected to GitHub' : 'Disconnected'}
      </Typography>

      {/* Separator */}
      <Typography variant="body2" sx={{ mx: 2 }}>|</Typography>

      {/* Auto-save Status */}
      <Typography
        variant="body2"
        sx={{
          color: status.autoSaveEnabled ? theme.palette.success.main : theme.palette.text.secondary
        }}
      >
        {status.autoSaveEnabled ? 'Auto-save enabled' : 'Auto-save disabled'}
      </Typography>

      {/* Separator */}
      <Typography variant="body2" sx={{ mx: 2 }}>|</Typography>

      {/* Last Saved Timestamp */}
      <Typography variant="body2" color="textSecondary">
        Last saved: {status.lastSaved ? formatTimestamp(status.lastSaved) : 'Never'}
      </Typography>

      {/* Error Display */}
      {status.error && (
        <>
          <Typography variant="body2" sx={{ mx: 2 }}>|</Typography>
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.error.main,
              maxWidth: '300px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            Error: {status.error}
          </Typography>
        </>
      )}
    </Box>
  );
};

export default StatusBar;