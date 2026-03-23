import { Router } from 'express';

import type { AuthenticatedRequest } from '../middleware.js';
import { verifyAuth } from '../middleware.js';
import { sendError } from '../lib/http.js';
import { getProfileResponse, saveProfile } from '../lib/users.js';

const router = Router();

router.get('/api/profile', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.authToken) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.json(await getProfileResponse(req.authToken.uid, req.authToken));
  } catch (err) {
    sendError(res, err, 'Could not load profile.');
  }
});

router.put('/api/profile', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.authToken) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.json(await saveProfile(req.authToken.uid, req.authToken, req.body || {}));
  } catch (err) {
    sendError(res, err, 'Could not save profile.');
  }
});

export default router;
