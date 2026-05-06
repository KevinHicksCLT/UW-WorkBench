import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listForUser, markRead } from '../services/notifications.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const items = await listForUser(req.user.id);
    res.json(items);
  } catch (e) { next(e); }
});

router.post('/:id/read', async (req, res, next) => {
  try {
    await markRead(req.params.id, req.user.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
