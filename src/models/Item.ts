import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ItemChannel } from './ItemChannel';
import { TranslationJob, Translations, MediaContent, MediaThumbnail } from '@/types';

@Entity('items')
@Index('idx_items_pub_timestamp', ['pubTimestamp'])
@Index('idx_items_translation_status', ['translationJob'])
export class Item {
  @PrimaryColumn('text')
  itemId!: string;

  @Column('text', { nullable: true })
  title?: string;

  @Column('text', { nullable: true })
  content?: string;

  @Column('text', { nullable: true })
  link?: string;

  @Column('text', { nullable: true })
  pubDate?: string;

  @Column('bigint', { nullable: true })
  pubTimestamp?: number;

  @Column('jsonb', { nullable: true })
  mediaContent?: MediaContent;

  @Column('jsonb', { nullable: true })
  mediaThumbnail?: MediaThumbnail;

  @Column('text', { nullable: true })
  mediaCredit?: string;

  @Column('jsonb', { nullable: true })
  categories?: string[];

  @Column('jsonb', { default: {} })
  translationJob!: TranslationJob | Record<string, never>;

  @Column('jsonb', { default: {} })
  translations!: Translations;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => ItemChannel, (itemChannel) => itemChannel.item, {
    cascade: true,
  })
  channels?: ItemChannel[];

  // Helper methods
  hasTranslation(language: string): boolean {
    return !!(this.translations[language]?.title || this.translations[language]?.content);
  }

  isTranslationComplete(): boolean {
    return this.translationJob.status === 'completed';
  }

  isTranslationPending(): boolean {
    return this.translationJob.status === 'processing';
  }
}