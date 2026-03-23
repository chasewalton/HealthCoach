import type { DecodedIdToken } from 'firebase-admin/auth';
import type { NextFunction, Request, Response } from 'express';

import { adminAuth } from './lib/firebaseAdmin.js';

export interface AuthenticatedRequest extends Request {
  authToken?: DecodedIdToken;
}

export async function verifyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    req.authToken = await adminAuth.verifyIdToken(match[1]);
    next();
  } catch (_) {
    res.status(401).json({ error: 'Not authenticated' });
  }
}
