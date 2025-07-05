import { z } from 'zod';
import { FEED_URLS } from '@/config/feedUrls';

const feedChannels = Object.keys(FEED_URLS) as [string, ...string[]];

export const getChannelItemsSchema = {
  params: z.object({
    channel: z.enum(feedChannels, {
      errorMap: () => ({ message: `Channel must be one of: ${feedChannels.join(', ')}` }),
    }),
  }),
  query: z.object({
    page: z.string().optional().transform((val) => {
      if (!val) return 1;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
    limit: z.string().optional().transform((val) => {
      if (!val) return 20;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 20 : Math.min(parsed, 100);
    }),
    language: z.enum(['en', 'pt', 'es', 'tr']).optional(),
  }),
};

export const getItemSchema = {
  params: z.object({
    itemId: z.string().min(1, 'Item ID is required'),
  }),
};