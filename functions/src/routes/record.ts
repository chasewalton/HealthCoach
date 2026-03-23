import { Router } from 'express';

import type { AuthenticatedRequest } from '../middleware.js';
import { verifyAuth } from '../middleware.js';
import { adminDb, nowIso } from '../lib/firebaseAdmin.js';
import { HttpError, sendError } from '../lib/http.js';
import { DEFAULT_NOTE_SEED } from '../lib/seeds.js';

const router = Router();

async function getDefaultNote() {
  const ref = adminDb.collection('admin').doc('defaultNote');
  const snap = await ref.get();
  const content = snap.data()?.content;
  if (content) return content;

  await ref.set(
    {
      content: DEFAULT_NOTE_SEED,
      updatedAt: nowIso(),
    },
    { merge: true }
  );
  return DEFAULT_NOTE_SEED;
}

router.get('/api/record', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authToken?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const snapshot = await adminDb
      .collection('records')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const record = snapshot.docs[0].data();
      res.json({
        content: record.content,
        isDefault: false,
      });
      return;
    }

    res.json({
      content: await getDefaultNote(),
      isDefault: true,
    });
  } catch (err) {
    sendError(res, err, 'Could not load the visit note.');
  }
});

router.post('/api/record', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authToken?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rawContent = req.body?.content;
    if (!rawContent) {
      throw new HttpError(400, 'content is required');
    }

    let content = rawContent;
    if (typeof rawContent === 'string') {
      content = {
        type: 'plaintext',
        text: rawContent,
      };
    }

    if (typeof content !== 'object' || Array.isArray(content)) {
      throw new HttpError(400, 'content must be string or object');
    }

    await adminDb.collection('records').add({
      userId: uid,
      content,
      createdAt: nowIso(),
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Could not save the visit note.');
  }
});

router.delete('/api/record', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authToken?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const snapshot = await adminDb.collection('records').where('userId', '==', uid).get();
    if (!snapshot.empty) {
      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    res.json({
      content: await getDefaultNote(),
      isDefault: true,
    });
  } catch (err) {
    sendError(res, err, 'Could not reset the visit note.');
  }
});

export default router;
