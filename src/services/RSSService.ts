import Parser from 'rss-parser';
import { ItemRepository } from '@/repositories/ItemRepository';
import { TranslationService } from './TranslationService';
import { logger } from '@/config/logger';
import { FEED_URLS, FeedChannel } from '@/config/feedUrls';
import { RSSItem } from '@/types';

export class RSSService {
  private parser: Parser;
  private itemRepository: ItemRepository;
  private translationService: TranslationService;

  constructor() {
    this.parser = new Parser({
      customFields: {
        item: ['media:content', 'media:thumbnail', 'media:credit'],
      },
    });
    this.itemRepository = new ItemRepository();
    this.translationService = new TranslationService();
  }

  async fetchAllFeeds(): Promise<void> {
    logger.info('Starting RSS feed fetch for all channels');
    
    const promises = Object.entries(FEED_URLS).map(([channel, url]) =>
      this.fetchFeedForChannel(channel as FeedChannel, url)
    );

    await Promise.allSettled(promises);
    logger.info('Completed RSS feed fetch for all channels');
  }

  async fetchFeedForChannel(channel: FeedChannel, feedUrl: string): Promise<void> {
    try {
      logger.info(`Fetching RSS feed for channel: ${channel}`, { channel, feedUrl });
      
      const feed = await this.parser.parseURL(feedUrl);
      const currentItemIds: string[] = [];

      for (const item of feed.items) {
        const itemId = this.generateItemId(item);
        if (!itemId) continue;

        currentItemIds.push(itemId);

        try {
          // Save/update item
          await this.saveRSSItem(item, itemId);
          
          // Update channel visibility
          await this.itemRepository.upsertItemChannel(itemId, channel, true);
          
          // Check if translation is needed
          await this.checkAndCreateTranslation(itemId, item);
          
        } catch (error) {
          logger.error(`Error processing item ${itemId}:`, error);
        }
      }

      // Update visibility for items no longer in feed
      await this.updateItemVisibility(channel, currentItemIds);
      
      logger.info(`Successfully processed ${currentItemIds.length} items for channel ${channel}`);
      
    } catch (error) {
      logger.error(`Error fetching RSS feed for channel ${channel}:`, error);
      throw error;
    }
  }

  private generateItemId(item: RSSItem): string | null {
    return item.guid || item.link || item.title || null;
  }

  private async saveRSSItem(item: RSSItem, itemId: string): Promise<void> {
    let pubTimestamp = Date.now();
    
    if (item.pubDate) {
      try {
        // Handle various date formats and fix timezone
        const dateStr = item.pubDate.replace('CET', 'GMT+0100').replace('CEST', 'GMT+0200');
        const parsedDate = new Date(dateStr);
        
        // Validate the date and ensure it's not in the future beyond reasonable bounds
        if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() < Date.now() + 86400000) { // Not more than 1 day in future
          pubTimestamp = parsedDate.getTime();
        } else {
          logger.warn(`Invalid or future date for item ${itemId}: ${item.pubDate}, using current time`);
        }
      } catch (error) {
        logger.warn(`Failed to parse date for item ${itemId}: ${item.pubDate}, using current time`);
      }
    }

    const itemData = {
      itemId,
      title: item.title || '',
      content: item.content || '',
      link: item.link || '',
      pubDate: item.pubDate || '',
      pubTimestamp,
      mediaContent: item['media:content'] || {},
      mediaThumbnail: item['media:thumbnail'] || {},
      mediaCredit: item['media:credit'] || '',
      categories: item.categories || [],
    };

    await this.itemRepository.upsertItem(itemData);
  }

  private async checkAndCreateTranslation(itemId: string, item: RSSItem): Promise<void> {
    const existingItem = await this.itemRepository.findById(itemId);
    
    if (!existingItem || 
        !existingItem.translationJob || 
        Object.keys(existingItem.translationJob).length === 0) {
      
      logger.info(`Creating translation job for item ${itemId}`);
      
      await this.translationService.createTranslationJob({
        itemId,
        title: item.title || '',
        content: item.content || '',
        link: item.link || '',
        pubDate: item.pubDate || '',
        mediaContent: item['media:content'] || {},
        mediaThumbnail: item['media:thumbnail'] || {},
        mediaCredit: item['media:credit'] || '',
        categories: item.categories || [],
      });
    }
  }

  private async updateItemVisibility(channel: FeedChannel, currentItemIds: string[]): Promise<void> {
    if (currentItemIds.length === 0) {
      logger.warn(`No items found for channel ${channel}, marking all as invisible`);
      return;
    }

    // Get all items for this channel
    const allChannelItems = await this.itemRepository.findByChannel(channel, 1, 10000);
    const allItemIds = allChannelItems.items.map(item => item.itemId);
    
    // Find items that are no longer in the feed
    const invisibleItemIds = allItemIds.filter(id => !currentItemIds.includes(id));
    
    if (invisibleItemIds.length > 0) {
      logger.info(`Marking ${invisibleItemIds.length} items as invisible for channel ${channel}`);
      await this.itemRepository.updateItemVisibility(channel, currentItemIds, invisibleItemIds);
    }
  }

  async getChannelItems(
    channel: FeedChannel,
    page: number = 1,
    limit: number = 20
  ): Promise<{ items: any[]; total: number }> {
    const result = await this.itemRepository.findByChannel(channel, page, limit);
    
    return {
      items: result.items.map(item => ({
        itemId: item.itemId,
        title: item.title,
        content: item.content,
        link: item.link,
        pubDate: item.pubDate,
        pubTimestamp: item.pubTimestamp,
        mediaContent: item.mediaContent,
        mediaThumbnail: item.mediaThumbnail,
        mediaCredit: item.mediaCredit,
        categories: item.categories,
        translations: item.translations,
        hasTranslation: Object.keys(item.translations).length > 0,
      })),
      total: result.total,
    };
  }

  async getStats(): Promise<any> {
    return this.itemRepository.getStats();
  }
}