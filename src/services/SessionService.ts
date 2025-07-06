import { SessionRepository } from '../repositories/SessionRepository';
import { UserSession } from '../models/UserSession';
import { logger } from '../config/logger';

export interface SessionStartResponse {
  sessionId: string;
  expiresAt: Date;
  isNew: boolean;
}

export interface SessionActivityResponse {
  sessionId: string;
  expiresAt: Date;
}

export interface ViewedItemsResponse {
  success: boolean;
  viewedCount: number;
  sessionId: string;
}

export class SessionService {
  private sessionRepo: SessionRepository;

  constructor() {
    this.sessionRepo = new SessionRepository();
  }

  async startSession(deviceFingerprint?: string, existingSessionId?: string): Promise<SessionStartResponse> {
    try {
      // Try to reactivate existing session if provided
      if (existingSessionId) {
        const existingSession = await this.sessionRepo.findActiveSession(existingSessionId);
        if (existingSession) {
          const extendedSession = await this.sessionRepo.extendSession(existingSessionId);
          if (extendedSession) {
            logger.info(`Reactivated existing session: ${existingSessionId}`);
            return {
              sessionId: extendedSession.session_id,
              expiresAt: extendedSession.expires_at,
              isNew: false
            };
          }
        }
      }

      // Create new session
      const newSession = await this.sessionRepo.createSession(deviceFingerprint);
      logger.info(`Created new session: ${newSession.session_id}`);
      
      return {
        sessionId: newSession.session_id,
        expiresAt: newSession.expires_at,
        isNew: true
      };
    } catch (error) {
      logger.error('Failed to start session:', error);
      throw new Error('Failed to create session');
    }
  }

  async updateActivity(sessionId: string): Promise<SessionActivityResponse | null> {
    try {
      const session = await this.sessionRepo.extendSession(sessionId);
      if (!session) {
        logger.warn(`Attempted to update activity for invalid session: ${sessionId}`);
        return null;
      }

      return {
        sessionId: session.session_id,
        expiresAt: session.expires_at
      };
    } catch (error) {
      logger.error(`Failed to update session activity: ${sessionId}`, error);
      throw new Error('Failed to update session activity');
    }
  }

  async markItemsAsViewed(sessionId: string, itemIds: string[]): Promise<ViewedItemsResponse> {
    try {
      if (itemIds.length === 0) {
        return {
          success: true,
          viewedCount: 0,
          sessionId
        };
      }

      const viewedCount = await this.sessionRepo.addViewedItems(sessionId, itemIds);
      
      logger.debug(`Marked ${viewedCount} items as viewed for session ${sessionId}`);
      
      return {
        success: true,
        viewedCount,
        sessionId
      };
    } catch (error) {
      logger.error(`Failed to mark items as viewed for session ${sessionId}:`, error);
      return {
        success: false,
        viewedCount: 0,
        sessionId
      };
    }
  }

  async getViewedItems(sessionId: string): Promise<string[]> {
    try {
      return await this.sessionRepo.getViewedItemIds(sessionId);
    } catch (error) {
      logger.error(`Failed to get viewed items for session ${sessionId}:`, error);
      return [];
    }
  }

  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.sessionRepo.findActiveSession(sessionId);
      return session !== null;
    } catch (error) {
      logger.error(`Failed to validate session ${sessionId}:`, error);
      return false;
    }
  }

  async getSessionStats(sessionId: string) {
    try {
      return await this.sessionRepo.getSessionStats(sessionId);
    } catch (error) {
      logger.error(`Failed to get session stats for ${sessionId}:`, error);
      return null;
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      await this.sessionRepo.cleanupExpiredSessions();
      logger.info('Cleaned up expired sessions');
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
    }
  }
}