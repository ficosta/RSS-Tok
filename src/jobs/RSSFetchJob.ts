import cron from 'node-cron';
import { RSSService } from '@/services/RSSService';
import { logger } from '@/config/logger';
import { env } from '@/config/env';

export class RSSFetchJob {
  private rssService: RSSService;
  private isRunning: boolean = false;

  constructor() {
    this.rssService = new RSSService();
  }

  start(): void {
    logger.info('Starting RSS fetch job', { 
      schedule: env.RSS_FETCH_INTERVAL 
    });

    cron.schedule(env.RSS_FETCH_INTERVAL, async () => {
      await this.execute();
    }, {
      scheduled: true,
      timezone: 'UTC',
    });

    // Run immediately on startup
    this.execute();
  }

  async execute(): Promise<void> {
    if (this.isRunning) {
      logger.warn('RSS fetch job is already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting RSS fetch job execution');
      
      await this.rssService.fetchAllFeeds();
      
      const duration = Date.now() - startTime;
      logger.info('RSS fetch job completed successfully', { 
        duration: `${duration}ms` 
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('RSS fetch job failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      this.isRunning = false;
    }
  }

  stop(): void {
    logger.info('Stopping RSS fetch job');
    cron.getTasks().forEach(task => task.stop());
  }
}