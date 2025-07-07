import { Router } from 'express';
import sessionRoutes from './sessionRoutes';
import contentRoutes from './contentRoutes';

const router = Router();

// Mount v2 routes
router.use('/session', sessionRoutes);
router.use('/content', contentRoutes);

// Health check for v2 API
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: 'v2',
    timestamp: new Date().toISOString(),
    features: [
      'infinite-scroll',
      'session-management',
      'content-deduplication',
      'channel-balancing'
    ]
  });
});

export default router;