import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BeforeInsert } from 'typeorm';
import { SessionView } from './SessionView';

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  session_id!: string;

  @Column({ type: 'text', nullable: true })
  device_fingerprint?: string;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_activity!: Date;

  @Column({ type: 'timestamp' })
  expires_at!: Date;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @OneToMany(() => SessionView, sessionView => sessionView.session)
  views!: SessionView[];

  @BeforeInsert()
  setInitialValues() {
    const now = new Date();
    this.last_activity = now;
    this.expires_at = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
  }

  // Helper methods
  isExpired(): boolean {
    return new Date() > this.expires_at;
  }

  extendSession(): void {
    const now = new Date();
    this.last_activity = now;
    this.expires_at = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
  }
}