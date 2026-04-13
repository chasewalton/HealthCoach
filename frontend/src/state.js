const state = {
  user: null,
  profile: {},
  chatMode: null,
  chatPath: null,
  messages: [],
  sessions: [],
  soapSection: 0,
  prepSection: 0,
  isTyping: false,
  patientRecord: null,
  patientRecordIsDefault: true,
  currentSessionId: null,
  lastSummary: null,
  /** Landing dashboard chat (mode: dashboard) */
  landingMessages: [],
  landingSessionId: null,
  landingIsTyping: false,
  /** True after first message or when loading a saved dashboard session (compact hero + chat bubbles). */
  landingConversationStarted: false,
  /**
   * Next action for the floating #landing-prepare-btn (synced with hero quick prompts).
   * `prepare` → label "Prepare for my next visit"; `review` → "Review my last visits".
   */
  landingPrepareNextAction: 'prepare',
  /** Screen to return to from home landing (`landing` | `auth`). */
  homeLandingReturnScreen: 'landing',
};

const listeners = new Map();

export function on(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}

export function set(key, value) {
  state[key] = value;
  if (listeners.has(key)) {
    listeners.get(key).forEach(fn => fn(value, key));
  }
}

export function emit(key) {
  if (listeners.has(key)) {
    listeners.get(key).forEach(fn => fn(state[key], key));
  }
}

export default state;
