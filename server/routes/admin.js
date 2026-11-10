/* =====================================================================
   ADMIN ROUTES (/admin/...)
   Only for the admin account (mounted behind requireAuth AND
   requireAdmin in app.js). Admin power is kept to managing accounts: an
   admin can NOT read other people's binders or lists (a privacy choice).
   - GET /admin/users   everyone's account details (never passwords)
   ===================================================================== */

import { Router } from 'express';
import User from '../models/User.js';
import { handleDbError } from '../middleware/errorHandler.js';
import { parsePaging } from '../utils/paging.js';

const router = Router();

router.get('/users', async (req, res) => {
  const paging = parsePaging(req.query);
  if (paging.error) return res.status(400).json({ error: paging.error });
  try {
    const [users, total] = await Promise.all([
      // Only the fields that are safe to show (password is also off by default)
      User.find().select('email username name role createdAt').sort({ _id: 1 }).skip(paging.skip).limit(paging.limit).lean(),
      User.countDocuments(),
    ]);
    res.set('X-Total-Count', String(total));
    return res.json(users);
  } catch (err) {
    return handleDbError(err, res);
  }
});

export default router;
