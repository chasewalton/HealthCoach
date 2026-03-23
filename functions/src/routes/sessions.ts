import { randomUUID } from 'node:crypto';

import { Router } from 'express';

import type { AuthenticatedRequest } from '../middleware.js';
import { verifyAuth } from '../middleware.js';
import { adminDb, nowIso } from '../lib/firebaseAdmin.js';
import { HttpError, sendError } from '../lib/http.js';

const router = Router();

function sessionIdParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

router.get('/api/sessions', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authToken?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const snapshot = await adminDb
      .collection('sessions')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    res.json({
      sessions: snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          mode: data.mode,
          date: data.dateLabel,
          messages: Array.isArray(data.messages) ? data.messages : [],
        };
      }),
    });
  } catch (err) {
    sendError(res, err, 'Could not load sessions.');
  }
});

router.post('/api/sessions', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authToken?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (!messages.length) {
      throw new HttpError(400, 'messages required');
    }

    const sessionId =
      typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : randomUUID();
    const sessionRef = adminDb.collection('sessions').doc(sessionId);
    const existing = await sessionRef.get();

    if (existing.exists && existing.data()?.userId !== uid) {
      throw new HttpError(404, 'Session not found');
    }

    await sessionRef.set(
      {
        userId: uid,
        mode: typeof req.body?.mode === 'string' ? req.body.mode : 'review',
        dateLabel:
          typeof req.body?.date === 'string' && req.body.date.trim()
            ? req.body.date
            : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        messages,
        createdAt: existing.data()?.createdAt || nowIso(),
      },
      { merge: true }
    );

    res.status(201).json({ id: sessionId });
  } catch (err) {
    sendError(res, err, 'Could not save session.');
  }
});

router.get('/api/sessions/:sessionId', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authToken?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const snapshot = await adminDb.collection('sessions').doc(sessionIdParam(req.params.sessionId)).get();
    const data = snapshot.data();
    if (!snapshot.exists || data?.userId !== uid) {
      throw new HttpError(404, 'Session not found');
    }

    res.json({
      id: snapshot.id,
      mode: data.mode,
      date: data.dateLabel,
      messages: Array.isArray(data.messages) ? data.messages : [],
    });
  } catch (err) {
    sendError(res, err, 'Could not load session.');
  }
});

router.delete('/api/sessions/:sessionId', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authToken?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const sessionRef = adminDb.collection('sessions').doc(sessionIdParam(req.params.sessionId));
    const snapshot = await sessionRef.get();
    if (!snapshot.exists || snapshot.data()?.userId !== uid) {
      throw new HttpError(404, 'Session not found');
    }

    await sessionRef.delete();
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Could not delete session.');
  }
});

export default router;
