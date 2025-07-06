import { Router } from 'express';
import { SessionController } from '../controllers/SessionController';

const router = Router();
const sessionController = new SessionController();

/**
 * @swagger
 * components:
 *   schemas:
 *     SessionStartRequest:
 *       type: object
 *       properties:
 *         deviceFingerprint:
 *           type: string
 *           description: Optional device fingerprint for session identification
 *         existingSessionId:
 *           type: string
 *           description: Existing session ID to reactivate
 *     SessionStartResponse:
 *       type: object
 *       properties:
 *         sessionId:
 *           type: string
 *           description: Unique session identifier
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Session expiration timestamp
 *         isNew:
 *           type: boolean
 *           description: Whether this is a new session or reactivated existing one
 *     ViewedItemsRequest:
 *       type: object
 *       properties:
 *         itemIds:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of item IDs to mark as viewed
 *     ViewedItemsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         viewedCount:
 *           type: integer
 *         sessionId:
 *           type: string
 */

/**
 * @swagger
 * /api/v2/session/start:
 *   post:
 *     summary: Start a new session or reactivate existing one
 *     tags: [Session Management]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SessionStartRequest'
 *     responses:
 *       200:
 *         description: Session created or reactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionStartResponse'
 *       500:
 *         description: Internal server error
 */
router.post('/start', sessionController.startSession.bind(sessionController));

/**
 * @swagger
 * /api/v2/session/{sessionId}/activity:
 *   put:
 *     summary: Update session activity and extend expiration
 *     tags: [Session Management]
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
router.put('/:sessionId/activity', sessionController.updateActivity.bind(sessionController));

/**
 * @swagger
 * /api/v2/session/{sessionId}/views:
 *   post:
 *     summary: Mark items as viewed in current session
 *     tags: [Session Management]
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
 *             $ref: '#/components/schemas/ViewedItemsRequest'
 *     responses:
 *       200:
 *         description: Items marked as viewed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ViewedItemsResponse'
 *       400:
 *         description: Invalid request format
 *       500:
 *         description: Internal server error
 */
router.post('/:sessionId/views', sessionController.markViewed.bind(sessionController));

/**
 * @swagger
 * /api/v2/session/{sessionId}/stats:
 *   get:
 *     summary: Get session statistics
 *     tags: [Session Management]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session statistics retrieved successfully
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.get('/:sessionId/stats', sessionController.getSessionStats.bind(sessionController));

/**
 * @swagger
 * /api/v2/session/{sessionId}/validate:
 *   get:
 *     summary: Validate session status
 *     tags: [Session Management]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session validation result
 *       500:
 *         description: Internal server error
 */
router.get('/:sessionId/validate', sessionController.validateSession.bind(sessionController));

export default router;