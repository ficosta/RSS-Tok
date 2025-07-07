import { RSSFetchJob } from './RSSFetchJob';
import { TranslationPollerJob } from './TranslationPollerJob';
import { SessionCleanupJob } from './SessionCleanupJob';
import { logger } from '@/config/logger';

export class JobManager {
  private rssFetchJob: RSSFetchJob;
  private translationPollerJob: TranslationPollerJob;
  private sessionCleanupJob: SessionCleanupJob;

  constructor() {
    this.rssFetchJob = new RSSFetchJob();
    this.translationPollerJob = new TranslationPollerJob();
    this.sessionCleanupJob = new SessionCleanupJob();
  }

  start(): void {
    logger.info('Starting job manager');
    
    try {
      this.rssFetchJob.start();
      this.translationPollerJob.start();
      this.sessionCleanupJob.start();
      
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
      this.sessionCleanupJob.stop();
      
      logger.info('All jobs stopped successfully');
    } catch (error) {
      logger.error('Error stopping jobs:', error);
    }
  }
}