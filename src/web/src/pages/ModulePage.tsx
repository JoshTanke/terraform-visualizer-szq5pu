import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert, Snackbar } from '@mui/material';
import { IModule, ModuleStatus } from '../../interfaces/IModule';
import { useWebSocket } from '../../hooks/useWebSocket';
import { websocketConfig } from '../../config/websocket.config';

// URL parameters interface
interface ModulePageParams {
  moduleId: string;
  environmentId: string;
}

// Component state interface
interface ModulePageState {
  module: IModule | null;
  loading: boolean;
  error: string | null;
  selectedNode: any | null;
  isWebSocketConnected: boolean;
  notification: {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  };
}

/**
 * ModulePage component for displaying detailed module information with real-time updates
 * and accessibility support.
 */
const ModulePage: React.FC = () => {
  // Router hooks
  const { moduleId, environmentId } = useParams<ModulePageParams>();
  const navigate = useNavigate();
  const location = useLocation();

  // State management
  const [state, setState] = useState<ModulePageState>({
    module: null,
    loading: true,
    error: null,
    selectedNode: null,
    isWebSocketConnected: false,
    notification: {
      open: false,
      message: '',
      severity: 'info'
    }
  });

  // Refs
  const graphRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const announcer = useRef<HTMLDivElement>(null);

  // WebSocket connection
  const {
    isConnected,
    subscribe,
    emit
  } = useWebSocket({
    autoConnect: true,
    onConnect: () => {
      setState(prev => ({ ...prev, isWebSocketConnected: true }));
      announceToScreenReader('WebSocket connection established');
    },
    onDisconnect: () => {
      setState(prev => ({ ...prev, isWebSocketConnected: false }));
      announceToScreenReader('WebSocket connection lost');
    }
  });

  // Memoized styles
  const styles = useMemo(() => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100%',
      overflow: 'hidden',
      position: 'relative'
    },
    header: {
      padding: 2,
      borderBottom: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    content: {
      flex: 1,
      overflow: 'hidden',
      position: 'relative'
    },
    loading: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      position: 'absolute',
      width: '100%',
      zIndex: 1000
    },
    error: {
      padding: 2,
      color: 'error.main',
      textAlign: 'center',
      margin: 'auto'
    },
    accessibilityAnnouncer: {
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0
    }
  }), []);

  /**
   * Announces messages to screen readers
   */
  const announceToScreenReader = useCallback((message: string) => {
    if (announcer.current) {
      announcer.current.textContent = message;
    }
  }, []);

  /**
   * Handles WebSocket messages for real-time updates
   */
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === websocketConfig.events.graph.update) {
      setState(prev => ({
        ...prev,
        module: message.data,
        notification: {
          open: true,
          message: 'Module updated',
          severity: 'info'
        }
      }));
      announceToScreenReader('Module visualization updated');
    } else if (message.type === websocketConfig.events.validation.result) {
      setState(prev => ({
        ...prev,
        module: {
          ...prev.module!,
          status: message.data.status
        }
      }));
      announceToScreenReader(`Validation status: ${message.data.status}`);
    }
  }, []);

  /**
   * Handles node selection in the graph
   */
  const handleNodeSelect = useCallback((node: any | null) => {
    setState(prev => ({ ...prev, selectedNode: node }));
    if (node) {
      announceToScreenReader(`Selected resource: ${node.data.name}`);
      navigate(`${location.pathname}?resource=${node.data.id}`, { replace: true });
    }
  }, [location.pathname, navigate]);

  /**
   * Fetches initial module data
   */
  const fetchModuleData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await fetch(`/api/modules/${moduleId}`);
      if (!response.ok) throw new Error('Failed to fetch module data');
      const data = await response.json();
      setState(prev => ({ ...prev, module: data, loading: false }));
      announceToScreenReader('Module data loaded');
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
      announceToScreenReader('Error loading module data');
    }
  }, [moduleId]);

  // Initial data fetch and WebSocket subscription
  useEffect(() => {
    fetchModuleData();
    
    const unsubscribeGraph = subscribe<any>(
      websocketConfig.events.graph.update,
      handleWebSocketMessage
    );
    
    const unsubscribeValidation = subscribe<any>(
      websocketConfig.events.validation.result,
      handleWebSocketMessage
    );

    return () => {
      unsubscribeGraph();
      unsubscribeValidation();
    };
  }, [moduleId, subscribe, handleWebSocketMessage, fetchModuleData]);

  // Keyboard navigation setup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleNodeSelect(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNodeSelect]);

  // Render loading state
  if (state.loading) {
    return (
      <Box sx={styles.loading}>
        <CircularProgress aria-label="Loading module data" />
      </Box>
    );
  }

  // Render error state
  if (state.error) {
    return (
      <Box sx={styles.error}>
        <Alert severity="error" aria-live="assertive">
          {state.error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={styles.container} role="main" aria-label="Module visualization page">
      {/* Header */}
      <Box sx={styles.header}>
        <Typography variant="h5" component="h1">
          {state.module?.name || 'Module View'}
        </Typography>
        <Box>
          <Typography variant="body2" color={state.isWebSocketConnected ? 'success.main' : 'error.main'}>
            {state.isWebSocketConnected ? 'Connected' : 'Disconnected'}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={styles.content}>
        {/* Graph and Editor components would be rendered here */}
      </Box>

      {/* Accessibility announcer */}
      <div
        ref={announcer}
        role="status"
        aria-live="polite"
        sx={styles.accessibilityAnnouncer}
      />

      {/* Notifications */}
      <Snackbar
        open={state.notification.open}
        autoHideDuration={6000}
        onClose={() => setState(prev => ({
          ...prev,
          notification: { ...prev.notification, open: false }
        }))}
      >
        <Alert severity={state.notification.severity}>
          {state.notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ModulePage;