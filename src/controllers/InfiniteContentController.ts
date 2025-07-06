import { Request, Response } from 'express';
import { InfiniteContentService } from '../services/InfiniteContentService';
import { logger } from '../config/logger';

export class InfiniteContentController {
  private contentService: InfiniteContentService;

  constructor() {
    this.contentService = new InfiniteContentService();
  }

  async getHomeContent(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, cursor, limit = '20', maxConsecutive = '5' } = req.query;

      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({
          error: 'sessionId is required',
          received: sessionId
        });
        return;
      }

      const parsedLimit = parseInt(limit as string);
      const parsedMaxConsecutive = parseInt(maxConsecutive as string);

      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        res.status(400).json({
          error: 'limit must be a number between 1 and 100',
          received: limit
        });
        return;
      }

      const result = await this.contentService.getHomeContent({
        sessionId,
        cursor: cursor as string,
        limit: parsedLimit,
        maxConsecutivePerChannel: parsedMaxConsecutive
      });

      res.status(200).json(result);
    } catch (error) {
      logger.error('Failed to get home content:', error);
      
      if (error instanceof Error && error.message.includes('Invalid or expired session')) {
        res.status(401).json({
          error: 'Session expired or invalid',
          message: 'Please create a new session'
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get home content',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getChannelContent(req: Request, res: Response): Promise<void> {
    try {
      const { channelId } = req.params;
      const { sessionId, cursor, limit = '20' } = req.query;

      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({
          error: 'sessionId is required',
          received: sessionId
        });
        return;
      }

      if (!channelId) {
        res.status(400).json({
          error: 'channelId is required',
          received: channelId
        });
        return;
      }

      const parsedLimit = parseInt(limit as string);

      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        res.status(400).json({
          error: 'limit must be a number between 1 and 100',
          received: limit
        });
        return;
      }

      const result = await this.contentService.getChannelContent({
        sessionId,
        channelId,
        cursor: cursor as string,
        limit: parsedLimit
      });

      res.status(200).json(result);
    } catch (error) {
      logger.error(`Failed to get channel ${req.params.channelId} content:`, error);
      
      if (error instanceof Error && error.message.includes('Invalid or expired session')) {
        res.status(401).json({
          error: 'Session expired or invalid',
          message: 'Please create a new session'
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get channel content',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async markContentViewed(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { itemIds = [] } = req.body;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      if (!Array.isArray(itemIds)) {
        res.status(400).json({
          error: 'itemIds must be an array',
          received: typeof itemIds
        });
        return;
      }

      if (itemIds.length === 0) {
        res.status(200).json({
          success: true,
          viewedCount: 0,
          sessionId
        });
        return;
      }

      await this.contentService.markContentAsViewed(sessionId, itemIds);

      res.status(200).json({
        success: true,
        viewedCount: itemIds.length,
        sessionId
      });
    } catch (error) {
      logger.error('Failed to mark content as viewed:', error);
      res.status(500).json({
        error: 'Failed to mark content as viewed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateSessionActivity(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      const result = await this.contentService.updateSessionActivity(sessionId);
      
      if (!result) {
        res.status(404).json({
          error: 'Session not found or expired',
          sessionId
        });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      logger.error('Failed to update session activity:', error);
      res.status(500).json({
        error: 'Failed to update session activity',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}