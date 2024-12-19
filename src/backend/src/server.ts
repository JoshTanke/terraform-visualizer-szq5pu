// External dependencies
import dotenv from 'dotenv'; // ^16.0.0
import http from 'http';

// Internal dependencies
import App from './app';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

// Global constants
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '10000', 10);
const HEALTH_CHECK_PATH = process.env.HEALTH_CHECK_PATH || '/health';

/**
 * Initializes and starts the application server with enhanced error handling
 * and monitoring capabilities.
 */
async function startServer(): Promise<void> {
  try {
    logger.info('Starting server initialization', {
      environment: NODE_ENV,
      port: PORT
    });

    // Create app instance
    const app = new App();

    // Register health check endpoint
    setupHealthCheck(app);

    // Start the application
    await app.start();

    logger.info('Server started successfully', {
      port: PORT,
      environment: NODE_ENV,
      healthCheckPath: HEALTH_CHECK_PATH
    });

  } catch (error) {
    logger.error('Server startup failed', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

/**
 * Configures health check endpoint for container orchestration
 * @param app Application instance
 */
function setupHealthCheck(app: App): void {
  app.express.get(HEALTH_CHECK_PATH, (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      uptime: process.uptime()
    });
  });
}

/**
 * Handles graceful server shutdown with proper resource cleanup
 * @param signal Process signal triggering shutdown
 */
async function handleShutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info('Received shutdown signal', { signal });

  let exitCode = 0;
  const shutdownTimer = setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // Get app instance
    const app = new App();

    // Stop the application
    await app.stop();

    logger.info('Server shutdown completed successfully');
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error.message,
      stack: error.stack
    });
    exitCode = 1;
  } finally {
    clearTimeout(shutdownTimer);
    process.exit(exitCode);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  handleShutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : reason
  });
  handleShutdown('SIGTERM');
});

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});