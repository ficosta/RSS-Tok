import { RSSFetchJob } from './RSSFetchJob';
import { TranslationPollerJob } from './TranslationPollerJob';
import { logger } from '@/config/logger';

export class JobManager {
  private rssFetchJob: RSSFetchJob;
  private translationPollerJob: TranslationPollerJob;

  constructor() {
    this.rssFetchJob = new RSSFetchJob();
    this.translationPollerJob = new TranslationPollerJob();
  }

  start(): void {
    logger.info('Starting job manager');
    
    try {
      this.rssFetchJob.start();
      this.translationPollerJob.start();
      
      logger.info('All jobs started successfully');
    } catch (error) {
      logger.error('Error starting jobs:', error);
      throw error;
    }
  }

  stop(): void {
    logger.info('Stopping job manager');
    
    try {
      this.rssFetchJob.stop();
      this.translationPollerJob.stop();
      
      logger.info('All jobs stopped successfully');
    } catch (error) {
      logger.error('Error stopping jobs:', error);
    }
  }
}