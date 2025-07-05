import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { initializeDatabase } from '@/config/database';
import { JobManager } from '@/jobs';
import app from './app';

const startServer = async (): Promise<void> => {
  try {
    logger.info('Starting RSS-Tok API server...');

    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Start the server
    const server = app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`, {
        port: env.PORT,
        environment: env.NODE_ENV,
        nodeVersion: process.version,
      });
    });

    // Start background jobs
    const jobManager = new JobManager();
    jobManager.start();

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        
        // Stop jobs
        jobManager.stop();
        
        // Close database connections
        // AppDataSource.destroy() would go here if needed
        
        logger.info('Application shut down successfully');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after 30 seconds');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();