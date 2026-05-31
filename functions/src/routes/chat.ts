import OpenAI from 'openai';
import { Router } from 'express';

import type { AuthenticatedRequest } from '../middleware.js';
import { verifyAuth } from '../middleware.js';
import { HttpError } from '../lib/http.js';
import { createChatCompletion, isOpenRouterConfigured } from '../lib/openrouter.js';
import {
  BRIEF_ACK_CHAT_SUFFIX,
  DEFAULT_MODEL_PREF,
  LEGACY_DEFAULT_MODEL_PREF,
  MODEL_MAP,
  getDashboardBriefAckSystem,
  getHandoffSummaryReviseSystem,
  getHandoffSummarySystem,
  getProviderQuestionSuggestionsSystem,
  getReviewFocusSuggestionsSystem,
  getSinceVisitRecapPrompt,
  getSummaryPrompt,
  getSystemPrompt,
} from '../lib/prompts.js';
import { DEFAULT_NOTE_SEED, SINCE_VISIT_TIMELINE_SEED } from '../lib/seeds.js';
import { getProfileResponse } from '../lib/users.js';

const router = Router();

const CHAT_MAX_TOKENS = 1200;
const CHAT_TEMPERATURE = 0.7;
const SUMMARY_MAX_TOKENS = 1000;
const SUMMARY_TEMPERATURE = 0.5;
const REVIEW_FOCUS_SUGGESTIONS_MAX_TOKENS = 500;
const REVIEW_FOCUS_SUGGESTIONS_TEMPERATURE = 0.35;
const PROVIDER_QUESTION_SUGGESTIONS_MAX_TOKENS = 700;
const PROVIDER_QUESTION_SUGGESTIONS_TEMPERATURE = 0.35;
const PROVIDER_QUESTION_SUGGESTIONS_MSG_LIMIT = 50;
const HANDOFF_SUMMARY_MAX_TOKENS = 900;
const HANDOFF_SUMMARY_TEMPERATURE = 0.35;
const HANDOFF_SUMMARY_MSG_LIMIT = 80;
const HANDOFF_SUMMARY_REVISE_MAX_TOKENS = 900;
const HANDOFF_SUMMARY_REVISE_TEMPERATURE = 0.35;
const HANDOFF_SUMMARY_REVISE_MSG_LIMIT = 80;
const HISTORY_LIMIT = 30;
const SINCE_VISIT_RECAP_MAX_TOKENS = 900;
const SINCE_VISIT_RECAP_TEMPERATURE = 0.45;

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

function cleanHandoffSummaryText(text: string): string {
  return text
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*(?:Last Visit Recap|Last Visit Summary|Your Last Visit)\s*:?\s*$/gim, '')
    .replace(/\bNo safety concerns(?:\s+or\s+new\s+symptoms)?(?:\s+to\s+report)?\.?/gi, '')
    .replace(/\bsafety concerns\b/gi, 'urgent symptoms')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Landing-dashboard checklist context captured from structured checklist forms
 * (since-visit, legacy concerns checkbox export, visit goals + optional note)
 * and optional going-well free text.
 * Rendered as a plain-text block so it can be attached to any prompt where
 * the LLM needs to reference these structured patient-submitted details
 * distinctly from the free-form chat transcript.
 */
type LandingChecklistEntry = {
  id?: unknown;
  label?: unknown;
  checked?: unknown;
  detail?: unknown;
};
type LandingChecklistContext = {
  sinceVisit?: unknown;
  concerns?: unknown;
  goingWellNote?: unknown;
  visitGoals?: unknown;
  visitGoalsNote?: unknown;
};

function renderChecklistSection(title: string, raw: unknown, includeDetail: boolean): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rows: string[] = [];
  for (const entry of raw as LandingChecklistEntry[]) {
    if (!entry || typeof entry !== 'object') continue;
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    if (!label) continue;
    const checked = entry.checked === true;
    const detail =
      includeDetail && typeof entry.detail === 'string' ? entry.detail.trim() : '';
    const mark = checked ? '[x]' : '[ ]';
    const suffix = detail ? ` — ${detail}` : '';
    rows.push(`- ${mark} ${label}${suffix}`);
  }
  if (!rows.length) return null;
  return `${title}:\n${rows.join('\n')}`;
}

