import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { UserSession } from '../models/UserSession';
import { SessionView } from '../models/SessionView';

export class SessionRepository {
  private sessionRepo: Repository<UserSession>;
  private sessionViewRepo: Repository<SessionView>;

  constructor() {
    this.sessionRepo = AppDataSource.getRepository(UserSession);
    this.sessionViewRepo = AppDataSource.getRepository(SessionView);
  }

  async createSession(deviceFingerprint?: string): Promise<UserSession> {
    const sessionData: Partial<UserSession> = {
      is_active: true
    };

    if (deviceFingerprint) {
      sessionData.device_fingerprint = deviceFingerprint;
    }

    const session = this.sessionRepo.create(sessionData);
    
    return await this.sessionRepo.save(session);
  }

  async findActiveSession(sessionId: string): Promise<UserSession | null> {
    const session = await this.sessionRepo.findOne({
      where: { 
        session_id: sessionId,
        is_active: true
      }
    });

    if (!session || session.isExpired()) {
      if (session) {
        await this.deactivateSession(sessionId);
      }
      return null;
    }

    return session;
  }

  async extendSession(sessionId: string): Promise<UserSession | null> {
    const session = await this.findActiveSession(sessionId);
    if (!session) return null;

    session.extendSession();
    return await this.sessionRepo.save(session);
  }

  async deactivateSession(sessionId: string): Promise<void> {
    await this.sessionRepo.update(
      { session_id: sessionId },
      { is_active: false }
    );
  }

  async addViewedItems(sessionId: string, itemIds: string[]): Promise<number> {
    const session = await this.findActiveSession(sessionId);
    if (!session) return 0;

    const viewEntries = itemIds.map(itemId => ({
      session_id: sessionId,
      item_id: itemId
    }));

    // Use INSERT IGNORE equivalent (ON CONFLICT DO NOTHING)
    const result = await this.sessionViewRepo
      .createQueryBuilder()
      .insert()
      .into(SessionView)
      .values(viewEntries)
      .orIgnore()
      .execute();

    // Extend session activity
    await this.extendSession(sessionId);

    return result.raw.affectedRows || viewEntries.length;
  }

  async getViewedItemIds(sessionId: string): Promise<string[]> {
    const views = await this.sessionViewRepo.find({
      where: { session_id: sessionId },
      select: ['item_id']
    });

    return views.map(view => view.item_id);
  }

  async cleanupExpiredSessions(): Promise<void> {
    // Mark expired sessions as inactive
    await this.sessionRepo
      .createQueryBuilder()
      .update(UserSession)
      .set({ is_active: false })
      .where('expires_at < CURRENT_TIMESTAMP')
      .andWhere('is_active = true')
      .execute();

    // Delete sessions older than 24 hours
    await this.sessionRepo
      .createQueryBuilder()
      .delete()
      .from(UserSession)
      .where('expires_at < (CURRENT_TIMESTAMP - INTERVAL \'24 hours\')')
      .execute();
  }

  async getSessionStats(sessionId: string): Promise<{
    totalViewed: number;
    sessionAge: number;
    isActive: boolean;
  } | null> {
    const session = await this.sessionRepo.findOne({
      where: { session_id: sessionId },
      relations: ['views']
    });

    if (!session) return null;

    const sessionAge = Date.now() - session.created_at.getTime();
    
    return {
      totalViewed: session.views?.length || 0,
      sessionAge: Math.floor(sessionAge / 1000 / 60), // in minutes
      isActive: session.is_active && !session.isExpired()
    };
  }
}