import { Router } from 'express';
import { InfiniteContentController } from '../controllers/InfiniteContentController';

const router = Router();
const contentController = new InfiniteContentController();

/**
 * @swagger
 * components:
 *   schemas:
 *     ContentBatch:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Item'
 *         nextCursor:
 *           type: string
 *           nullable: true
 *           description: Cursor for next batch of content
 *         hasMore:
 *           type: boolean
 *           description: Whether more content is available
 *         cycleCount:
 *           type: integer
 *           description: Number of cycles through content (channel mode only)
 *     MarkViewedRequest:
 *       type: object
 *       properties:
 *         itemIds:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of item IDs to mark as viewed
 */

/**
 * @swagger
 * /api/v2/content/home:
 *   get:
 *     summary: Get homepage content with infinite scroll support
 *     tags: [Infinite Content]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Active session ID
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Cursor for pagination (timestamp)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items to return
 *       - in: query
 *         name: maxConsecutive
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           default: 5
 *         description: Maximum consecutive items from same channel
 *     responses:
 *       200:
 *         description: Homepage content retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContentBatch'
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Session expired or invalid
 *       500:
 *         description: Internal server error
 */
router.get('/home', contentController.getHomeContent.bind(contentController));

/**
 * @swagger
 * /api/v2/content/channel/{channelId}:
 *   get:
 *     summary: Get channel-specific content with infinite scroll support
 *     tags: [Infinite Content]
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Channel identifier
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Active session ID
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Cursor for pagination (timestamp)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items to return
 *     responses:
 *       200:
 *         description: Channel content retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContentBatch'
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Session expired or invalid
 *       500:
 *         description: Internal server error
 */
router.get('/channel/:channelId', contentController.getChannelContent.bind(contentController));

/**
 * @swagger
 * /api/v2/content/{sessionId}/viewed:
 *   post:
 *     summary: Mark content items as viewed
 *     tags: [Infinite Content]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MarkViewedRequest'
 *     responses:
 *       200:
 *         description: Items marked as viewed successfully
 *       400:
 *         description: Invalid request format
 *       500:
 *         description: Internal server error
 */
router.post('/:sessionId/viewed', contentController.markContentViewed.bind(contentController));

/**
 * @swagger
 * /api/v2/content/{sessionId}/activity:
 *   put:
 *     summary: Update session activity timestamp
 *     tags: [Infinite Content]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session activity updated successfully
 *       404:
 *         description: Session not found or expired
 *       500:
 *         description: Internal server error
 */
router.put('/:sessionId/activity', contentController.updateSessionActivity.bind(contentController));

export default router;