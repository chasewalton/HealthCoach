import { Router } from 'express';

import type { AuthenticatedRequest } from '../middleware.js';
import { verifyAuth } from '../middleware.js';
import { adminDb, nowIso } from '../lib/firebaseAdmin.js';
import { sendError } from '../lib/http.js';

const router = Router();

interface ShareRecipient {
  selected: boolean;
  contact: string;
}

interface SummaryShareIntentDoc {
  provider: ShareRecipient;
  self: ShareRecipient;
  caretaker: ShareRecipient;
  other: ShareRecipient;
}

function clampStr(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function normalizeRecipient(raw: unknown): ShareRecipient {
  if (!raw || typeof raw !== 'object') return { selected: false, contact: '' };
  const o = raw as Record<string, unknown>;
  const selected = o.selected === true;
  const contact = clampStr(o.contact, 500);
  return { selected, contact: selected ? contact : '' };
}

function normalizeSummaryShareIntent(raw: unknown): SummaryShareIntentDoc {
  if (!raw || typeof raw !== 'object') {
    return {
      provider: { selected: false, contact: '' },
      self: { selected: false, contact: '' },
      caretaker: { selected: false, contact: '' },
      other: { selected: false, contact: '' },
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    provider: normalizeRecipient(o.provider),
    self: normalizeRecipient(o.self),
    caretaker: normalizeRecipient(o.caretaker),
    other: normalizeRecipient(o.other),
  };
}

function clampLikert(value: unknown): number | null {
  let n: number;
  if (typeof value === 'number' && Number.isFinite(value)) n = Math.round(value);
  else if (typeof value === 'string' && /^\d+$/.test(value)) n = parseInt(value, 10);
  else return null;
  if (n >= 1 && n <= 5) return n;
  return null;
}

router.post('/api/feedback', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authToken?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const body = req.body || {};
    const type = typeof body.type === 'string' ? body.type : 'general';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;

    if (type === 'summary_share_intent') {
      const summaryShareIntent = normalizeSummaryShareIntent(body.summaryShareIntent);
      const chatMode =
        body.chatMode === 'review' || body.chatMode === 'prepare' || body.chatMode === 'combined'
          ? body.chatMode
          : null;
      await adminDb.collection('feedback').add({
        userId: uid,
        sessionId,
        type: 'summary_share_intent',
        chatMode,
        summaryShareIntent,
        createdAt: nowIso(),
      });
      res.json({ ok: true });
      return;
    }

    const { noticedErrors, details } = body;

    const summaryEasyToUnderstand = clampLikert(body.summaryEasyToUnderstand);
    const summaryUseful = clampLikert(body.summaryUseful);

    await adminDb.collection('feedback').add({
      userId: uid,
      sessionId,
      type,
      summaryEasyToUnderstand,
      summaryUseful,
      noticedErrors: noticedErrors === true,
      details: typeof details === 'string' ? details.slice(0, 2000) : '',
      createdAt: nowIso(),
    });

    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Could not save feedback.');
  }
});

export default router;
