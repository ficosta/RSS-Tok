import { Request, Response } from 'express';
import { SessionService } from '../services/SessionService';
import { logger } from '../config/logger';

export class SessionController {
  private sessionService: SessionService;

  constructor() {
    this.sessionService = new SessionService();
  }

  async startSession(req: Request, res: Response): Promise<void> {
    try {
      const { deviceFingerprint, existingSessionId } = req.body;

      const result = await this.sessionService.startSession(
        deviceFingerprint,
        existingSessionId
      );

      res.status(200).json(result);
    } catch (error) {
      logger.error('Failed to start session:', error);
      res.status(500).json({
        error: 'Failed to create session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateActivity(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      const result = await this.sessionService.updateActivity(sessionId);
      
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

  async markViewed(req: Request, res: Response): Promise<void> {
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

      const result = await this.sessionService.markItemsAsViewed(sessionId, itemIds);
      
      res.status(200).json(result);
    } catch (error) {
      logger.error('Failed to mark items as viewed:', error);
      res.status(500).json({
        error: 'Failed to mark items as viewed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getSessionStats(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      const stats = await this.sessionService.getSessionStats(sessionId);
      
      if (!stats) {
        res.status(404).json({
          error: 'Session not found',
          sessionId
        });
        return;
      }

      res.status(200).json(stats);
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      res.status(500).json({
        error: 'Failed to get session stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async validateSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      const isValid = await this.sessionService.validateSession(sessionId);
      
      res.status(200).json({
        sessionId,
        isValid,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to validate session:', error);
      res.status(500).json({
        error: 'Failed to validate session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}