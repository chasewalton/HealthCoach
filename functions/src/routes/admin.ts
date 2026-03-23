import { timingSafeEqual } from 'node:crypto';

import { Router } from 'express';

import { HttpError, sendError } from '../lib/http.js';
import { getResolvedPrompts, savePromptOverrides } from '../lib/prompts.js';

const router = Router();

function passwordsMatch(input: string, secret: string) {
  const left = Buffer.from(input);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireAdminPassword(password: unknown) {
  const configured = process.env.ADMIN_PASSWORD || '';
  if (!configured) {
    throw new HttpError(503, 'Admin access is not configured.');
  }
  if (typeof password !== 'string' || !passwordsMatch(password, configured)) {
    throw new HttpError(401, 'Wrong password.');
  }
}

router.post('/api/admin/prompts', async (req, res) => {
  try {
    requireAdminPassword(req.body?.password);
    res.json({ prompts: await getResolvedPrompts() });
  } catch (err) {
    sendError(res, err, 'Could not load prompts.');
  }
});

router.put('/api/admin/prompts', async (req, res) => {
  try {
    requireAdminPassword(req.body?.password);
    await savePromptOverrides(req.body?.prompts || {});
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Could not save prompts.');
  }
});

export default router;
