import OpenAI from 'openai';
import { Router } from 'express';

import type { AuthenticatedRequest } from '../middleware.js';
import { verifyAuth } from '../middleware.js';
import { HttpError } from '../lib/http.js';
import { createChatCompletion, isOpenRouterConfigured } from '../lib/openrouter.js';
import {
  DEFAULT_MODEL_PREF,
  LEGACY_DEFAULT_MODEL_PREF,
  MODEL_MAP,
  getSummaryPrompt,
  getSystemPrompt,
} from '../lib/prompts.js';
import { getProfileResponse } from '../lib/users.js';

const router = Router();

const CHAT_MAX_TOKENS = 1200;
const CHAT_TEMPERATURE = 0.7;
const SUMMARY_MAX_TOKENS = 1000;
const SUMMARY_TEMPERATURE = 0.5;
const HISTORY_LIMIT = 30;

function resolveModel(modelPref: unknown) {
  const pref = typeof modelPref === 'string' ? modelPref : DEFAULT_MODEL_PREF;
  if (pref === LEGACY_DEFAULT_MODEL_PREF) {
    return MODEL_MAP[DEFAULT_MODEL_PREF];
  }
  return MODEL_MAP[pref] || MODEL_MAP[DEFAULT_MODEL_PREF];
}

function responseText(content: unknown) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part: Record<string, unknown>) => (typeof part.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();
  }
  return '';
}

router.post('/api/chat', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.authToken) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      throw new HttpError(400, 'message is required');
    }
    if (!isOpenRouterConfigured()) {
      throw new HttpError(503, 'AI is not configured. Set OPENROUTER_API_KEY in Firebase secrets.');
    }

    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const mode = typeof req.body?.mode === 'string' ? req.body.mode : 'review';
    const path = typeof req.body?.path === 'string' ? req.body.path : 'guided';
    const record = req.body?.record || {};

    const { profile } = await getProfileResponse(req.authToken.uid, req.authToken);
    const systemPrompt = await getSystemPrompt(
      mode,
      path,
      '6th grade',
      String(profile.language || 'en'),
      mode === 'review' || mode === 'dashboard' || mode === 'combined' ? record : undefined
    );

    const trimmedHistory = history.length > HISTORY_LIMIT ? history.slice(-HISTORY_LIMIT) : history;
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: 'system', content: systemPrompt }];

    for (const turn of trimmedHistory) {
      const role = turn?.role;
      const content = typeof turn?.content === 'string' ? turn.content : '';
      if ((role === 'user' || role === 'assistant') && content) {
        messages.push({ role, content });
      }
    }

    messages.push({ role: 'user', content: message });

    const response = await createChatCompletion({
      model: resolveModel(profile.modelPref),
      messages,
      max_tokens: CHAT_MAX_TOKENS,
      temperature: CHAT_TEMPERATURE,
    });

    res.json({ reply: responseText(response.choices[0]?.message?.content) });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(502).json({ error: 'AI service unavailable. Please try again shortly.' });
  }
});

router.post('/api/summary', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.authToken) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const mode = typeof req.body?.mode === 'string' ? req.body.mode : 'review';

    if (!history.length) {
      throw new HttpError(400, 'No conversation to summarize.');
    }
    if (!isOpenRouterConfigured()) {
      throw new HttpError(503, 'AI is not configured. Set OPENROUTER_API_KEY in Firebase secrets.');
    }

    const { profile } = await getProfileResponse(req.authToken.uid, req.authToken);
    const systemPrompt = await getSummaryPrompt(mode, '6th grade', String(profile.language || 'en'));

    const conversation = history
      .filter(
        (turn: Record<string, unknown>) =>
          (turn?.role === 'user' || turn?.role === 'assistant') && typeof turn?.content === 'string'
      )
      .map(
        (turn: Record<string, unknown>) =>
          `${turn.role === 'user' ? 'Patient' : 'HealthCoach'}: ${String(turn.content)}`
      )
      .join('\n');

    const response = await createChatCompletion({
      model: resolveModel(profile.modelPref),
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Here is the conversation:\n\n${conversation}\n\nPlease write the summary now.`,
        },
      ],
      max_tokens: SUMMARY_MAX_TOKENS,
      temperature: SUMMARY_TEMPERATURE,
    });

    res.json({ summary: responseText(response.choices[0]?.message?.content) });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(502).json({ error: 'Could not generate summary. Please try again.' });
  }
});

export default router;
