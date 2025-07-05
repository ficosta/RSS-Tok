import { Repository } from 'typeorm';
import { AppDataSource } from '@/config/database';
import { Item } from '@/models/Item';
import { ItemChannel } from '@/models/ItemChannel';
import { FeedChannel } from '@/config/feedUrls';

export class ItemRepository {
  private repository: Repository<Item>;
  private channelRepository: Repository<ItemChannel>;

  constructor() {
    this.repository = AppDataSource.getRepository(Item);
    this.channelRepository = AppDataSource.getRepository(ItemChannel);
  }

  async findByChannel(
    channel: FeedChannel,
    page: number = 1,
    limit: number = 20
  ): Promise<{ items: Item[]; total: number }> {
    const [items, total] = await this.repository
      .createQueryBuilder('item')
      .innerJoin('item.channels', 'channel')
      .where('channel.channel = :channel', { channel })
      .andWhere('channel.isVisible = true')
      .orderBy('item.pubTimestamp', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  async findById(itemId: string): Promise<Item | null> {
    return this.repository.findOne({
      where: { itemId },
      relations: ['channels'],
    });
  }

  async findByTranslationStatus(status: string): Promise<Item[]> {
    return this.repository
      .createQueryBuilder('item')
      .where("item.\"translationJob\"->>'status' = :status", { status })
      .getMany();
  }

  async upsertItem(itemData: Partial<Item>): Promise<Item> {
    const existingItem = await this.repository.findOne({
      where: { itemId: itemData.itemId! },
    });

    if (existingItem) {
      await this.repository.update(itemData.itemId!, itemData);
      const updatedItem = await this.repository.findOne({ where: { itemId: itemData.itemId! } });
      return updatedItem!;
    } else {
      const item = this.repository.create(itemData);
      return this.repository.save(item);
    }
  }

  async upsertItemChannel(itemId: string, channel: FeedChannel, isVisible: boolean = true): Promise<ItemChannel> {
    const existingChannel = await this.channelRepository.findOne({
      where: { itemId, channel },
    });

    if (existingChannel) {
      existingChannel.isVisible = isVisible;
      return this.channelRepository.save(existingChannel);
    } else {
      const itemChannel = this.channelRepository.create({
        itemId,
        channel,
        isVisible,
      });
      return this.channelRepository.save(itemChannel);
    }
  }

  async updateItemVisibility(
    channel: FeedChannel,
    visibleItemIds: string[],
    invisibleItemIds: string[]
  ): Promise<void> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Mark items as visible
      if (visibleItemIds.length > 0) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(ItemChannel)
          .set({ isVisible: true })
          .where('channel = :channel', { channel })
          .andWhere('itemId IN (:...itemIds)', { itemIds: visibleItemIds })
          .execute();
      }

      // Mark items as invisible
      if (invisibleItemIds.length > 0) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(ItemChannel)
          .set({ isVisible: false })
          .where('channel = :channel', { channel })
          .andWhere('itemId IN (:...itemIds)', { itemIds: invisibleItemIds })
          .execute();
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateTranslationJob(itemId: string, translationJob: any): Promise<void> {
    await this.repository.update(itemId, { translationJob });
  }

  async updateTranslations(itemId: string, translations: any): Promise<void> {
    await this.repository.update(itemId, { translations });
  }

  async getStats(): Promise<{
    totalItems: number;
    itemsWithTranslations: number;
    pendingTranslations: number;
  }> {
    const totalItems = await this.repository.count();
    
    const itemsWithTranslations = await this.repository
      .createQueryBuilder('item')
      .where("item.translations != '{}'")
      .getCount();

    const pendingTranslations = await this.repository
      .createQueryBuilder('item')
      .where("item.\"translationJob\"->>'status' = 'processing'")
      .getCount();

    return {
      totalItems,
      itemsWithTranslations,
      pendingTranslations,
    };
  }

  async getPersonalizedFeedItems(
    channels: string[],
    limit: number,
    offset: number
  ): Promise<Item[]> {
    return this.repository
      .createQueryBuilder('item')
      .innerJoin('item.channels', 'channel')
      .where('channel.channel IN (:...channels)', { channels })
      .andWhere('channel.isVisible = true')
      .orderBy('item.pubTimestamp', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();
  }

  async getPersonalizedFeedCount(channels: string[]): Promise<number> {
    return this.repository
      .createQueryBuilder('item')
      .innerJoin('item.channels', 'channel')
      .where('channel.channel IN (:...channels)', { channels })
      .andWhere('channel.isVisible = true')
      .getCount();
  }
}