function renderChecklistContextBlock(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';
  const ctx = raw as LandingChecklistContext;
  const sections: string[] = [];
  const sinceVisit = renderChecklistSection(
    'Since-last-visit check-in (patient-submitted checkboxes + typed details; typed text is preserved even if a box is unchecked)',
    ctx.sinceVisit,
    true
  );
  if (sinceVisit) sections.push(sinceVisit);
  const concerns = renderChecklistSection(
    'Post-check-in concerns (patient-submitted)',
    ctx.concerns,
    true
  );
  if (concerns) sections.push(concerns);
  const goingWell =
    typeof ctx.goingWellNote === 'string' && ctx.goingWellNote.trim()
      ? `What is going well (patient free text):\n${ctx.goingWellNote.trim()}`
      : '';
  if (goingWell) sections.push(goingWell);
  const visitGoals = renderChecklistSection(
    'Visit-goals checklist (patient-selected examples)',
    ctx.visitGoals,
    false
  );
  if (visitGoals) sections.push(visitGoals);
  const note =
    typeof ctx.visitGoalsNote === 'string' && ctx.visitGoalsNote.trim()
      ? `Visit-goals optional note (free text from the patient):\n${ctx.visitGoalsNote.trim()}`
      : '';
  if (note) sections.push(note);
  return sections.join('\n\n');
}

function parseReviewFocusSuggestions(raw: string): string[] {
  const trimmed = raw.trim();
  const tryParse = (s: string): string[] | null => {
    try {
      const j = JSON.parse(s) as unknown;
      if (!j || typeof j !== 'object') return null;
      const suggestions = (j as { suggestions?: unknown }).suggestions;
      if (!Array.isArray(suggestions)) return null;
      return suggestions
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 200));
    } catch {
      return null;
    }
  };

  let list = tryParse(trimmed);
  if (list?.length) return list.slice(0, 6);

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    list = tryParse(fence[1].trim());
    if (list?.length) return list.slice(0, 6);
  }

  return [];
}

function parseProviderQuestionSuggestions(raw: string): string[] {
  const trimmed = raw.trim();
  const tryParse = (s: string): string[] | null => {
    try {
      const j = JSON.parse(s) as unknown;
      if (!j || typeof j !== 'object') return null;
      const questions = (j as { questions?: unknown }).questions;
      if (!Array.isArray(questions)) return null;
      return questions
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 220));
    } catch {
      return null;
    }
  };

  let list = tryParse(trimmed);
  if (list?.length) return list.slice(0, 4);

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    list = tryParse(fence[1].trim());
    if (list?.length) return list.slice(0, 4);
  }

  return [];
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
    const briefAck = req.body?.briefAck === true;

    const { profile } = await getProfileResponse(req.authToken.uid, req.authToken);
    const literacy = '6th grade';
    const language = String(profile.language || 'en');

    let systemPrompt: string;
    if (briefAck && mode === 'dashboard') {
      systemPrompt = getDashboardBriefAckSystem(literacy, language);
    } else {
      systemPrompt = await getSystemPrompt(
        mode,
        path,
        literacy,
        language,
        mode === 'review' || mode === 'dashboard' || mode === 'combined' ? record : undefined
      );
      if (briefAck) {
        systemPrompt += BRIEF_ACK_CHAT_SUFFIX;
      }
    }

    const checklistBlock = renderChecklistContextBlock(req.body?.checklistContext);
    if (checklistBlock) {
      systemPrompt +=
        `\n\nStructured patient-submitted context from the landing dashboard checklists ` +
        `(authoritative; prefer these over any conflicting free-form chat paraphrase):\n\n${checklistBlock}`;
    }

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
      max_tokens: briefAck ? Math.min(280, CHAT_MAX_TOKENS) : CHAT_MAX_TOKENS,
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

