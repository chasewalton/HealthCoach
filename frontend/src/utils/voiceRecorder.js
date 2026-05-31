/**
 * Thin wrapper around MediaRecorder that yields a single audio Blob when
 * stopped. Pick the best supported mime type for Whisper compatibility.
 */

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
];

export function isVoiceRecordingSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator?.mediaDevices?.getUserMedia
  );
}

function pickMimeType() {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return '';
  for (const type of PREFERRED_MIME_TYPES) {
    if (window.MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return '';
}

export class VoiceRecorder {
  constructor() {
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.mimeType = '';
    this._stoppedPromise = null;
  }

  async start() {
    if (!isVoiceRecordingSupported()) {
      throw new Error('Voice recording is not supported in this browser.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mimeType = pickMimeType();
    this.recorder = this.mimeType
      ? new MediaRecorder(this.stream, { mimeType: this.mimeType })
      : new MediaRecorder(this.stream);
    this.chunks = [];

    this.recorder.addEventListener('dataavailable', (ev) => {
      if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
    });

    this._stoppedPromise = new Promise((resolve, reject) => {
      this.recorder.addEventListener('stop', () => {
        const type = this.recorder.mimeType || this.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type });
        this._cleanupStream();
        resolve(blob);
      });
      this.recorder.addEventListener('error', (ev) => {
        this._cleanupStream();
        reject(ev?.error || new Error('Recording error'));
      });
    });

    this.recorder.start();
  }

  async stop() {
    if (!this.recorder) return new Blob([], { type: 'audio/webm' });
    if (this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    return this._stoppedPromise || new Blob([], { type: 'audio/webm' });
  }

  cancel() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch (_) {
        // ignore
      }
    }
    this.chunks = [];
    this._cleanupStream();
  }

  isRecording() {
    return !!this.recorder && this.recorder.state === 'recording';
  }

  _cleanupStream() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        try {
          track.stop();
        } catch (_) {
          // ignore
        }
      }
      this.stream = null;
    }
  }
}
