/**
 * @fileoverview Custom React hook for managing Monaco code editor state with real-time
 * WebSocket synchronization, performance monitoring, and comprehensive error handling.
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef } from 'react'; // v18.x
import { useDispatch, useSelector } from 'react-redux'; // v8.x
import { debounce } from 'lodash'; // v4.x
import { performance } from 'perf_hooks'; // v1.x

import { monacoConfig } from '../components/code/MonacoConfig';
import { 
  updateContent, 
  updateSettings, 
  setValidationErrors,
  editorSelectors 
} from '../store/editorSlice';
import { WebSocketService } from '../services/websocket.service';

// Constants for performance optimization
const CONTENT_UPDATE_DEBOUNCE = 200;
const VALIDATION_DEBOUNCE = 500;
const WEBSOCKET_RECONNECT_DELAY = 1000;
const PERFORMANCE_SAMPLE_SIZE = 100;

/**
 * Interface for editor performance metrics
 */
interface EditorPerformanceMetrics {
  updateTime: number;
  validationTime: number;
  syncTime: number;
  lastUpdate: number;
}

/**
 * Custom hook for managing Monaco editor state and real-time synchronization
 * @returns Editor state and control functions
 */
export function useCodeEditor() {
  const dispatch = useDispatch();
  const wsRef = useRef<WebSocketService | null>(null);
  const performanceMetricsRef = useRef<EditorPerformanceMetrics[]>([]);

  // Redux selectors
  const content = useSelector(editorSelectors.selectContent);
  const settings = useSelector(editorSelectors.selectSettings);
  const validationErrors = useSelector(editorSelectors.selectValidationErrors);
  const isDirty = useSelector(editorSelectors.selectIsDirty);

  /**
   * Initializes WebSocket connection with reconnection handling
   */
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        wsRef.current = new WebSocketService();
        await wsRef.current.connect();

        // Subscribe to WebSocket events
        wsRef.current.subscribe('code.update', handleRemoteUpdate);
        wsRef.current.subscribe('validation.result', handleValidationResult);
        wsRef.current.subscribe('sync.error', handleSyncError);

      } catch (error) {
        console.error('WebSocket initialization failed:', error);
        setTimeout(initializeWebSocket, WEBSOCKET_RECONNECT_DELAY);
      }
    };

    initializeWebSocket();

    return () => {
      wsRef.current?.disconnect();
    };
  }, []);

  /**
   * Handles content changes with performance monitoring and WebSocket sync
   */
  const handleContentChange = useCallback(
    debounce(async (newContent: string) => {
      const startTime = performance.now();

      try {
        // Update local state
        dispatch(updateContent(newContent));

        // Sync with WebSocket
        await wsRef.current?.emit('code.update', { content: newContent });

        // Track performance
        const updateTime = performance.now() - startTime;
        updatePerformanceMetrics({
          updateTime,
          validationTime: 0,
          syncTime: updateTime,
          lastUpdate: Date.now()
        });

      } catch (error) {
        console.error('Content update failed:', error);
        handleSyncError(error);
      }
    }, CONTENT_UPDATE_DEBOUNCE),
    []
  );

  /**
   * Handles remote content updates from WebSocket
   */
  const handleRemoteUpdate = useCallback((data: { content: string }) => {
    if (data.content !== content) {
      dispatch(updateContent(data.content));
    }
  }, [content]);

  /**
   * Processes validation results with error categorization
   */
  const handleValidationResult = useCallback(
    debounce((errors: any[]) => {
      const startTime = performance.now();

      const formattedErrors = errors.map(error => ({
        line: error.line,
        column: error.column,
        message: error.message,
        severity: error.severity
      }));

      dispatch(setValidationErrors(formattedErrors));

      // Track validation performance
      const validationTime = performance.now() - startTime;
      updatePerformanceMetrics({
        updateTime: 0,
        validationTime,
        syncTime: 0,
        lastUpdate: Date.now()
      });
    }, VALIDATION_DEBOUNCE),
    []
  );

  /**
   * Updates editor settings with validation
   */
  const handleSettingsUpdate = useCallback((newSettings: Partial<typeof settings>) => {
    dispatch(updateSettings(newSettings));
  }, []);

  /**
   * Handles WebSocket synchronization errors
   */
  const handleSyncError = useCallback((error: any) => {
    console.error('Sync error:', error);
    dispatch(setValidationErrors([{
      line: 0,
      column: 0,
      message: 'Synchronization error occurred',
      severity: 'error'
    }]));
  }, []);

  /**
   * Updates performance metrics with rolling average
   */
  const updatePerformanceMetrics = (metrics: EditorPerformanceMetrics) => {
    performanceMetricsRef.current.push(metrics);
    if (performanceMetricsRef.current.length > PERFORMANCE_SAMPLE_SIZE) {
      performanceMetricsRef.current.shift();
    }
  };

  /**
   * Calculates average performance metrics
   */
  const getAveragePerformanceMetrics = useCallback(() => {
    const metrics = performanceMetricsRef.current;
    if (metrics.length === 0) return null;

    return {
      averageUpdateTime: metrics.reduce((acc, m) => acc + m.updateTime, 0) / metrics.length,
      averageValidationTime: metrics.reduce((acc, m) => acc + m.validationTime, 0) / metrics.length,
      averageSyncTime: metrics.reduce((acc, m) => acc + m.syncTime, 0) / metrics.length,
      totalUpdates: metrics.length
    };
  }, []);

  /**
   * Forces WebSocket reconnection
   */
  const reconnectWebSocket = useCallback(async () => {
    try {
      await wsRef.current?.disconnect();
      await wsRef.current?.connect();
    } catch (error) {
      console.error('WebSocket reconnection failed:', error);
    }
  }, []);

  return {
    // Editor state
    content,
    settings,
    validationErrors,
    isDirty,
    
    // Editor actions
    handleContentChange,
    handleSettingsUpdate,
    reconnectWebSocket,
    
    // Performance monitoring
    performanceMetrics: getAveragePerformanceMetrics(),
    
    // Editor configuration
    editorOptions: monacoConfig.editor,
    language: monacoConfig.language,
    theme: monacoConfig.theme
  };
}