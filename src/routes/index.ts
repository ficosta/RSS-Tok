import { Router } from 'express';
import rssRoutes from './rssRoutes';
import { RSSController } from '@/controllers/RSSController';

const router = Router();
const rssController = new RSSController();

// Health check endpoint
router.get('/health', rssController.getHealth);

// RSS routes
router.use('/rss', rssRoutes);

export default router;