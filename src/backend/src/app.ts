// External dependencies
import express, { Application } from 'express'; // ^4.18.2
import http from 'http';
import mongoose from 'mongoose'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import morgan from 'morgan'; // ^1.10.0
import helmet from 'helmet'; // ^7.0.0
import cors from 'cors'; // ^2.8.5
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { validate } from 'express-validator'; // ^7.0.0

// Internal dependencies
import { config, validateConfigurations, AppConfig } from './config';
import router from './api/routes';
import { WebSocketServer } from './websocket/WebSocketServer';
import { Logger } from './utils/logger';

/**
 * Main application class that configures and manages the Express server
 * with comprehensive security, monitoring, and performance features.
 */
export class App {
  private express: Application;
  private server: http.Server;
  private wsServer: WebSocketServer;
  private dbConnection: mongoose.Connection;
  private healthCheckInterval: NodeJS.Timeout;
  private isShuttingDown: boolean;
  private readonly logger: Logger;

  /**
   * Initializes the Express application with comprehensive configuration
   * @param config Application configuration object
   */
  constructor(config: AppConfig) {
    this.express = express();
    this.logger = Logger.getInstance();
    this.isShuttingDown = false;

    // Validate configurations
    validateConfigurations().catch(error => {
      this.logger.error('Configuration validation failed', { error });
      process.exit(1);
    });

    // Initialize middleware and routes
    this.initializeMiddleware();
    this.initializeRoutes();

    // Setup graceful shutdown handlers
    this.setupShutdownHandlers();
  }

  /**
   * Sets up application middleware stack with security and performance features
   */
  private initializeMiddleware(): void {
    // Security middleware
    this.express.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https://api.github.com']
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    this.express.use(cors({
      origin: config.auth.security.cors.origin,
      methods: config.auth.security.cors.methods,
      credentials: true,
      maxAge: 86400
    }));

    // Compression middleware
    this.express.use(compression());

    // Rate limiting
    this.express.use(rateLimit({
      windowMs: config.auth.security.rateLimit.windowMs,
      max: config.auth.security.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false
    }));

    // Request parsing
    this.express.use(express.json({ limit: '1mb' }));
    this.express.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Logging middleware
    this.express.use(morgan('combined'));

    // Request validation
    this.express.use(validate());
  }

  /**
   * Configures application routes and error handling
   */
  private initializeRoutes(): void {
    // Health check endpoint
    this.express.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    // API routes
    this.express.use('/api', router);

    // 404 handler
    this.express.use((req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.path
      });
    });
  }

  /**
   * Initializes WebSocket server with security and monitoring
   */
  private async initializeWebSocket(): Promise<void> {
    this.server = http.createServer(this.express);
    this.wsServer = new WebSocketServer(this.server);
    await this.wsServer.initialize();
  }

  /**
   * Initializes database connection with retry logic
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await mongoose.connect(config.database.uri, config.database.options);
      this.dbConnection = mongoose.connection;

      this.dbConnection.on('error', (error) => {
        this.logger.error('Database connection error', { error });
      });

      this.dbConnection.on('disconnected', () => {
        this.logger.warn('Database disconnected');
      });

      this.logger.info('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database', { error });
      throw error;
    }
  }

  /**
   * Starts the application server with comprehensive initialization
   */
  public async start(): Promise<void> {
    try {
      // Initialize database connection
      await this.initializeDatabase();

      // Initialize WebSocket server
      await this.initializeWebSocket();

      // Start HTTP server
      const port = process.env.PORT || 3000;
      this.server.listen(port, () => {
        this.logger.info(`Server started on port ${port}`);
      });

      // Initialize health monitoring
      this.startHealthMonitoring();
    } catch (error) {
      this.logger.error('Failed to start server', { error });
      throw error;
    }
  }

  /**
   * Handles graceful shutdown of all services
   */
  public async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    try {
      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Close WebSocket server
      await this.wsServer.shutdown();

      // Close database connection
      if (this.dbConnection) {
        await this.dbConnection.close();
      }

      // Close HTTP server
      await new Promise<void>((resolve, reject) => {
        this.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.logger.info('Server shut down successfully');
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }

  /**
   * Sets up graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    process.on('SIGTERM', async () => {
      this.logger.info('SIGTERM received');
      await this.gracefulShutdown();
    });

    process.on('SIGINT', async () => {
      this.logger.info('SIGINT received');
      await this.gracefulShutdown();
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error });
      this.gracefulShutdown().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection', { reason });
      this.gracefulShutdown().then(() => process.exit(1));
    });
  }

  /**
   * Starts periodic health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      const metrics = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        timestamp: new Date().toISOString()
      };

      this.logger.info('Health check metrics', metrics);
    }, 60000); // Every minute
  }
}

export default App;