router.post('/api/since-visit-recap', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.authToken) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!isOpenRouterConfigured()) {
      throw new HttpError(503, 'AI is not configured. Set OPENROUTER_API_KEY in Firebase secrets.');
    }

    const rawRecord = req.body?.record;
    const rawTimeline = req.body?.timeline;
    const recordObj =
      rawRecord && typeof rawRecord === 'object' && !Array.isArray(rawRecord) && Object.keys(rawRecord).length > 0
        ? rawRecord
        : DEFAULT_NOTE_SEED;
    const timelineObj =
      rawTimeline &&
      typeof rawTimeline === 'object' &&
      !Array.isArray(rawTimeline) &&
      Object.keys(rawTimeline).length > 0
        ? rawTimeline
        : SINCE_VISIT_TIMELINE_SEED;

    const rec = recordObj as { visitDate?: unknown; provider?: unknown };
    const visitDate = typeof rec.visitDate === 'string' ? rec.visitDate.trim() : '';
    const provider = typeof rec.provider === 'string' ? rec.provider.trim() : '';

    const recordText = JSON.stringify(recordObj, null, 2);
    const timelineText = JSON.stringify(timelineObj, null, 2);

    const message =
      typeof req.body?.message === 'string' && req.body.message.trim()
        ? req.body.message.trim()
        : 'Please summarize what happened since my last visit in clear, patient-friendly language.';

    const { profile } = await getProfileResponse(req.authToken.uid, req.authToken);
    const literacy = '6th grade';
    const language = String(profile.language || 'en');

    const systemPrompt = getSinceVisitRecapPrompt({
      literacy,
      language,
      recordText,
      timelineText,
      visitDate,
      provider,
    });

    const response = await createChatCompletion({
      model: resolveModel(profile.modelPref),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: SINCE_VISIT_RECAP_MAX_TOKENS,
      temperature: SINCE_VISIT_RECAP_TEMPERATURE,
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

router.post('/api/review-focus-suggestions', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.authToken) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!isOpenRouterConfigured()) {
      throw new HttpError(503, 'AI is not configured. Set OPENROUTER_API_KEY in Firebase secrets.');
    }

    const record = req.body?.record;
    const rawDrafts = req.body?.draftTopics;
    const draftTopics = Array.isArray(rawDrafts)
      ? rawDrafts
          .filter((x: unknown): x is string => typeof x === 'string')
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

    const { profile } = await getProfileResponse(req.authToken.uid, req.authToken);
    const recordText =
      record === undefined || record === null
        ? '(No visit note provided)'
        : typeof record === 'string'
          ? record
          : JSON.stringify(record, null, 2);

    const draftBlock =
      draftTopics.length > 0
        ? draftTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')
        : '(none — patient has not typed focus areas yet.)';

    const userContent =
      `VISIT NOTE AND PAST MEDICAL INFORMATION AS DOCUMENTED BELOW (use only this text; do not infer from elsewhere):\n${recordText}\n\nAlready typed by the patient (do not duplicate these):\n${draftBlock}`;

    const response = await createChatCompletion({
      model: resolveModel(profile.modelPref),
      messages: [
        { role: 'system', content: getReviewFocusSuggestionsSystem(String(profile.language || 'en')) },
        { role: 'user', content: userContent },
      ],
      max_tokens: REVIEW_FOCUS_SUGGESTIONS_MAX_TOKENS,
      temperature: REVIEW_FOCUS_SUGGESTIONS_TEMPERATURE,
    });

    const raw = responseText(response.choices[0]?.message?.content);
    const suggestions = parseReviewFocusSuggestions(raw);
    if (!suggestions.length) {
      throw new HttpError(502, 'Could not parse suggestions. Please try again.');
    }

    res.json({ suggestions });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(502).json({ error: 'AI service unavailable. Please try again shortly.' });
  }
});

