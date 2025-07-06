import { Entity, Column, CreateDateColumn, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { UserSession } from './UserSession';
import { Item } from './Item';

@Entity('session_views')
export class SessionView {
  @PrimaryColumn('uuid')
  session_id!: string;

  @PrimaryColumn('text')
  item_id!: string;

  @CreateDateColumn()
  viewed_at!: Date;

  @ManyToOne(() => UserSession, session => session.views, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: UserSession;

  @ManyToOne(() => Item, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: Item;
}