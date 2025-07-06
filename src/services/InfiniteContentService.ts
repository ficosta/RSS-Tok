import { ItemRepository } from '../repositories/ItemRepository';
import { SessionService } from './SessionService';
import { Item } from '../models/Item';
import { logger } from '../config/logger';

export interface ContentBatch {
  items: Item[];
  nextCursor: string | null;
  hasMore: boolean;
  cycleCount?: number;
}

export interface HomeContentOptions {
  sessionId: string;
  cursor?: string;
  limit?: number;
  maxConsecutivePerChannel?: number;
}

export interface ChannelContentOptions {
  sessionId: string;
  channelId: string;
  cursor?: string;
  limit?: number;
}

export class InfiniteContentService {
  private itemRepo: ItemRepository;
  private sessionService: SessionService;

  constructor() {
    this.itemRepo = new ItemRepository();
    this.sessionService = new SessionService();
  }

  async getHomeContent(options: HomeContentOptions): Promise<ContentBatch> {
    const {
      sessionId,
      cursor,
      limit = 20,
      maxConsecutivePerChannel = 5
    } = options;

    try {
      // Validate session
      const isValidSession = await this.sessionService.validateSession(sessionId);
      if (!isValidSession) {
        throw new Error('Invalid or expired session');
      }

      // Get viewed items for this session
      const viewedItemIds = await this.sessionService.getViewedItems(sessionId);
      
      // Parse cursor (timestamp)
      const beforeTimestamp = cursor ? parseInt(cursor) : undefined;

      // Get items with session-based filtering
      const queryOptions: {
        beforeTimestamp?: number;
        limit: number;
        excludeItemIds: string[];
      } = {
        limit: limit * 2, // Get more items to account for channel balancing
        excludeItemIds: viewedItemIds
      };

      if (beforeTimestamp !== undefined) {
        queryOptions.beforeTimestamp = beforeTimestamp;
      }

      const items = await this.itemRepo.getHomeContentWithExclusions(queryOptions);

      // Apply channel balancing
      const balancedItems = this.balanceChannelContent(items, maxConsecutivePerChannel);
      
      // Limit to requested amount
      const limitedItems = balancedItems.slice(0, limit);
      
      // Determine next cursor and hasMore
      const lastItem = limitedItems[limitedItems.length - 1];
      const nextCursor = lastItem?.pubTimestamp?.toString() || null;

      const hasMore = limitedItems.length === limit && items.length > limit;

      logger.debug(`Home content: ${limitedItems.length} items, cursor: ${nextCursor}, hasMore: ${hasMore}`);

      return {
        items: limitedItems,
        nextCursor,
        hasMore
      };
    } catch (error) {
      logger.error('Failed to get home content:', error);
      throw error;
    }
  }

  async getChannelContent(options: ChannelContentOptions): Promise<ContentBatch> {
    const {
      sessionId,
      channelId,
      cursor,
      limit = 20
    } = options;

    try {
      // Validate session
      const isValidSession = await this.sessionService.validateSession(sessionId);
      if (!isValidSession) {
        throw new Error('Invalid or expired session');
      }

      // Get viewed items for this session
      const viewedItemIds = await this.sessionService.getViewedItems(sessionId);
      
      // Parse cursor (timestamp)
      const beforeTimestamp = cursor ? parseInt(cursor) : undefined;

      // Get channel-specific items with session filtering
      const queryOptions: {
        channelId: string;
        beforeTimestamp?: number;
        limit: number;
        excludeItemIds: string[];
      } = {
        channelId,
        limit,
        excludeItemIds: viewedItemIds
      };

      if (beforeTimestamp !== undefined) {
        queryOptions.beforeTimestamp = beforeTimestamp;
      }

      const items = await this.itemRepo.getChannelContentWithExclusions(queryOptions);

      let cycleCount = 0;
      let hasMore = items.length === limit;

      // If no more content available, check if we should cycle
      if (items.length < limit) {
        // Check if there's any content in this channel that we've seen before
        const totalChannelItems = await this.itemRepo.getChannelTotalCount(channelId);
        
        if (totalChannelItems > viewedItemIds.length) {
          // There's content we've seen before, start a new cycle
          cycleCount = 1;
          
          // Get items from beginning, excluding current session views
          const recycledItems = await this.itemRepo.getChannelContentWithExclusions({
            channelId,
            limit: limit - items.length,
            excludeItemIds: viewedItemIds
          });

          items.push(...recycledItems);
          hasMore = true;
        }
      }

      // Determine next cursor
      const lastItem = items[items.length - 1];
      const nextCursor = lastItem?.pubTimestamp?.toString() || null;

      logger.debug(`Channel ${channelId}: ${items.length} items, cycle: ${cycleCount}, hasMore: ${hasMore}`);

      const result: ContentBatch = {
        items,
        nextCursor,
        hasMore
      };

      if (cycleCount > 0) {
        result.cycleCount = cycleCount;
      }

      return result;
    } catch (error) {
      logger.error(`Failed to get channel ${channelId} content:`, error);
      throw error;
    }
  }

  private balanceChannelContent(items: Item[], maxConsecutive: number): Item[] {
    if (items.length === 0) return items;

    const balanced: Item[] = [];
    const channelQueues: { [key: string]: Item[] } = {};
    
    // Group items by channel
    items.forEach(item => {
      const channel = this.extractChannelFromItem(item);
      if (!channelQueues[channel]) {
        channelQueues[channel] = [];
      }
      channelQueues[channel].push(item);
    });

    const channels = Object.keys(channelQueues);
    let channelIndex = 0;
    let consecutiveCount = 0;
    let currentChannel = '';

    // Round-robin through channels with consecutive limit
    while (balanced.length < items.length && channels.length > 0) {
      const channel = channels[channelIndex];
      
      if (channel && channelQueues[channel] && channelQueues[channel].length > 0) {
        const item = channelQueues[channel].shift()!;
        balanced.push(item);

        if (currentChannel === channel) {
          consecutiveCount++;
        } else {
          consecutiveCount = 1;
          currentChannel = channel;
        }

        // If we've hit the consecutive limit, force switch to next channel
        if (consecutiveCount >= maxConsecutive) {
          channelIndex = (channelIndex + 1) % channels.length;
          consecutiveCount = 0;
          currentChannel = '';
        }
      } else {
        // No items in current channel, move to next
        channelIndex = (channelIndex + 1) % channels.length;
      }

      // Safety check to prevent infinite loop
      const hasAvailableItems = channels.some(ch => 
        ch && channelQueues[ch] && channelQueues[ch].length > 0
      );
      
      if (!hasAvailableItems) break;
    }

    return balanced;
  }

  private extractChannelFromItem(item: Item): string {
    // Extract channel from item (implement based on your Item structure)
    // This might be item.source, item.channel, or derived from item.link
    try {
      if (item.link) {
        return new URL(item.link).hostname;
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async markContentAsViewed(sessionId: string, itemIds: string[]): Promise<void> {
    try {
      await this.sessionService.markItemsAsViewed(sessionId, itemIds);
      logger.debug(`Marked ${itemIds.length} items as viewed for session ${sessionId}`);
    } catch (error) {
      logger.error('Failed to mark content as viewed:', error);
      throw error;
    }
  }

  async updateSessionActivity(sessionId: string) {
    try {
      return await this.sessionService.updateActivity(sessionId);
    } catch (error) {
      logger.error('Failed to update session activity:', error);
      throw error;
    }
  }
}