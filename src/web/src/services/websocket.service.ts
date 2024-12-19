// socket.io-client ^4.6.0
import { io, Socket } from 'socket.io-client';
import { websocketConfig } from '../config/websocket.config';

/**
 * Enum representing possible WebSocket connection states
 */
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected'
}

/**
 * Type for WebSocket event callback functions
 */
type EventCallback = (data: any) => void;

/**
 * Interface for queued events during disconnection
 */
interface QueuedEvent {
  event: string;
  data: any;
  timestamp: number;
}

/**
 * Service class for managing WebSocket connections with enhanced reliability
 * and type-safe event handling
 */
export class WebSocketService {
  private socket: Socket | null = null;
  private subscriptions: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private lastConnectTime: number = 0;
  private eventQueue: QueuedEvent[] = [];
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPingTime: number = 0;

  /**
   * Establishes WebSocket connection with enhanced error handling
   * and connection state management
   * @returns Promise that resolves when connection is established
   */
  public async connect(): Promise<void> {
    if (this.connectionState !== ConnectionState.DISCONNECTED) {
      return;
    }

    this.connectionState = ConnectionState.CONNECTING;

    try {
      this.socket = io(websocketConfig.url, websocketConfig.options);
      
      // Set up connection event handlers
      this.socket.on('connect', () => {
        this.connectionState = ConnectionState.CONNECTED;
        this.lastConnectTime = Date.now();
        this.reconnectAttempts = 0;
        this.processEventQueue();
        this.setupPingMonitoring();
      });

      this.socket.on('disconnect', (reason: string) => {
        this.connectionState = ConnectionState.DISCONNECTED;
        this.clearPingMonitoring();
        
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, don't reconnect automatically
          this.disconnect();
        } else {
          this.handleReconnect();
        }
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('WebSocket connection error:', error);
        this.handleReconnect();
      });

      // Set up event listeners for existing subscriptions
      this.subscriptions.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
          this.socket?.on(event, callback);
        });
      });

      // Handle connection timeout
      const timeout = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, websocketConfig.options.timeout || 5000);
      });

      await Promise.race([
        new Promise<void>((resolve) => {
          this.socket?.once('connect', () => resolve());
        }),
        timeout
      ]);
    } catch (error) {
      this.connectionState = ConnectionState.DISCONNECTED;
      throw error;
    }
  }

  /**
   * Gracefully closes the WebSocket connection with proper cleanup
   */
  public async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.clearPingMonitoring();
    
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }

    this.subscriptions.clear();
    this.eventQueue = [];
    this.connectionState = ConnectionState.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.lastConnectTime = 0;
  }

  /**
   * Subscribes to WebSocket events with type safety and duplicate handling
   * @param event Event name to subscribe to
   * @param callback Callback function to handle the event
   * @returns Unsubscribe function
   */
  public subscribe(event: string, callback: EventCallback): () => void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }

    const callbacks = this.subscriptions.get(event)!;
    callbacks.add(callback);

    if (this.socket?.connected) {
      this.socket.on(event, callback);
    }

    return () => {
      const callbacks = this.subscriptions.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(event);
        }
      }
      this.socket?.off(event, callback);
    };
  }

  /**
   * Emits events to the WebSocket server with validation and queuing
   * @param event Event name to emit
   * @param data Data to send with the event
   */
  public async emit(event: string, data: any): Promise<void> {
    if (!event) {
      throw new Error('Event name is required');
    }

    if (this.connectionState === ConnectionState.CONNECTED && this.socket) {
      try {
        this.socket.emit(event, data);
      } catch (error) {
        console.error('Error emitting event:', error);
        this.queueEvent(event, data);
      }
    } else {
      this.queueEvent(event, data);
      if (this.connectionState === ConnectionState.DISCONNECTED) {
        await this.connect();
      }
    }
  }

  /**
   * Manages reconnection with exponential backoff and circuit breaker
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectTimer || this.connectionState === ConnectionState.CONNECTED) {
      return;
    }

    this.reconnectAttempts++;
    if (this.reconnectAttempts > websocketConfig.reconnect.maxAttempts) {
      console.error('Maximum reconnection attempts reached');
      this.disconnect();
      return;
    }

    const backoffDelay = websocketConfig.reconnect.delay * 
      Math.pow(websocketConfig.reconnect.backoffMultiplier, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection attempt failed:', error);
        this.handleReconnect();
      }
    }, backoffDelay);
  }

  /**
   * Clears the reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Sets up ping monitoring for connection health checks
   */
  private setupPingMonitoring(): void {
    this.clearPingMonitoring();
    this.lastPingTime = Date.now();
    
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
        const pingTimeout = setTimeout(() => {
          if (Date.now() - this.lastPingTime > 10000) {
            this.handleReconnect();
          }
        }, 5000);

        this.socket.once('pong', () => {
          this.lastPingTime = Date.now();
          clearTimeout(pingTimeout);
        });
      }
    }, 30000);
  }

  /**
   * Clears ping monitoring interval
   */
  private clearPingMonitoring(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Queues events for later transmission when connection is restored
   */
  private queueEvent(event: string, data: any): void {
    this.eventQueue.push({
      event,
      data,
      timestamp: Date.now()
    });

    // Limit queue size to prevent memory issues
    if (this.eventQueue.length > 100) {
      this.eventQueue.shift();
    }
  }

  /**
   * Processes queued events after connection is restored
   */
  private processEventQueue(): void {
    const now = Date.now();
    const validEvents = this.eventQueue.filter(
      event => now - event.timestamp < 300000 // 5 minutes
    );

    validEvents.forEach(({ event, data }) => {
      this.socket?.emit(event, data);
    });

    this.eventQueue = [];
  }
}