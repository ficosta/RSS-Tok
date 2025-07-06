import { MigrationInterface, QueryRunner } from 'typeorm';

export class SessionManagement1735782000000 implements MigrationInterface {
  name = 'SessionManagement1735782000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // User sessions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_fingerprint TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 minutes'),
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // Session views tracking table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS session_views (
        session_id UUID NOT NULL,
        item_id TEXT NOT NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, item_id),
        FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items("itemId") ON DELETE CASCADE
      )
    `);

    // Performance indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sessions_device ON user_sessions(device_fingerprint)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active, expires_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_session_views_session_id ON session_views(session_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_session_views_viewed_at ON session_views(viewed_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_session_views_item_lookup ON session_views(item_id, session_id)`);

    // Automatic cleanup function for expired sessions
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
      RETURNS void AS $$
      BEGIN
        -- Mark sessions as inactive if expired
        UPDATE user_sessions 
        SET is_active = FALSE 
        WHERE expires_at < CURRENT_TIMESTAMP AND is_active = TRUE;
        
        -- Delete sessions older than 24 hours
        DELETE FROM user_sessions 
        WHERE expires_at < (CURRENT_TIMESTAMP - INTERVAL '24 hours');
      END;
      $$ LANGUAGE plpgsql
    `);

    // Update session activity trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_session_activity()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE user_sessions 
        SET 
          last_activity = CURRENT_TIMESTAMP,
          expires_at = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
        WHERE session_id = NEW.session_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Trigger to update session activity on view insertion
    await queryRunner.query(`
      CREATE TRIGGER trigger_update_session_activity
        AFTER INSERT ON session_views
        FOR EACH ROW
        EXECUTE FUNCTION update_session_activity()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_update_session_activity ON session_views`);
    
    // Drop functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_session_activity()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS cleanup_expired_sessions()`);
    
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_session_views_item_lookup`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_session_views_viewed_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_session_views_session_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sessions_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sessions_device`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sessions_expires_at`);
    
    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS session_views`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_sessions`);
  }
}