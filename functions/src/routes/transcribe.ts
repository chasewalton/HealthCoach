import express, { Router } from 'express';
import OpenAI from 'openai';

import type { AuthenticatedRequest } from '../middleware.js';
import { verifyAuth } from '../middleware.js';
import { HttpError } from '../lib/http.js';
import { getOpenAIClient, isOpenAIConfigured } from '../lib/openai.js';

const router = Router();

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function extensionFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('webm')) return 'webm';
  if (ct.includes('ogg')) return 'ogg';
  if (ct.includes('mp4') || ct.includes('m4a')) return 'm4a';
  if (ct.includes('mpeg') || ct.includes('mp3')) return 'mp3';
  if (ct.includes('wav')) return 'wav';
  if (ct.includes('flac')) return 'flac';
  return 'webm';
}

router.post(
  '/api/transcribe',
  verifyAuth,
  express.raw({
    type: () => true,
    limit: `${MAX_AUDIO_BYTES}b`,
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!isOpenAIConfigured()) {
        throw new HttpError(
          503,
          'Voice transcription is not configured. Set OPENAI_API_KEY.'
        );
      }

      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw new HttpError(400, 'Audio payload is empty.');
      }
      if (body.length > MAX_AUDIO_BYTES) {
        throw new HttpError(413, 'Audio payload is too large.');
      }

      const contentType = (req.header('Content-Type') || 'audio/webm').split(';')[0].trim();
      const ext = extensionFromContentType(contentType);

      const language =
        typeof req.query.language === 'string' && req.query.language.trim()
          ? req.query.language.trim().slice(0, 8)
          : undefined;

      const file = await OpenAI.toFile(body, `voice.${ext}`, { type: contentType });

      const result = await getOpenAIClient().audio.transcriptions.create({
        file,
        model: 'whisper-1',
        ...(language ? { language } : {}),
        response_format: 'json',
      });

      const text =
        typeof (result as { text?: unknown }).text === 'string'
          ? String((result as { text: string }).text).trim()
          : '';

      res.json({ text });
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 502;
      const message =
        typeof (err as { message?: unknown })?.message === 'string'
          ? String((err as { message: string }).message)
          : 'Transcription failed. Please try again.';
      console.error('Transcription error:', err);
      res.status(status >= 400 && status < 600 ? status : 502).json({
        error: status === 413 ? 'Audio too large.' : message || 'Transcription failed.',
      });
    }
  }
);

export default router;