router.post('/api/provider-question-suggestions', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.authToken) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!isOpenRouterConfigured()) {
      throw new HttpError(503, 'AI is not configured. Set OPENROUTER_API_KEY in Firebase secrets.');
    }

    const raw = req.body?.messages;
    const messages = Array.isArray(raw) ? raw : [];
    const trimmed = messages
      .filter(
        (m: unknown): m is { role: 'user' | 'assistant'; content: string } =>
          Boolean(m) &&
          typeof m === 'object' &&
          ((m as { role?: string }).role === 'user' || (m as { role?: string }).role === 'assistant') &&
          typeof (m as { content?: unknown }).content === 'string'
      )
      .map((m) => {
        const role = (m as { role: string }).role === 'assistant' ? 'assistant' : 'user';
        return { role, content: String((m as { content: string }).content).trim() };
      })
      .filter((m) => m.content)
      .slice(-PROVIDER_QUESTION_SUGGESTIONS_MSG_LIMIT);

    const transcript = trimmed
      .map((m) => `${m.role === 'user' ? 'Patient' : 'HealthCoach'}: ${m.content}`)
      .join('\n\n');

    const record = req.body?.record;
    const recordText =
      record === undefined || record === null
        ? '(No visit note provided)'
        : typeof record === 'string'
          ? record
          : JSON.stringify(record, null, 2);

    const { profile } = await getProfileResponse(req.authToken.uid, req.authToken);
    const userContent =
      `DASHBOARD TRANSCRIPT (chronological):\n\n${transcript || '(empty)'}\n\n` +
      `VISIT NOTE / CLINICAL DOCUMENTATION (use only this text; do not infer from elsewhere):\n${recordText}`;

    const response = await createChatCompletion({
      model: resolveModel(profile.modelPref),
      messages: [
        { role: 'system', content: getProviderQuestionSuggestionsSystem(String(profile.language || 'en')) },
        { role: 'user', content: userContent },
      ],
      max_tokens: PROVIDER_QUESTION_SUGGESTIONS_MAX_TOKENS,
      temperature: PROVIDER_QUESTION_SUGGESTIONS_TEMPERATURE,
    });

    const rawOut = responseText(response.choices[0]?.message?.content);
    const questions = parseProviderQuestionSuggestions(rawOut);
    if (!questions.length) {
      throw new HttpError(502, 'Could not parse questions. Please try again.');
    }

    res.json({ questions });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(502).json({ error: 'AI service unavailable. Please try again shortly.' });
  }
});

router.post('/api/handoff-summary', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.authToken) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!isOpenRouterConfigured()) {
      throw new HttpError(503, 'AI is not configured. Set OPENROUTER_API_KEY in Firebase secrets.');
    }

    const raw = req.body?.messages;
    const messages = Array.isArray(raw) ? raw : [];
    const trimmed = messages
      .filter(
        (m: unknown): m is { role: 'user' | 'assistant'; content: string } =>
          Boolean(m) &&
          typeof m === 'object' &&
          ((m as { role?: string }).role === 'user' || (m as { role?: string }).role === 'assistant') &&
          typeof (m as { content?: unknown }).content === 'string'
      )
      .map((m) => {
        const role = (m as { role: string }).role === 'assistant' ? 'assistant' : 'user';
        return { role, content: String((m as { content: string }).content).trim() };
      })
      .filter((m) => m.content)
      .slice(-HANDOFF_SUMMARY_MSG_LIMIT);

    if (!trimmed.length) {
      throw new HttpError(400, 'No conversation to summarize.');
    }

    const { profile } = await getProfileResponse(req.authToken.uid, req.authToken);
    const transcript = trimmed
      .map((m) => `${m.role === 'user' ? 'Patient' : 'HealthCoach'}: ${m.content}`)
      .join('\n\n');

    const checklistBlock = renderChecklistContextBlock(req.body?.checklistContext);
    const checklistAppendix = checklistBlock
      ? `\n\nStructured patient-submitted checklist context (authoritative; may include typed details even for unchecked items):\n\n${checklistBlock}`
      : '';

    const response = await createChatCompletion({
      model: resolveModel(profile.modelPref),
      messages: [
        { role: 'system', content: getHandoffSummarySystem(String(profile.language || 'en')) },
        {
          role: 'user',
          content: `Dashboard conversation (patient lines only; chronology preserved):\n\n${transcript}${checklistAppendix}\n\nWrite the handoff summary now.`,
        },
      ],
      max_tokens: HANDOFF_SUMMARY_MAX_TOKENS,
      temperature: HANDOFF_SUMMARY_TEMPERATURE,
    });

    const summary = cleanHandoffSummaryText(responseText(response.choices[0]?.message?.content));
    if (!summary) {
      throw new HttpError(502, 'Could not generate summary. Please try again.');
    }

    res.json({ summary });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(502).json({ error: 'AI service unavailable. Please try again shortly.' });
  }
});

