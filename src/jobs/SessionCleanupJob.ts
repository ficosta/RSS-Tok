import cron from 'node-cron';
import { SessionService } from '../services/SessionService';
import { logger } from '../config/logger';

export class SessionCleanupJob {
  private sessionService: SessionService;
  private isRunning: boolean = false;

  constructor() {
    this.sessionService = new SessionService();
  }

  start(): void {
    // Run every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
      if (this.isRunning) {
        logger.warn('Session cleanup already running, skipping this cycle');
        return;
      }

      this.isRunning = true;
      
      try {
        logger.info('Starting session cleanup job');
        const startTime = Date.now();
        
        await this.sessionService.cleanupExpiredSessions();
        
        const duration = Date.now() - startTime;
        logger.info(`Session cleanup completed in ${duration}ms`);
      } catch (error) {
        logger.error('Session cleanup job failed:', error);
      } finally {
        this.isRunning = false;
      }
    });

    logger.info('Session cleanup job started (runs every 10 minutes)');
  }

  stop(): void {
    // Note: node-cron doesn't provide a direct way to stop specific scheduled tasks
    // This would require maintaining task references, which is not implemented here
    logger.info('Session cleanup job stop requested');
  }

  async runOnce(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Session cleanup is already running');
    }

    this.isRunning = true;
    
    try {
      logger.info('Running manual session cleanup');
      await this.sessionService.cleanupExpiredSessions();
      logger.info('Manual session cleanup completed');
    } finally {
      this.isRunning = false;
    }
  }

  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}