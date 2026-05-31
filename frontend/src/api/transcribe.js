import { auth } from '../firebase.js';
import { ApiError } from './client.js';

/**
 * POST a recorded audio Blob to /api/transcribe and return the transcript text.
 * Sends the raw blob bytes as the body; Content-Type is taken from the blob.
 *
 * @param {Blob} blob
 * @param {{ language?: string, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ text: string }>}
 */
export async function transcribeAudio(blob, opts = {}) {
  if (!blob || !(blob instanceof Blob) || blob.size === 0) {
    throw new ApiError('Empty recording', 400);
  }

  const headers = {
    'Content-Type': blob.type || 'audio/webm',
  };

  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }

  const path = opts.language
    ? `/api/transcribe?language=${encodeURIComponent(opts.language)}`
    : '/api/transcribe';

  const fetchOptions = {
    method: 'POST',
    headers,
    body: blob,
    signal: opts.signal,
  };

  let res = await fetch(path, fetchOptions);
  if (res.status === 401 && user) {
    const token = await user.getIdToken(true);
    headers.Authorization = `Bearer ${token}`;
    res = await fetch(path, fetchOptions);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Transcription failed' }));
    throw new ApiError(data.error || 'Transcription failed', res.status);
  }
  return res.json();
}