function trimHandoffMessages(raw: unknown) {
  const messages = Array.isArray(raw) ? raw : [];
  return messages
    .filter(
      (m: unknown): m is { role: 'user' | 'assistant'; content: string } =>
        Boolean(m) &&
        typeof m === 'object' &&
        ((m as { role?: string }).role === 'user' || (m as { role?: string }).role === 'assistant') &&
        typeof (m as { content?: unknown }).content === 'string'
    )
    .map((m) => {
      const role = (m as { role: string }).role === 'assistant' ? 'assistant' : 'user';
      return { role, content: String((m as { content: string }).content).trim() };
    })
    .filter((m) => m.content)
    .slice(-HANDOFF_SUMMARY_REVISE_MSG_LIMIT);
}

router.post('/api/handoff-summary-revise', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.authToken) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!isOpenRouterConfigured()) {
      throw new HttpError(503, 'AI is not configured. Set OPENROUTER_API_KEY in Firebase secrets.');
    }

    const currentSummary = typeof req.body?.currentSummary === 'string' ? req.body.currentSummary.trim() : '';
    const patientRequest = typeof req.body?.patientRequest === 'string' ? req.body.patientRequest.trim() : '';
    if (!currentSummary) {
      throw new HttpError(400, 'No current summary to revise.');
    }
    if (!patientRequest) {
      throw new HttpError(400, 'Describe what you would like to change.');
    }

    const trimmed = trimHandoffMessages(req.body?.messages);
    const transcript = trimmed
      .map((m) => `${m.role === 'user' ? 'Patient' : 'HealthCoach'}: ${m.content}`)
      .join('\n\n');

    const { profile } = await getProfileResponse(req.authToken.uid, req.authToken);
    const checklistBlock = renderChecklistContextBlock(req.body?.checklistContext);
    const checklistAppendix = checklistBlock
      ? `\n\nStructured patient-submitted checklist context (authoritative; may include typed details even for unchecked items):\n\n${checklistBlock}`
      : '';
    const userBlock = `Current pre-note draft:\n\n${currentSummary}\n\nPatient's requested changes:\n\n${patientRequest}${
      transcript
        ? `\n\nRecent dashboard conversation (for grounding only):\n\n${transcript}${checklistAppendix}\n\nRewrite the full pre-note now, applying the patient's requests.`
        : `${checklistAppendix}\n\nRewrite the full pre-note now, applying the patient's requests.`
    }`;

    const response = await createChatCompletion({
      model: resolveModel(profile.modelPref),
      messages: [
        { role: 'system', content: getHandoffSummaryReviseSystem(String(profile.language || 'en')) },
        { role: 'user', content: userBlock },
      ],
      max_tokens: HANDOFF_SUMMARY_REVISE_MAX_TOKENS,
      temperature: HANDOFF_SUMMARY_REVISE_TEMPERATURE,
    });

    const summary = cleanHandoffSummaryText(responseText(response.choices[0]?.message?.content));
    if (!summary) {
      throw new HttpError(502, 'Could not revise the summary. Please try again.');
    }

    res.json({ summary });
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
