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

  async getMetrics(period: string, granularity: string): Promise<any> {
    const now = new Date();
    let startDate: Date;
    let timeFormat: string;
    let groupByFormat: string;

    // Calculate start date based on period
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Set time format based on granularity
    switch (granularity) {
      case 'minute':
        timeFormat = 'YYYY-MM-DD HH24:MI';
        groupByFormat = "to_char(to_timestamp(item.\"pubTimestamp\" / 1000), 'YYYY-MM-DD HH24:MI')";
        break;
      case 'hour':
        timeFormat = 'YYYY-MM-DD HH24';
        groupByFormat = "to_char(to_timestamp(item.\"pubTimestamp\" / 1000), 'YYYY-MM-DD HH24')";
        break;
      case 'day':
        timeFormat = 'YYYY-MM-DD';
        groupByFormat = "to_char(to_timestamp(item.\"pubTimestamp\" / 1000), 'YYYY-MM-DD')";
        break;
      default:
        timeFormat = 'YYYY-MM-DD HH24';
        groupByFormat = "to_char(to_timestamp(item.\"pubTimestamp\" / 1000), 'YYYY-MM-DD HH24')";
    }

    const startTimestamp = startDate.getTime();

    // Get time series data for all channels
    const timeSeriesQuery = `
      SELECT 
        ${groupByFormat} as time_bucket,
        channel.channel,
        COUNT(item."itemId") as count
      FROM items item
      INNER JOIN item_channels channel ON item."itemId" = channel."itemId"
      WHERE item."pubTimestamp" >= $1
        AND channel."isVisible" = true
      GROUP BY time_bucket, channel.channel
      ORDER BY time_bucket ASC, channel.channel ASC
    `;

    const result = await this.repository.query(timeSeriesQuery, [startTimestamp]);

    // Get all unique channels
    const channels = [...new Set(result.map((row: any) => row.channel))];
    
    // Get all unique time buckets
    const timeBuckets = [...new Set(result.map((row: any) => row.time_bucket))];

    // Create time series data structure
    const timeSeriesData = {
      labels: timeBuckets,
      datasets: channels.map(channel => {
        const channelData = timeBuckets.map(bucket => {
          const dataPoint = result.find((row: any) => 
            row.time_bucket === bucket && row.channel === channel
          );
          return dataPoint ? parseInt(dataPoint.count) : 0;
        });

        return {
          label: String(channel),
          data: channelData,
          backgroundColor: this.getChannelColor(String(channel)),
          borderColor: this.getChannelColor(String(channel)),
          fill: false,
        };
      })
    };

    return {
      timeSeries: timeSeriesData,
      period,
      granularity,
      totalItems: result.reduce((sum: number, row: any) => sum + parseInt(row.count), 0),
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    };
  }

  async getChannelMetrics(): Promise<any> {
    const channelStatsQuery = `
      SELECT 
        channel.channel,
        COUNT(item."itemId") as total_items,
        COUNT(CASE WHEN channel."isVisible" = true THEN 1 END) as visible_items,
        COUNT(CASE WHEN item.translations != '{}' THEN 1 END) as translated_items,
        COUNT(CASE WHEN item."translationJob"->>'status' = 'processing' THEN 1 END) as pending_translations,
        MAX(item."pubTimestamp") as latest_item_timestamp,
        MIN(item."pubTimestamp") as oldest_item_timestamp
      FROM items item
      INNER JOIN item_channels channel ON item."itemId" = channel."itemId"
      GROUP BY channel.channel
      ORDER BY total_items DESC
    `;

    const result = await this.repository.query(channelStatsQuery);

    return result.map((row: any) => ({
      channel: row.channel,
      totalItems: parseInt(row.total_items),
      visibleItems: parseInt(row.visible_items),
      translatedItems: parseInt(row.translated_items),
      pendingTranslations: parseInt(row.pending_translations),
      translationPercentage: row.total_items > 0 
        ? Math.round((parseInt(row.translated_items) / parseInt(row.total_items)) * 100)
        : 0,
      latestItemTimestamp: row.latest_item_timestamp ? parseInt(row.latest_item_timestamp) : null,
      oldestItemTimestamp: row.oldest_item_timestamp ? parseInt(row.oldest_item_timestamp) : null,
      color: this.getChannelColor(row.channel),
    }));
  }

  async getHomeContentWithExclusions(options: {
    beforeTimestamp?: number;
    limit: number;
    excludeItemIds: string[];
  }): Promise<Item[]> {
    const { beforeTimestamp, limit, excludeItemIds } = options;
    
    let query = this.repository
      .createQueryBuilder('item')
      .innerJoin('item.channels', 'channel')
      .where('channel.isVisible = true');

    if (beforeTimestamp !== undefined) {
      query = query.andWhere('item.pubTimestamp < :beforeTimestamp', { beforeTimestamp });
    }

    if (excludeItemIds.length > 0) {
      query = query.andWhere('item.itemId NOT IN (:...excludeItemIds)', { excludeItemIds });
    }

    return query
      .orderBy('item.pubTimestamp', 'DESC')
      .take(limit)
      .getMany();
  }

  async getChannelContentWithExclusions(options: {
    channelId: string;
    beforeTimestamp?: number;
    limit: number;
    excludeItemIds: string[];
  }): Promise<Item[]> {
    const { channelId, beforeTimestamp, limit, excludeItemIds } = options;
    
    let query = this.repository
      .createQueryBuilder('item')
      .innerJoin('item.channels', 'channel')
      .where('channel.channel = :channelId', { channelId })
      .andWhere('channel.isVisible = true');

    if (beforeTimestamp !== undefined) {
      query = query.andWhere('item.pubTimestamp < :beforeTimestamp', { beforeTimestamp });
    }

    if (excludeItemIds.length > 0) {
      query = query.andWhere('item.itemId NOT IN (:...excludeItemIds)', { excludeItemIds });
    }

    return query
      .orderBy('item.pubTimestamp', 'DESC')
      .take(limit)
      .getMany();
  }

  async getChannelTotalCount(channelId: string): Promise<number> {
    return this.repository
      .createQueryBuilder('item')
      .innerJoin('item.channels', 'channel')
      .where('channel.channel = :channelId', { channelId })
      .andWhere('channel.isVisible = true')
      .getCount();
  }

  async getTimelineData(startDate: Date, endDate: Date, granularity: string): Promise<any[]> {
    let groupByFormat: string;
    let dateFormat: string;

    switch (granularity) {
      case 'hour':
        groupByFormat = "to_char(to_timestamp(item.\"pubTimestamp\" / 1000), 'YYYY-MM-DD HH24:00')";
        dateFormat = 'YYYY-MM-DD HH24:00';
        break;
      case 'day':
        groupByFormat = "to_char(to_timestamp(item.\"pubTimestamp\" / 1000), 'YYYY-MM-DD')";
        dateFormat = 'YYYY-MM-DD';
        break;
      default:
        groupByFormat = "to_char(to_timestamp(item.\"pubTimestamp\" / 1000), 'YYYY-MM-DD')";
        dateFormat = 'YYYY-MM-DD';
    }

    const query = `
      SELECT 
        ${groupByFormat} as date,
        COUNT(item."itemId") as count
      FROM items item
      INNER JOIN item_channels channel ON item."itemId" = channel."itemId"
      WHERE item."pubTimestamp" >= $1 
        AND item."pubTimestamp" <= $2
        AND channel."isVisible" = true
      GROUP BY ${groupByFormat}
      ORDER BY date ASC
    `;

    const result = await this.repository.query(query, [
      startDate.getTime(),
      endDate.getTime()
    ]);

    return result.map((row: any) => ({
      date: row.date,
      count: parseInt(row.count)
    }));
  }

  async getChannelData(startDate: Date, endDate: Date): Promise<any[]> {
    const query = `
      SELECT 
        channel.channel,
        COUNT(item."itemId") as total_items,
        COUNT(CASE WHEN item.translations != '{}' THEN 1 END) as translated_items,
        ROUND(
          (COUNT(item."itemId")::decimal / 
           (SELECT COUNT(*)::decimal FROM items i2 
            INNER JOIN item_channels c2 ON i2."itemId" = c2."itemId" 
            WHERE i2."pubTimestamp" >= $1 AND i2."pubTimestamp" <= $2 AND c2."isVisible" = true)
          ) * 100, 2
        ) as percentage
      FROM items item
      INNER JOIN item_channels channel ON item."itemId" = channel."itemId"
      WHERE item."pubTimestamp" >= $1 
        AND item."pubTimestamp" <= $2
        AND channel."isVisible" = true
      GROUP BY channel.channel
      ORDER BY total_items DESC
    `;

    const result = await this.repository.query(query, [
      startDate.getTime(),
      endDate.getTime()
    ]);

    return result.map((row: any) => ({
      channel: row.channel,
      totalItems: parseInt(row.total_items),
      translatedItems: parseInt(row.translated_items),
      percentage: parseFloat(row.percentage),
      color: this.getChannelColor(row.channel)
    }));
  }

  private getChannelColor(channel: string): string {
    const colors = {
      'homepage': '#FF6384',
      'sport': '#36A2EB', 
      'news': '#FFCE56',
      'politik': '#4BC0C0',
      'unterhaltung': '#9966FF',
      'ratgeber': '#FF9F40',
      'lifestyle': '#FF6B6B',
      'auto': '#4ECDC4',
      'digital': '#45B7D1',
      'spiele': '#96CEB4',
      'berlin': '#FECA57',
      'hamburg': '#48CAE4',
      'muenchen': '#F38BA8',
      'koeln': '#A8DADC',
      'leipzig': '#F1C0E8',
      'dresden': '#CFBAF0',
      'frankfurt': '#A3E4D7',
      'stuttgart': '#FFD6A5',
      'duesseldorf': '#FFAAA5',
      'hannover': '#C7CEEA',
      'bremen': '#B5EAD7',
      'ruhrgebiet': '#FFB7B2',
      'chemnitz': '#E2C2FF',
      'saarland': '#87CEEB',
      'leserreporter': '#DDA0DD',
      'alle': '#98FB98',
      'default': '#C9CBCF'
    };
    
    return colors[channel as keyof typeof colors] || colors.default;
  }
}