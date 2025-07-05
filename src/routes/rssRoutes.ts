import { Router } from 'express';
import { RSSController } from '@/controllers/RSSController';
import { validateRequest } from '@/middleware/validation';
import { getChannelItemsSchema } from '@/validators/rssValidators';
import personalizedFeedRouter from './personalizedFeed';

const router = Router();
const rssController = new RSSController();

/**
 * @swagger
 * /api/rss/channels:
 *   get:
 *     summary: Get all available RSS channels
 *     tags: [RSS]
 *     responses:
 *       200:
 *         description: List of available channels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       channel:
 *                         type: string
 *                       url:
 *                         type: string
 */
router.get('/channels', rssController.getChannels);

/**
 * @swagger
 * /api/rss/stats:
 *   get:
 *     summary: Get RSS and translation statistics
 *     tags: [RSS]
 *     responses:
 *       200:
 *         description: Statistics data
 */
router.get('/stats', rssController.getStats);
router.get('/dashboard-stats', rssController.getDashboardStats);

/**
 * @swagger
 * /api/rss/refresh:
 *   post:
 *     summary: Trigger RSS feed refresh
 *     tags: [RSS]
 *     responses:
 *       200:
 *         description: Refresh initiated
 */
router.post('/refresh', rssController.refreshFeeds);

// Use personalized feed routes FIRST - specific routes before parameterized routes
router.use('/', personalizedFeedRouter);

/**
 * @swagger
 * /api/rss/{channel}:
 *   get:
 *     summary: Get RSS items for a specific channel
 *     tags: [RSS]
 *     parameters:
 *       - in: path
 *         name: channel
 *         required: true
 *         schema:
 *           type: string
 *         description: Channel name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           enum: [en, pt, es, tr]
 *         description: Filter by translation language
 *     responses:
 *       200:
 *         description: List of RSS items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/:channel', validateRequest(getChannelItemsSchema), rssController.getChannelItems);

export default router;