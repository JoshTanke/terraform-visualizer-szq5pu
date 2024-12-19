// React ^18.0.0
import { useState, useEffect, useCallback } from 'react';
import { websocketConfig } from '../config/websocket.config';
import { WebSocketService } from '../services/websocket.service';

/**
 * Enum for WebSocket connection status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected'
}

/**
 * Interface for WebSocket errors
 */
export interface WebSocketError {
  code: string;
  message: string;
  timestamp: number;
}

/**
 * Interface for WebSocket hook options
 */
export interface UseWebSocketOptions {
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: WebSocketError) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  connectionTimeout?: number;
  heartbeatInterval?: number;
}

/**
 * Interface for WebSocket hook return value
 */
export interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: WebSocketError | null;
  lastPingTime: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: <T>(event: string, callback: (data: T) => void) => () => void;
  emit: <T>(event: string, data: T) => Promise<void>;
  getConnectionStatus: () => ConnectionStatus;
  resetConnection: () => Promise<void>;
}

/**
 * Custom hook for managing WebSocket connections with enhanced reliability,
 * performance optimization, and type safety.
 * 
 * @param options - Configuration options for the WebSocket connection
 * @returns Object containing WebSocket state and control methods
 */
export const useWebSocket = ({
  autoConnect = true,
  onConnect,
  onDisconnect,
  onError,
  reconnectAttempts = websocketConfig.reconnect.maxAttempts,
  reconnectInterval = websocketConfig.reconnect.delay,
  connectionTimeout = websocketConfig.options.timeout || 5000,
  heartbeatInterval = 30000
}: UseWebSocketOptions = {}): UseWebSocketReturn => {
  // Initialize WebSocket service instance
  const [wsService] = useState(() => new WebSocketService());
  
  // Connection state management
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<WebSocketError | null>(null);
  const [lastPingTime, setLastPingTime] = useState(0);

  /**
   * Memoized connection handler
   */
  const handleConnect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    try {
      setIsConnecting(true);
      setError(null);
      await wsService.connect();
      setIsConnected(true);
      onConnect?.();
    } catch (err) {
      const wsError: WebSocketError = {
        code: 'CONNECTION_ERROR',
        message: err instanceof Error ? err.message : 'Failed to connect',
        timestamp: Date.now()
      };
      setError(wsError);
      onError?.(wsError);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected, onConnect, onError]);

  /**
   * Memoized disconnect handler
   */
  const handleDisconnect = useCallback(() => {
    wsService.disconnect();
    setIsConnected(false);
    setIsConnecting(false);
    onDisconnect?.();
  }, [onDisconnect]);

  /**
   * Memoized subscription handler with type safety
   */
  const handleSubscribe = useCallback(<T>(
    event: string,
    callback: (data: T) => void
  ) => {
    return wsService.subscribe(event, callback as any);
  }, []);

  /**
   * Memoized event emission handler with type safety
   */
  const handleEmit = useCallback(async <T>(
    event: string,
    data: T
  ): Promise<void> => {
    try {
      await wsService.emit(event, data);
    } catch (err) {
      const wsError: WebSocketError = {
        code: 'EMIT_ERROR',
        message: err instanceof Error ? err.message : 'Failed to emit event',
        timestamp: Date.now()
      };
      setError(wsError);
      onError?.(wsError);
      throw err;
    }
  }, [onError]);

  /**
   * Get current connection status
   */
  const getConnectionStatus = useCallback((): ConnectionStatus => {
    if (isConnected) return ConnectionStatus.CONNECTED;
    if (isConnecting) return ConnectionStatus.CONNECTING;
    return ConnectionStatus.DISCONNECTED;
  }, [isConnected, isConnecting]);

  /**
   * Reset connection with cleanup
   */
  const resetConnection = useCallback(async () => {
    await handleDisconnect();
    await handleConnect();
  }, [handleDisconnect, handleConnect]);

  /**
   * Effect for handling automatic connection
   */
  useEffect(() => {
    if (autoConnect) {
      handleConnect();
    }

    return () => {
      handleDisconnect();
    };
  }, [autoConnect, handleConnect, handleDisconnect]);

  /**
   * Effect for handling heartbeat monitoring
   */
  useEffect(() => {
    if (!isConnected) return;

    const heartbeatInterval = setInterval(() => {
      wsService.emit('ping', null);
      setLastPingTime(Date.now());
    }, heartbeatInterval);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [isConnected, heartbeatInterval]);

  return {
    isConnected,
    isConnecting,
    error,
    lastPingTime,
    connect: handleConnect,
    disconnect: handleDisconnect,
    subscribe: handleSubscribe,
    emit: handleEmit,
    getConnectionStatus,
    resetConnection
  };
};