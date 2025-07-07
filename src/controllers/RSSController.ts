import { Request, Response } from 'express';
import { RSSService } from '@/services/RSSService';
import { TranslationService } from '@/services/TranslationService';
import { FeedChannel } from '@/config/feedUrls';
import { ApiResponse, PaginatedResponse } from '@/types';
import { asyncHandler } from '@/middleware/errorHandler';

export class RSSController {
  private rssService: RSSService;
  private translationService: TranslationService;

  constructor() {
    this.rssService = new RSSService();
    this.translationService = new TranslationService();
  }

  getChannelItems = asyncHandler(async (req: Request, res: Response) => {
    const { channel } = req.params;
    const { page = 1, limit = 20, language } = req.query;

    const result = await this.rssService.getChannelItems(
      channel as FeedChannel,
      page as number,
      limit as number
    );

    let items = result.items;

    // Filter by language if specified
    if (language) {
      items = items.filter(item => item.translations[language as string]);
    }

    const response: PaginatedResponse = {
      success: true,
      data: items,
      pagination: {
        page: page as number,
        limit: limit as number,
        total: result.total,
        totalPages: Math.ceil(result.total / (limit as number)),
      },
    };

    res.json(response);
  });

  getStats = asyncHandler(async (req: Request, res: Response) => {
    const rssStats = await this.rssService.getStats();
    const translationStats = await this.translationService.getTranslationStats();

    const response: ApiResponse = {
      success: true,
      data: {
        rss: rssStats,
        translation: translationStats,
      },
    };

    res.json(response);
  });

  getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    const [rssStats, translationStats] = await Promise.all([
      this.rssService.getStats(),
      this.translationService.getTranslationStats()
    ]);

    // Get recent activity from translation jobs
    const recentActivity = await this.getRecentActivity();

    // Get OpenAI job status
    const openAIStatus = await this.translationService.getOpenAIJobsStatus();

    const response: ApiResponse = {
      success: true,
      data: {
        rss: rssStats,
        translation: translationStats,
        openai: openAIStatus,
        activity: recentActivity,
        lastUpdate: new Date().toISOString(),
      },
    };

    res.json(response);
  });

  private async getRecentActivity(): Promise<any[]> {
    // This would be expanded to track actual activity
    return [
      {
        time: new Date().toISOString(),
        type: 'info',
        message: 'RSS feeds updated successfully'
      },
      {
        time: new Date(Date.now() - 60000).toISOString(),
        type: 'success',
        message: 'Translation job completed'
      }
    ];
  }

  getChannels = asyncHandler(async (req: Request, res: Response) => {
    const { FEED_URLS } = await import('@/config/feedUrls');
    
    const channels = Object.keys(FEED_URLS).map(channel => ({
      channel,
      url: FEED_URLS[channel as FeedChannel],
    }));

    const response: ApiResponse = {
      success: true,
      data: channels,
    };

    res.json(response);
  });

  refreshFeeds = asyncHandler(async (req: Request, res: Response) => {
    // Trigger RSS fetch (this will be handled by the cron job in production)
    this.rssService.fetchAllFeeds().catch(error => {
      console.error('Error in background RSS fetch:', error);
    });

    const response: ApiResponse = {
      success: true,
      message: 'RSS feed refresh initiated',
    };

    res.json(response);
  });

  getMetrics = asyncHandler(async (req: Request, res: Response) => {
    const { period = '7d', granularity = 'day' } = req.query;
    
    const metrics = await this.rssService.getTimelineMetrics(
      period as string,
      granularity as string
    );

    const response: ApiResponse = {
      success: true,
      data: metrics,
    };

    res.json(response);
  });

  getChannelMetrics = asyncHandler(async (req: Request, res: Response) => {
    const { period = '7d' } = req.query;
    
    const channelMetrics = await this.rssService.getChannelMetrics(period as string);

    const response: ApiResponse = {
      success: true,
      data: channelMetrics,
    };

    res.json(response);
  });

  getHealth = asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const stats = await this.rssService.getStats();
      const dbResponseTime = Date.now() - startTime;
      
      const response = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        database: {
          status: 'connected',
          responseTime: dbResponseTime,
        },
        services: {
          rss: true,
          translation: true,
        },
        stats,
      };

      res.json(response);
    } catch (error) {
      const response = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        database: {
          status: 'disconnected',
        },
        services: {
          rss: false,
          translation: false,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      res.status(503).json(response);
    }
  });
}