import cron from 'node-cron';
import { TranslationService } from '@/services/TranslationService';
import { logger } from '@/config/logger';
import { env } from '@/config/env';

export class TranslationPollerJob {
  private translationService: TranslationService;
  private isRunning: boolean = false;

  constructor() {
    this.translationService = new TranslationService();
  }

  start(): void {
    logger.info('Starting translation poller job', { 
      schedule: env.TRANSLATION_POLL_INTERVAL 
    });

    cron.schedule(env.TRANSLATION_POLL_INTERVAL, async () => {
      await this.execute();
    }, {
      scheduled: true,
      timezone: 'UTC',
    });

    // Run immediately on startup with a small delay
    setTimeout(() => {
      this.execute();
    }, 30000); // 30 seconds delay
  }

  async execute(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Translation poller job is already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting translation poller job execution');
      
      await this.translationService.pollTranslationJobs();
      
      const duration = Date.now() - startTime;
      logger.info('Translation poller job completed successfully', { 
        duration: `${duration}ms` 
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Translation poller job failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      this.isRunning = false;
    }
  }

  stop(): void {
    logger.info('Stopping translation poller job');
    cron.getTasks().forEach(task => task.stop());
  }
}