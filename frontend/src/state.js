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
  /** True while the "Do you have any questions from your last visit?" open Q&A is active (phase 1). */
  landingAwaitingLastVisitQuestions: false,
  /** Last-visit Q&A sub-step: 'initial' (awaiting first question or No Questions) | 'more-or-ready' (after an answer) | null. */
  landingLastVisitQsStep: null,
  /** True during review-priority flow (open question, confirmation, or edit) after confirming the visit note. */
  landingAwaitingReviewTopics: false,
  /** `'fields'` while the three focus inputs are shown after visit confirm; otherwise null. */
  landingReviewPriorityPhase: null,
  /** Up to three patient-entered review focus strings (same-session; drives confirmation UI and suggestions API). */
  landingPriorityTopics: [],
  /** True while the "since your last visit" checklist is shown after review priorities. */
  landingAwaitingSinceVisitChecklist: false,
  /** True while a legacy saved session still references the old concerns checklist form (replay only). */
  landingAwaitingConcernsChecklist: false,
  /** True while the visit-goals checklist (pre-handoff) is shown. */
  landingAwaitingVisitGoalsChecklist: false,
  /** After checklist: follow-up steps (concerns, provider-questions, visit goals, pre-handoff confirm, pre-summary; legacy `anything-else`). */
  landingSinceVisitFollowUp: null,
  /** Structured since-visit checklist responses keyed by itemId: `{ [id]: { label, checked, detail } }`. Preserved even if a box is unchecked. */
  landingSinceVisitDetails: {},
  /** Free-text "how have you been" narrative before the since-last-visit checklist (dashboard). */
  landingSinceVisitNarrative: '',
  /** Free-text reply to the going-well prompt (dashboard), or empty after skip. */
  landingGoingWellReply: '',
  /** Structured concerns checklist responses keyed by itemId (same shape as landingSinceVisitDetails). */
  landingConcernsDetails: {},
  /** Structured visit-goals checklist responses keyed by itemId: `{ [id]: { label, checked } }`. */
  landingVisitGoalsDetails: {},
  /** Optional free-text note from the visit-goals "anything else?" textarea. */
  landingVisitGoalsNote: '',
  /** True while provider-question suggestions are shown until "Continue to visit goals". */
  landingAwaitingProviderQuestionContinue: false,
  /** True while the generated handoff summary is shown for approve / edit. */
  landingAwaitingHandoffSummaryReview: false,
  /** True after summary approval while asking who the user wants to share it with. */
  landingAwaitingHandoffShareChoice: false,
  /** True after first message or when loading a saved dashboard session (compact hero + chat bubbles). */
  landingConversationStarted: false,
  /** Current phase of the structured journey (0 = Get Started, 1 = Review Visit, 2 = Prepare, 3 = Remaining Questions). */
  journeyPhase: 0,
  /** Onboarding sub-step: 'language' | 'name' | 'privacy' | null (done/skipped). */
  onboardingStep: null,
  /** Set synchronously when the greeting+walkthrough sequence is launched, so it can only run once per conversation. */
  landingWalkthroughLaunched: false,
  /** Review wrap-up sub-step: 'summary-question' | 'questions-loop' | 'next-steps' | 'next-steps-explore' | null. */
  reviewWrapStep: null,
  /** Deferred journey phase target while the review wrap-up sequence is in progress. */
  pendingPhaseTarget: null,
  /** Markdown/HTML source for the right pane when StudyFeedbackModal is open (visit recap or provider note). */
  landingFeedbackSummaryMarkdown: null,
  /** Why StudyFeedbackModal was opened: after Phase-1 visit walkthrough vs stepper wrap-up. */
  landingStudyFeedbackReason: null,
  /** True after last-visit walkthrough until quick feedback is submitted or closed (then priorities form). */
  landingAwaitingPostWalkthroughFeedback: false,
  /** True after visit recap until the user taps Continue (then Quick Feedback opens). */
  landingAwaitingWalkthroughContinue: false,
  /** Shows the persistent bottom-left End Conversation CTA after the final wrap-up prompt appears. */
  landingEndConversationCtaVisible: false,
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
