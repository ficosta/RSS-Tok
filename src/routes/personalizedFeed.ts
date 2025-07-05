import { Router, Request, Response } from 'express';
import { ItemRepository } from '@/repositories/ItemRepository';
import { logger } from '@/config/logger';

const router = Router();
const itemRepository = new ItemRepository();

/**
 * GET /api/rss/personalized
 * Creates a personalized feed by mixing items from pinned categories with homepage items
 * Query params:
 * - pinnedCategories: comma-separated list of pinned category keys
 * - limit: number of items to return (default: 50)
 * - offset: pagination offset (default: 0)
 */
router.get('/personalized', async (req: Request, res: Response) => {
  try {
    const pinnedCategories = req.query.pinnedCategories as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!pinnedCategories) {
      return res.status(400).json({
        success: false,
        error: 'pinnedCategories parameter is required'
      });
    }

    const categoryArray = pinnedCategories.split(',').filter(cat => cat.trim());
    
    if (categoryArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one pinned category is required'
      });
    }

    logger.info(`Creating personalized feed for categories: ${categoryArray.join(', ')}`);

    // Get items from pinned categories (70% of feed)
    const pinnedItemsLimit = Math.floor(limit * 0.7);
    const pinnedItems = await itemRepository.getPersonalizedFeedItems(
      categoryArray,
      pinnedItemsLimit,
      offset
    );

    // Get homepage/news items (30% of feed) 
    const homepageItemsLimit = limit - pinnedItems.length;
    const homepageItems = await itemRepository.getPersonalizedFeedItems(
      ['homepage', 'news', 'alle'],
      homepageItemsLimit,
      0
    );

    // Mix the items together
    const mixedItems = mixFeedItems(pinnedItems, homepageItems);

    // Get total count for pagination
    const totalCount = await itemRepository.getPersonalizedFeedCount(categoryArray);

    res.json({
      success: true,
      data: mixedItems.slice(0, limit),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      meta: {
        pinnedCategories: categoryArray,
        pinnedItemsCount: pinnedItems.length,
        homepageItemsCount: homepageItems.length
      }
    });

  } catch (error) {
    logger.error('Error creating personalized feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create personalized feed'
    });
  }
});

/**
 * Mix pinned and homepage items together in an engaging pattern
 * Pattern: 2 pinned, 1 homepage, 2 pinned, 1 homepage, etc.
 */
function mixFeedItems(pinnedItems: any[], homepageItems: any[]): any[] {
  const mixed: any[] = [];
  let pinnedIndex = 0;
  let homepageIndex = 0;
  let patternCount = 0;

  while (pinnedIndex < pinnedItems.length || homepageIndex < homepageItems.length) {
    // Add 2 pinned items
    for (let i = 0; i < 2 && pinnedIndex < pinnedItems.length; i++) {
      mixed.push({
        ...pinnedItems[pinnedIndex],
        feedSource: 'pinned'
      });
      pinnedIndex++;
    }

    // Add 1 homepage item
    if (homepageIndex < homepageItems.length) {
      mixed.push({
        ...homepageItems[homepageIndex],
        feedSource: 'homepage'
      });
      homepageIndex++;
    }

    patternCount++;
  }

  return mixed;
}

export default router;