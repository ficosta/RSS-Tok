import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Item } from './Item';
import { FeedChannel } from '@/config/feedUrls';

@Entity('item_channels')
@Index('idx_item_channels_channel_visible', ['channel', 'isVisible'])
@Index('idx_item_channels_item_id', ['itemId'])
export class ItemChannel {
  @PrimaryColumn('text')
  itemId!: string;

  @PrimaryColumn('text')
  channel!: FeedChannel;

  @Column('boolean', { default: true })
  isVisible!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Item, (item) => item.channels, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'itemId' })
  item?: Item;
}