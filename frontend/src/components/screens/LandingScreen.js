import state from '../../state.js';
import { saveSession as apiSaveSession } from '../../api/sessions.js';
import { sendChatMessage, requestSinceVisitRecap, requestReviewFocusSuggestions, requestProviderQuestionSuggestions } from '../../api/chat.js';
import { requestHandoffSummary, requestHandoffSummaryRevise } from '../../api/handoffSummary.js';
import { updateProfile } from '../../api/profile.js';
import { submitFeedback } from '../../api/feedback.js';
import { showToast } from '../Toast.js';
import { isEmergency } from '../../utils/emergency.js';
import {
  formatMessage,
  escapeHtml,
  stripTrailingVisitRecapEngagementQuestion,
  composeMessageWithInstruction,
  stripInstructionMarker,
} from '../../utils/format.js';
import { getUserInitials, scrollLandingChatBottom } from '../../utils/dom.js';
import { t, dateLocale, currentLang } from '../../i18n.js';
import { canonicalChipValue } from '../../chips.js';
import { VoiceRecorder, isVoiceRecordingSupported } from '../../utils/voiceRecorder.js';
import { transcribeAudio } from '../../api/transcribe.js';
import {
  attachTrackChanges,
  hasTrackedChanges,
  acceptAllChanges,
  rejectAllChanges,
  flattenAcceptedText,
} from '../../utils/trackChanges.js';

const CUJ_DOCS_URL = 'https://healthcoach-cuj.surge.sh/';

function labelForChipCode(code) {
  switch (code) {
    case 'en':
      return t('lang.english');
    case 'es':
      return t('lang.spanish');
    case 'yes':
      return t('common.yes');
    case 'no':
      return t('common.no');
    case 'continue':
      return t('chip.continue');
    case 'continueToVisitGoals':
      return t('landing.pq.continueGoals');
    case 'noThanks':
      return t('landing.userLine.noThanks');
    default:
      return String(code);
  }
}
import {
  setLandingAmbientMode,
} from '../../three/landingAmbient.js';

const JOURNEY_PHASE_KEYS = [
  'landing.journey.getStarted',
  'landing.journey.reviewVisit',
  'landing.journey.prepareNext',
  'landing.journey.remainingQuestions',
];

export function getJourneyPhases() {
  return JOURNEY_PHASE_KEYS.map((k) => t(k));
}

const JOURNEY_STEP_ICONS = [
  // Get Started: upright rocket with fins and exhaust
  `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M18 26 L11 34 L18 33 Z" fill="currentColor" fill-opacity="0.35" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M30 26 L37 34 L30 33 Z" fill="currentColor" fill-opacity="0.35" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 6 C28 10 30 15 30 21 L30 33 L18 33 L18 21 C18 15 20 10 24 6 Z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="24" cy="18" r="3" fill="#ffffff" stroke="currentColor" stroke-width="2"/>
    <path d="M20 33 L24 42 L28 33 Z" fill="currentColor" fill-opacity="0.55" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M16 40 L18 38 M22 43 L24 41 M30 40 L32 38" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
  </svg>`,
  // Review Visit: clipboard + chart + magnifier
  `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="10" y="10" width="22" height="28" rx="2.5" fill="#ffffff" stroke="currentColor" stroke-width="2"/>
    <rect x="16" y="6" width="10" height="6" rx="1.5" fill="currentColor"/>
    <path d="M14 28 L18 23 L23 26 L28 18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="18" cy="23" r="1.5" fill="currentColor"/>
    <circle cx="23" cy="26" r="1.5" fill="currentColor"/>
    <circle cx="28" cy="18" r="1.5" fill="currentColor"/>
    <circle cx="32" cy="32" r="5" fill="#ffffff" stroke="currentColor" stroke-width="2"/>
    <line x1="35.5" y1="35.5" x2="40" y2="40" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  // Prepare for Next Visit: spiral notebook/planner with pen
  `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="8" y="12" width="30" height="28" rx="2.5" fill="#ffffff" stroke="currentColor" stroke-width="2"/>
    <line x1="23" y1="12" x2="23" y2="40" stroke="currentColor" stroke-width="1.8" opacity="0.7"/>
    <circle cx="23" cy="16" r="1.1" fill="currentColor"/>
    <circle cx="23" cy="22" r="1.1" fill="currentColor"/>
    <circle cx="23" cy="28" r="1.1" fill="currentColor"/>
    <circle cx="23" cy="34" r="1.1" fill="currentColor"/>
    <rect x="11" y="17" width="9" height="2.2" rx="0.6" fill="currentColor" opacity="0.55"/>
    <text x="15.5" y="33" font-family="Plus Jakarta Sans, Inter, system-ui, sans-serif" font-size="10" font-weight="800" fill="currentColor" text-anchor="middle">7</text>
    <line x1="26" y1="18" x2="35" y2="18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
    <line x1="26" y1="23" x2="35" y2="23" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
    <line x1="26" y1="28" x2="33" y2="28" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
    <line x1="26" y1="33" x2="35" y2="33" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
    <path d="M38 6 L42 10 L31 21 L27 21 L27 17 Z" fill="#ffffff" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <line x1="36" y1="8" x2="40" y2="12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  // Remaining Questions: two speech bubbles with question mark
  `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M32 6 C37 6 41 9 41 14 C41 17 39 19 36 20 L36 25 L31 21 C26 20 24 17 24 14 C24 9 28 6 32 6 Z" fill="#ffffff" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M30 12 L35 12 M33 9 L36 12 L33 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M18 16 C26 16 32 21 32 28 C32 32 30 35 26 37 L26 42 L21 38 C12 38 6 33 6 28 C6 21 12 16 18 16 Z" fill="#ffffff" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M16 25 C16 22 18 21 20 21 C22 21 24 22 24 25 C24 27 22 27.5 21 29 L21 30.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
    <circle cx="21" cy="33.5" r="1.4" fill="currentColor"/>
  </svg>`,
];

function greetingIntro() {
  return t('landing.greeting.intro');
}

function greetingTimeline() {
  return t('landing.greeting.timeline');
}

function onboardingLanguage() {
  return t('landing.onboarding.language');
}

function onboardingName() {
  return composeMessageWithInstruction(t('landing.onboarding.name'), t('landing.onboarding.nameInstruction'));
}

function landingMessagesForModel(messages) {
  return messages.map((m) => ({ role: m.role, content: stripInstructionMarker(m.content) }));
}

/** @param {string} [nameFromPreviousMessage] User line right before this step (their chosen name). */
function onboardingPrivacy(nameFromPreviousMessage) {
  const trimmed = typeof nameFromPreviousMessage === 'string' ? nameFromPreviousMessage.trim() : '';
  const thanksName = trimmed ? `, ${trimmed}` : '';
  return t('landing.onboarding.privacy', { thanksName });
}

const MAX_REVIEW_PRIORITY_TOPICS = 3;

function reviewPriorityFieldsPrompt() {
  return t('landing.reviewPriority.prompt');
}

function sinceVisitChecklistItems() {
  return [
    { id: 'symptoms', label: t('landing.sinceVisit.symptoms') },
    { id: 'acute-care', label: t('landing.sinceVisit.acuteCare') },
    { id: 'communication-care-team', label: t('landing.sinceVisit.communicationCareTeam') },
    { id: 'medications', label: t('landing.sinceVisit.medications') },
    { id: 'tests-procedures', label: t('landing.sinceVisit.testsProcedures') },
    { id: 'referrals', label: t('landing.sinceVisit.referrals') },
    { id: 'life-change', label: t('landing.sinceVisit.lifeChange') },
  ];
}

/**
 * Persist a single row of a landing checklist form to `state`, so that typed
 * detail text survives re-renders, unchecking/re-checking a box, session
 * reloads, and is available as structured context for the backend later.
 *
 * @param {'sinceVisit'|'concerns'|'visitGoals'} form
 * @param {string} itemId
 * @param {string} label
 * @param {boolean} checked
 * @param {string} [detail]
 */
function updateLandingChecklistDetail(form, itemId, label, checked, detail) {
  const key =
    form === 'sinceVisit'
      ? 'landingSinceVisitDetails'
      : form === 'concerns'
        ? 'landingConcernsDetails'
        : 'landingVisitGoalsDetails';
  const current = state[key] && typeof state[key] === 'object' ? state[key] : {};
  const entry = { label, checked: !!checked };
  if (form !== 'visitGoals') {
    entry.detail = typeof detail === 'string' ? detail : '';
  }
  state[key] = { ...current, [itemId]: entry };
}

/** Serialize a checklist state map into a clean, well-defined array (preserves row order via the `items` list). */
function serializeLandingChecklistEntries(items, byId, opts = {}) {
  const { includeUnchecked = false, includeDetail = true } = opts;
  const out = [];
  items.forEach((item) => {
    const saved = byId?.[item.id];
    if (!saved) return;
    const hasDetailText = includeDetail && typeof saved.detail === 'string' && saved.detail.trim().length > 0;
    if (!saved.checked && !(includeUnchecked && hasDetailText)) return;
    const entry = { id: item.id, label: item.label, checked: !!saved.checked };
    if (includeDetail) entry.detail = hasDetailText ? saved.detail.trim() : '';
    out.push(entry);
  });
  return out;
}

/** Build the structured checklist context that we send to the backend alongside the chat/handoff APIs. */
function buildLandingChecklistContext() {
  const sinceVisit = serializeLandingChecklistEntries(
    sinceVisitChecklistItems(),
    state.landingSinceVisitDetails,
    { includeUnchecked: true }
  );
  const visitGoals = serializeLandingChecklistEntries(
    visitGoalsChecklistItems(),
    state.landingVisitGoalsDetails,
    { includeUnchecked: false, includeDetail: false }
  );
  const note = typeof state.landingVisitGoalsNote === 'string' ? state.landingVisitGoalsNote.trim() : '';
  const goingWellNote =
    typeof state.landingGoingWellReply === 'string' ? state.landingGoingWellReply.trim() : '';
  const ctx = {};
  if (sinceVisit.length) ctx.sinceVisit = sinceVisit;
  if (goingWellNote) ctx.goingWellNote = goingWellNote;
  if (visitGoals.length) ctx.visitGoals = visitGoals;
  if (note) ctx.visitGoalsNote = note;
  return Object.keys(ctx).length ? ctx : null;
}

function visitGoalsPromptLead() {
  return t('landing.visitGoals.lead');
}

function visitGoalsChecklistItems() {
  return [
    { id: 'refill', label: t('landing.visitGoals.refill') },
    { id: 'labs', label: t('landing.visitGoals.labs') },
    { id: 'referral', label: t('landing.visitGoals.referral') },
    { id: 'work-school', label: t('landing.visitGoals.workSchool') },
  ];
}

function providerQuestionsOffer() {
  return t('landing.providerQuestions.offer');
}

/** @param {string[]} questions */
function buildProviderQuestionsMarkdown(questions) {
  return (
    t('landing.providerQs.header') +
    '\n\n' +
    questions.map((q) => `- ${q}`).join('\n') +
    '\n\n' +
    t('landing.providerQs.footer')
  );
}

function providerQuestionsSuggestionsFieldsetHtml(items, msgIdx, checkedArr) {
  const rows = items
    .map((q, i) => {
      const checked =
        Array.isArray(checkedArr) && typeof checkedArr[i] === 'boolean' ? checkedArr[i] : true;
      const id = `landing-pq-suggest-${msgIdx}-${i}`;
      return `
      <div class="landing-since-visit-check-row landing-pq-suggestion-row">
        <label class="landing-since-visit-check-item" for="${id}">
          <input type="checkbox" class="landing-since-visit-check-input landing-pq-suggestion-cb" id="${id}" data-msg-idx="${msgIdx}" data-q-idx="${i}" ${checked ? 'checked' : ''} />
          <span class="landing-since-visit-check-text">${escapeHtml(q)}</span>
        </label>
      </div>`;
    })
    .join('');
  const addOwnLabel = escapeHtml(t('landing.pq.addOwn'));
  const addOwnPlaceholder = escapeHtml(t('landing.pq.addOwnPlaceholder'));
  const addOwnSubmit = escapeHtml(t('landing.pq.addOwnSubmit'));
  return `
    <fieldset class="landing-since-visit-check-fieldset landing-pq-suggestions-fieldset" data-msg-idx="${msgIdx}">
      <legend class="sr-only">${escapeHtml(t('landing.pq.suggestionsLegend'))}</legend>
      ${rows}
      <div class="landing-pq-add-own-row" data-msg-idx="${msgIdx}">
        <button
          type="button"
          class="landing-pq-add-own-btn"
          data-msg-idx="${msgIdx}"
          aria-expanded="false"
          aria-controls="landing-pq-add-own-wrap-${msgIdx}"
        >+ ${addOwnLabel}</button>
        <div class="landing-pq-add-own-wrap" id="landing-pq-add-own-wrap-${msgIdx}" hidden>
          <label class="sr-only" for="landing-pq-add-own-input-${msgIdx}">${addOwnLabel}</label>
          <input
            type="text"
            class="landing-since-visit-detail-input landing-pq-add-own-input"
            id="landing-pq-add-own-input-${msgIdx}"
            data-msg-idx="${msgIdx}"
            placeholder="${addOwnPlaceholder}"
            maxlength="220"
          />
          <button
            type="button"
            class="landing-pq-add-own-submit"
            data-msg-idx="${msgIdx}"
          >${addOwnSubmit}</button>
        </div>
      </div>
    </fieldset>`;
}

function buildProviderQuestionsSmsBody(lastMsg) {
  const items = Array.isArray(lastMsg.providerQuestionsItems) ? lastMsg.providerQuestionsItems : [];
  const checkedArr = Array.isArray(lastMsg.providerQuestionsChecked)
    ? lastMsg.providerQuestionsChecked
    : items.map(() => true);
  const selected = items.filter((_, i) => checkedArr[i] !== false);
  if (!selected.length) return '';
  return `${t('landing.providerQs.smsPrefix')}\n\n${selected.map((q, i) => `${i + 1}. ${q}`).join('\n')}`.slice(
    0,
    900
  );
}

function handoffReadyPrompt() {
  return t('landing.handoff.readyPrompt');
}

function handoffSentConfirm() {
  return t('landing.handoff.sentConfirm');
}

function handoffReviewIntro() {
  return t('landing.handoff.reviewIntro');
}

function handoffReviewAfterRevise() {
  return t('landing.handoff.reviewAfterRevise');
}

function handoffApproveUserLine() {
  return t('landing.handoff.approveUserLine');
}

function handoffSharePrompt() {
  return t('landing.handoff.sharePrompt');
}

function handoffFeedbackIntro() {
  return t('landing.handoff.feedbackIntro');
}

function walkthroughContinuePrompt() {
  return t('landing.walkthrough.continuePrompt');
}

function providerNoteSummaryMarker() {
  return t('landing.handoff.providerNoteMarker');
}

function approvedSummaryMarker() {
  return t('landing.handoff.approvedSummaryMarker');
}

function handoffShareOptions() {
  return [
    { id: 'provider', label: t('landing.handoff.shareProvider') },
    { id: 'self', label: t('landing.handoff.shareSelf') },
    { id: 'caretaker', label: t('landing.handoff.shareCaretaker') },
    { id: 'other', label: t('landing.handoff.shareOther') },
  ];
}

function handoffShareContactPlaceholder(recipientId) {
  if (recipientId === 'provider') return t('landing.handoff.shareProviderContactPlaceholder');
  if (recipientId === 'self') return t('landing.handoff.shareSelfContactPlaceholder');
  if (recipientId === 'caretaker') return t('landing.handoff.shareCaretakerContactPlaceholder');
  return t('landing.handoff.shareOtherContactPlaceholder');
}

function isWalkthroughContinueAssistantMessage(m) {
  return m && m.role === 'assistant' && m.walkthroughContinueStep === true;
}

/** Assistant recap shown before the walkthrough "Continue" prompt (Phase 1). */
function getWalkthroughRecapMarkdown() {
  const msgs = state.landingMessages;
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (!isWalkthroughContinueAssistantMessage(msgs[i])) continue;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (msgs[j].role === 'assistant') {
        return typeof msgs[j].content === 'string' ? msgs[j].content : '';
      }
    }
  }
  return '';
}

/** Body of the approved provider pre-note bubble, if present in the thread. */
function getApprovedProviderNoteMarkdown() {
  const legacyConfirmEs =
    'Su nota ha sido enviada a su proveedor. Nos vemos en su visita.';
  for (let i = state.landingMessages.length - 1; i >= 0; i -= 1) {
    const msg = state.landingMessages[i];
    if (msg?.approvedSummaryDoc && typeof msg.approvedSummaryDocText === 'string' && msg.approvedSummaryDocText.trim()) {
      return msg.approvedSummaryDocText.trim();
    }
    const c = msg?.content;
    if (typeof c !== 'string') continue;
    const marker = providerNoteSummaryMarker();
    const approvedMarker = approvedSummaryMarker();
    const legacyEnMarker = '**Your note for your provider**';
    if (!c.includes(approvedMarker) && !c.includes(marker) && !c.includes(legacyEnMarker)) continue;
    const idx = c.includes(approvedMarker)
      ? c.indexOf(approvedMarker)
      : c.includes(marker)
        ? c.indexOf(marker)
        : c.indexOf(legacyEnMarker);
    if (idx === -1) continue;
    const markerLen = c.indexOf(approvedMarker) === idx
      ? approvedMarker.length
      : c.indexOf(marker) === idx
        ? marker.length
        : legacyEnMarker.length;
    let body = c.slice(idx + markerLen).trim();
    const legacyConfirmEn = 'Your note has been sent to your provider. See you at your visit.';
    const ends = [
      body.indexOf(handoffSentConfirm()),
      body.indexOf(handoffSharePrompt()),
      body.indexOf(handoffFeedbackIntro()),
      body.indexOf(legacyConfirmEn),
      body.indexOf(legacyConfirmEs),
    ].filter((n) => n >= 0);
    if (ends.length) body = body.slice(0, Math.min(...ends)).trim();
    return body.trim();
  }
  return '';
}

const SUPPORT_MAILTO =
  'mailto:support@healthcoach.app?subject=HealthCoach%20support%20request';

/**
 * Bumped on every landing-chat reset. Async tasks (staggered messages, API calls)
 * capture the epoch at start and abort their final push/render if it changed,
 * so stale turns never reappear after a restart.
 */
let landingEpoch = 0;
function currentLandingEpoch() {
  return landingEpoch;
}
function isLandingEpochStale(captured) {
  return captured !== landingEpoch;
}
function bumpLandingEpoch() {
  landingEpoch += 1;
}

let onOpenNoteModal = null;
let onOpenProfile = null;
let onOpenAdminLogin = null;
let onSignOut = null;
let onOpenHomeLanding = null;
let onOpenStudyModal = null;
let onOpenEndConversation = null;
let onOpenSummaryDoc = null;
let landingHooksAbortController = null;
let fontToggleWired = false;

const FONT_SIZES = ['font-xs', 'font-sm', 'font-md', 'font-lg', 'font-xl', 'font-xxl'];
const FONT_SIZE_KEY = 'healthcoach-chat-font-size';

export function setCallbacks(cbs) {
  onOpenNoteModal = cbs.onOpenNoteModal;
  onOpenProfile = cbs.onOpenProfile;
  onOpenAdminLogin = cbs.onOpenAdminLogin;
  onSignOut = cbs.onSignOut;
  onOpenHomeLanding = cbs.onOpenHomeLanding || null;
  onOpenStudyModal = cbs.onOpenStudyModal || null;
  onOpenEndConversation = cbs.onOpenEndConversation || null;
  onOpenSummaryDoc = cbs.onOpenSummaryDoc || null;
}

export function render() {
  return `
  <div id="screen-landing" class="screen">
    <div class="top-bar">
      <div class="top-bar-logo" id="landing-brand-hit" role="button" tabindex="0" aria-label="${escapeHtml(t('app.ariaCujDocs'))}" title="${escapeHtml(t('app.ariaCujDocs'))}">
        ${escapeHtml(t('app.brandHealth'))}<span>${escapeHtml(t('app.brandCoach'))}</span>
      </div>
      <div class="top-bar-actions">
        <button
          type="button"
          class="landing-back-turn-btn"
          id="landing-back-turn-btn"
          title="${escapeHtml(t('chat.reverseTurn'))}"
          aria-label="${escapeHtml(t('chat.reverseTurn'))}"
          disabled
        >
          <svg class="landing-back-turn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button
          type="button"
          class="landing-restart-btn"
          id="landing-restart-btn"
          title="${escapeHtml(t('landing.restartTitle'))}"
          aria-label="${escapeHtml(t('landing.restartTitle'))}"
        >
          <svg class="landing-restart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
        <div class="landing-menu" id="landing-menu">
          <button
            type="button"
            class="landing-menu-trigger"
            id="landing-menu-btn"
            aria-expanded="false"
            aria-haspopup="true"
            aria-controls="landing-menu-panel"
            title="${escapeHtml(t('landing.menu.title'))}"
          >
            <span class="landing-menu-avatar" id="landing-avatar" aria-hidden="true">HC</span>
            <span class="landing-menu-burger" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </button>
          <div class="landing-menu-panel" id="landing-menu-panel" role="menu" hidden>
            <button type="button" class="landing-menu-item" role="menuitem" data-action="open-profile">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">${escapeHtml(t('landing.menu.profile'))}</span>
              </span>
            </button>
            <button type="button" class="landing-menu-item landing-menu-item--note" id="landing-note-chip" role="menuitem" data-action="open-note">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">${escapeHtml(t('landing.menu.demoConversation'))}</span>
              </span>
            </button>
            <button type="button" class="landing-menu-item" role="menuitem" data-action="support">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">${escapeHtml(t('landing.menu.support'))}</span>
              </span>
            </button>
            <button type="button" class="landing-menu-item" role="menuitem" data-action="open-admin">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">${escapeHtml(t('landing.menu.admin'))}</span>
              </span>
            </button>
            <button type="button" class="landing-menu-item" role="menuitem" data-action="about">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">${escapeHtml(t('landing.menu.about'))}</span>
              </span>
            </button>
            <button type="button" class="landing-menu-item landing-menu-item--signout" role="menuitem" data-action="sign-out">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">${escapeHtml(t('landing.menu.signOut'))}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="landing-body">
      <main class="landing-main landing-main--chat-active" id="landing-main">
        <canvas class="landing-main-3d" id="landing-main-3d" aria-hidden="true"></canvas>
        <div class="landing-main-stack" id="landing-main-stack">
          <div class="landing-hero-region">
            <div class="landing-font-toggle" id="landing-font-toggle" role="group" aria-label="${escapeHtml(t('landing.font.ariaGroup'))}">
              <button type="button" class="font-toggle-btn font-toggle-sm" id="font-toggle-sm" title="${escapeHtml(t('landing.font.smaller'))}" aria-label="${escapeHtml(t('landing.font.smaller'))}">A</button>
              <button type="button" class="font-toggle-btn font-toggle-lg" id="font-toggle-lg" title="${escapeHtml(t('landing.font.larger'))}" aria-label="${escapeHtml(t('landing.font.larger'))}">A</button>
            </div>
            <div class="landing-hero landing-hero--compact">
              <div class="greeting-line"><span id="greeting-text">${escapeHtml(t('landing.greeting.welcomeBack'))}</span></div>
            </div>
            <div class="journey-stepper" id="journey-stepper" role="list" aria-label="${escapeHtml(t('landing.journey.listLabel'))}"></div>
          </div>

          <div class="landing-chat" id="landing-chat">
            <div class="landing-chat-body-wrap">
              <div class="landing-chat-messages" id="landing-chat-body"></div>
            </div>
            <div class="landing-chat-input-area">
              <div class="landing-chat-input-row">
                <div class="landing-chat-input-wrap">
                  <textarea
                    class="landing-chat-textarea"
                    id="landing-chat-input"
                    placeholder="${escapeHtml(t('landing.chat.placeholder'))}"
                    rows="1"
                  ></textarea>
                  <div class="landing-chat-actions">
                    <button
                      type="button"
                      class="landing-chat-action-btn"
                      id="landing-voice-btn"
                      title="${escapeHtml(t('chat.voiceInput'))}"
                      aria-label="${escapeHtml(t('chat.voiceInput'))}"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    </button>
                    <button type="button" class="landing-send-btn" id="landing-send-btn" disabled title="${escapeHtml(t('landing.chat.send'))}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
    <button
      type="button"
      class="landing-end-conversation-cta"
      id="landing-end-conversation-cta"
      aria-label="${escapeHtml(t('endChat.end'))}"
      hidden
    >
      ${escapeHtml(t('endChat.end'))}
    </button>
  </div>`;
}

export function teardownLandingHooks() {
  landingHooksAbortController?.abort();
  landingHooksAbortController = null;
  fontToggleWired = false;
}

function wireLandingMenu(signal) {
  const wrap = document.getElementById('landing-menu');
  const btn = document.getElementById('landing-menu-btn');
  const panel = document.getElementById('landing-menu-panel');
  if (!wrap || !btn || !panel) return;

  function closeMenu() {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
  }

  function openMenu() {
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
  }

  function toggleMenu(e) {
    e.stopPropagation();
    if (panel.hidden) openMenu();
    else closeMenu();
  }

  btn.addEventListener('click', toggleMenu, { signal });

  panel.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action]');
    if (!item) return;
    const action = item.dataset.action;
    if (action === 'open-profile' && onOpenProfile) onOpenProfile();
    if (action === 'open-note' && onOpenNoteModal) onOpenNoteModal();
    if (action === 'support') {
      window.location.href = SUPPORT_MAILTO;
    }
    if (action === 'open-admin' && onOpenAdminLogin) onOpenAdminLogin();
    if (action === 'about' && onOpenHomeLanding) onOpenHomeLanding();
    if (action === 'sign-out' && onSignOut) onSignOut();
    closeMenu();
  }, { signal });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#landing-menu')) closeMenu();
  }, { signal });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  }, { signal });
}

/** True when focus is on a control that should keep Enter (e.g. another button or a text field). */
function landingEnterShouldDeferToFocusedControl(el) {
  if (!el) return false;
  if (el.id === 'landing-chat-input') return true;
  const tag = el.tagName;
  if (tag === 'BUTTON' || tag === 'A' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return true;
  if (el.isContentEditable) return true;
  return false;
}

function clearLandingComposerInput() {
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }
  if (sendBtn) sendBtn.disabled = true;
}

function onDocumentKeydownForLandingShortcuts(e) {
  if (e.key !== 'Enter' || e.shiftKey) return;
  const landing = document.getElementById('screen-landing');
  if (!landing?.classList.contains('active')) return;
  if (document.querySelector('.modal-overlay.open')) return;
  if (state.landingIsTyping) return;
  if (landingEnterShouldDeferToFocusedControl(document.activeElement)) return;

  const lastMsg = state.landingMessages[state.landingMessages.length - 1];

  if (state.onboardingStep === 'privacy' && lastMsg?.role === 'assistant' && lastMsg.action) {
    e.preventDefault();
    clearLandingComposerInput();
    handlePrivacyContinue();
    return;
  }
}

const VOICE_ICON_MIC = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
const VOICE_ICON_STOP = `
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
const VOICE_ICON_SPINNER = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="voice-spinner-svg"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

function setLandingVoiceButtonState(btn, mode) {
  if (!btn) return;
  btn.classList.toggle('is-recording', mode === 'recording');
  btn.classList.toggle('is-transcribing', mode === 'transcribing');
  if (mode === 'recording') {
    btn.innerHTML = VOICE_ICON_STOP;
    btn.title = t('chat.voiceStop');
    btn.setAttribute('aria-label', t('chat.voiceStop'));
    btn.setAttribute('aria-pressed', 'true');
    btn.disabled = false;
  } else if (mode === 'transcribing') {
    btn.innerHTML = VOICE_ICON_SPINNER;
    btn.title = t('chat.voiceTranscribing');
    btn.setAttribute('aria-label', t('chat.voiceTranscribing'));
    btn.setAttribute('aria-pressed', 'false');
    btn.disabled = true;
  } else {
    btn.innerHTML = VOICE_ICON_MIC;
    btn.title = t('chat.voiceInput');
    btn.setAttribute('aria-label', t('chat.voiceInput'));
    btn.setAttribute('aria-pressed', 'false');
    btn.disabled = false;
  }
}

function wireLandingVoiceButton(voiceBtn, input, _sendBtn, signal) {
  if (!voiceBtn || !input) return;

  if (!isVoiceRecordingSupported()) {
    voiceBtn.addEventListener(
      'click',
      () => showToast(t('chat.voiceUnsupported')),
      { signal }
    );
    return;
  }

  let recorder = null;

  async function startRecording() {
    try {
      recorder = new VoiceRecorder();
      await recorder.start();
      setLandingVoiceButtonState(voiceBtn, 'recording');
    } catch (err) {
      recorder = null;
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        showToast(t('chat.voiceDenied'));
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        showToast(t('chat.voiceNoMic'));
      } else {
        showToast(t('chat.voiceError'));
      }
      setLandingVoiceButtonState(voiceBtn, 'idle');
    }
  }

  async function stopAndTranscribe() {
    if (!recorder) return;
    setLandingVoiceButtonState(voiceBtn, 'transcribing');
    let blob;
    try {
      blob = await recorder.stop();
    } catch (_) {
      blob = null;
    }
    recorder = null;

    if (!blob || blob.size === 0) {
      setLandingVoiceButtonState(voiceBtn, 'idle');
      showToast(t('chat.voiceError'));
      return;
    }

    try {
      const lang = currentLang() === 'es' ? 'es' : 'en';
      const { text } = await transcribeAudio(blob, { language: lang });
      const cleaned = (text || '').trim();
      if (!cleaned) {
        showToast(t('chat.voiceNoSpeech'));
      } else {
        const existing = input.value || '';
        const sep = existing && !/\s$/.test(existing) ? ' ' : '';
        input.value = `${existing}${sep}${cleaned}`;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        const pos = input.value.length;
        try { input.setSelectionRange(pos, pos); } catch (_) { /* ignore */ }
      }
    } catch (err) {
      const msg = err?.message ? String(err.message) : '';
      showToast(msg || t('chat.voiceError'));
    } finally {
      setLandingVoiceButtonState(voiceBtn, 'idle');
    }
  }

  voiceBtn.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      if (recorder && recorder.isRecording()) {
        stopAndTranscribe();
      } else if (!voiceBtn.disabled) {
        startRecording();
      }
    },
    { signal }
  );

  if (signal) {
    signal.addEventListener('abort', () => {
      if (recorder) {
        try {
          recorder.cancel();
        } catch (_) {
          // ignore
        }
        recorder = null;
      }
    });
  }
}

function wireLandingChatInput(signal) {
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  const voiceBtn = document.getElementById('landing-voice-btn');
  if (!input || !sendBtn) return;

  document.addEventListener('keydown', onDocumentKeydownForLandingShortcuts, { signal });

  wireLandingVoiceButton(voiceBtn, input, sendBtn, signal);
  sendBtn.addEventListener('click', sendLandingMessage, { signal });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendLandingMessage();
    }
  }, { signal });
  input.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    const reviewPriorityBlocksSend =
      state.landingAwaitingReviewTopics && state.landingReviewPriorityPhase === 'fields';
    sendBtn.disabled =
      !this.value.trim() ||
      state.landingIsTyping ||
      reviewPriorityBlocksSend ||
      state.landingAwaitingSinceVisitChecklist ||
      state.landingAwaitingConcernsChecklist ||
      state.landingAwaitingVisitGoalsChecklist ||
      state.landingAwaitingProviderQuestionContinue ||
      state.landingAwaitingHandoffShareChoice;
  }, { signal });
}

export function renderJourneyStepper() {
  const stepper = document.getElementById('journey-stepper');
  if (!stepper) return;

  const labels = getJourneyPhases();
  stepper.innerHTML = labels.map((label, i) => {
    let cls = 'journey-step';
    const isCompleted = i < state.journeyPhase;
    const isActive = i === state.journeyPhase;
    const isClickable = i > state.journeyPhase;

    if (isCompleted) cls += ' journey-step--completed';
    else if (isActive) cls += ' journey-step--active';
    else cls += ' journey-step--locked';

    if (isClickable) cls += ' journey-step--clickable';

    const indicator = isCompleted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : String(i + 1);

    const icon = JOURNEY_STEP_ICONS[i] || '';

    const connector = i < labels.length - 1
      ? `<div class="journey-connector${isCompleted ? ' journey-connector--done' : ''}"></div>`
      : '';

    return `<button type="button" class="${cls}" data-step="${i}" role="listitem"${isCompleted ? ' disabled' : ''} aria-label="${label}${isClickable ? ` (${t('landing.journey.clickSkip')})` : ''}">
        <div class="journey-step-icon" aria-hidden="true">${icon}</div>
        <div class="journey-step-indicator">${indicator}</div>
        <div class="journey-step-label">${label}</div>
      </button>${connector}`;
  }).join('');

  stepper.querySelectorAll('.journey-step[data-step]').forEach((el) => {
    el.addEventListener('click', () => {
      const target = parseInt(el.dataset.step, 10);
      if (target > state.journeyPhase) {
        goToJourneyPhase(target);
      }
    });
  });
}

async function goToJourneyPhase(target) {
  if (target <= state.journeyPhase || target >= JOURNEY_PHASE_KEYS.length) return;
  if (state.landingIsTyping) return;
  if (state.landingAwaitingReviewTopics) return;
  if (state.landingAwaitingSinceVisitChecklist) return;
  if (state.landingAwaitingConcernsChecklist) return;
  if (state.landingAwaitingVisitGoalsChecklist) return;
  if (state.landingSinceVisitFollowUp) return;
  if (state.landingAwaitingHandoffSummaryReview) return;
  if (state.landingAwaitingHandoffShareChoice) return;
  if (state.landingAwaitingPostWalkthroughFeedback) return;
  if (state.landingAwaitingWalkthroughContinue) return;

  if (state.journeyPhase === 1 && !state.reviewWrapStep) {
    state.pendingPhaseTarget = target;
    void startReviewWrapUp();
    return;
  }

  await executePhaseTransition(target);
}

async function executePhaseTransition(target) {
  const labels = getJourneyPhases();
  const previousPhase = labels[state.journeyPhase];
  const newPhase = labels[target];

  state.journeyPhase = target;
  renderJourneyStepper();

  state.landingIsTyping = true;
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (sendBtn) sendBtn.disabled = true;
  showLandingTyping();

  const history = landingMessagesForModel(state.landingMessages);
  const transitionPrompt =
    `[Phase transition: the user has finished "${previousPhase}" and is moving to "${newPhase}". ` +
    `Briefly recap what was discussed so far, then smoothly transition into "${newPhase}" with an opening question or prompt for the patient.]`;

  try {
    const data = await sendChatMessage({
      message: transitionPrompt,
      history,
      mode: 'dashboard',
      path: 'guided',
      record: state.patientRecord || {},
      checklistContext: buildLandingChecklistContext(),
    });
    removeLandingTyping();
    const isFinalWrapUp = target === JOURNEY_PHASE_KEYS.length - 1;
    state.landingMessages.push({
      role: 'assistant',
      content: data.reply,
      ...(isFinalWrapUp ? { endConversationCta: true } : {}),
    });
    if (isFinalWrapUp) {
      state.landingEndConversationCtaVisible = true;
    }
    renderLandingChatMessages();
    await saveLandingSession();
  } catch (err) {
    removeLandingTyping();
    state.landingMessages.push({
      role: 'assistant',
      content: err.message || t('errors.serverRetry'),
    });
    renderLandingChatMessages();
  } finally {
    state.landingIsTyping = false;
    if (sendBtn) sendBtn.disabled = !input?.value.trim();
  }
}

export function advanceJourneyPhase() {
  if (state.journeyPhase >= JOURNEY_PHASE_KEYS.length - 1) return;
  state.journeyPhase++;
  renderJourneyStepper();
}

function needsOnboarding() {
  return !state.profile.language || !state.profile.name;
}

function bootstrapLandingIfEmpty() {
  if (state.landingMessages.length) return;
  if (needsOnboarding()) {
    startLanguageOnboardingMessages();
  } else {
    state.journeyPhase = 1;
    state.onboardingStep = null;
    void (async () => {
      await pushLandingGreetingMessages();
      await runVisitWalkthrough();
    })();
  }
}

/** First assistant turn: language chips. Used on restart regardless of saved profile. */
function startLanguageOnboardingMessages() {
  state.journeyPhase = 0;
  state.onboardingStep = 'language';
  void pushStaggeredAssistantMessage(
    onboardingLanguage(),
    INITIAL_GREETING_DELAY_MS,
    { chips: ['en', 'es'] }
  );
}

export function initLandingChat() {
  state.landingConversationStarted = true;
  bootstrapLandingIfEmpty();
  renderJourneyStepper();
  renderLandingChatMessages();
  setLandingAmbientMode('chat');
}

/**
 * @param {{ skipRender?: boolean }} [options]
 */
export function resetLandingChat(options = {}) {
  const { skipRender = false } = options;
  bumpLandingEpoch();
  removeLandingTyping();
  state.landingIsTyping = false;
  state.landingMessages = [];
  state.landingSessionId = null;
  state.landingAwaitingLastVisitQuestions = false;
  state.landingLastVisitQsStep = null;
  state.landingAwaitingReviewTopics = false;
  state.landingReviewPriorityPhase = null;
  state.landingPriorityTopics = [];
  state.landingAwaitingSinceVisitChecklist = false;
  state.landingAwaitingConcernsChecklist = false;
  state.landingAwaitingVisitGoalsChecklist = false;
  state.landingAwaitingProviderQuestionContinue = false;
  state.landingSinceVisitFollowUp = null;
  state.landingSinceVisitDetails = {};
  state.landingSinceVisitNarrative = '';
  state.landingGoingWellReply = '';
  state.landingConcernsDetails = {};
  state.landingVisitGoalsDetails = {};
  state.landingVisitGoalsNote = '';
  state.landingAwaitingHandoffSummaryReview = false;
  state.landingAwaitingHandoffShareChoice = false;
  state.landingConversationStarted = true;
  state.journeyPhase = 0;
  state.onboardingStep = null;
  state.reviewWrapStep = null;
  state.pendingPhaseTarget = null;
  state.landingStudyFeedbackReason = null;
  state.landingFeedbackSummaryMarkdown = null;
  state.landingAwaitingPostWalkthroughFeedback = false;
  state.landingAwaitingWalkthroughContinue = false;
  state.landingEndConversationCtaVisible = false;
  if (!skipRender) {
    renderJourneyStepper();
    renderLandingChatMessages();
  }
}

export function restartLandingFromBeginning() {
  if (!window.confirm(t('landing.restartConfirm'))) return;
  resetLandingChat({ skipRender: true });
  clearLandingComposerInput();
  const body = document.getElementById('landing-chat-body');
  if (body) body.innerHTML = '';
  state.landingConversationStarted = true;
  // Always re-run from language selection; do not skip because profile is already set.
  startLanguageOnboardingMessages();
  renderJourneyStepper();
  renderLandingChatMessages();
  setLandingAmbientMode('chat');
}

/** Focus the landing composer when the bot expects typed input (not chip-only or primary CTA-only steps). */
function maybeFocusLandingChatInputAfterRender() {
  if (state.landingIsTyping) return;
  if (state.landingAwaitingPostWalkthroughFeedback) return;
  if (state.landingAwaitingWalkthroughContinue) return;
  if (state.landingAwaitingHandoffShareChoice) return;
  const input = document.getElementById('landing-chat-input');
  if (!input || input.disabled) return;
  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (!lastMsg || lastMsg.role !== 'assistant') return;
  if (lastMsg.chips?.length) return;
  if (
    lastMsg.sinceVisitChecklistForm ||
    lastMsg.visitGoalsChecklistForm ||
    lastMsg.reviewPriorityFieldsForm
  ) {
    return;
  }
  if (lastMsg.providerQuestionsSmsOffer) return;
  if (
    lastMsg.action &&
    (state.onboardingStep === 'privacy' || lastMsg.sinceVisitFollowUpStep === 'pre-handoff-confirm')
  ) {
    return;
  }

  requestAnimationFrame(() => {
    const el = document.getElementById('landing-chat-input');
    if (el && !el.disabled) el.focus();
  });
}

function getLastReversibleLandingAssistantIndex() {
  if (state.landingIsTyping) return -1;
  const lastAssistantIdx = state.landingMessages.map(m => m.role).lastIndexOf('assistant');
  if (lastAssistantIdx <= 0) return -1;
  const previousAssistantIdx = state.landingMessages
    .slice(0, lastAssistantIdx)
    .map(m => m.role)
    .lastIndexOf('assistant');
  return previousAssistantIdx >= 0 ? lastAssistantIdx : -1;
}

function updateLandingBackTurnButton() {
  const btn = document.getElementById('landing-back-turn-btn');
  if (!btn) return;
  btn.disabled = getLastReversibleLandingAssistantIndex() === -1;
}

function updateEndConversationCta() {
  const btn = document.getElementById('landing-end-conversation-cta');
  if (!btn) return;
  btn.hidden = !state.landingEndConversationCtaVisible;
}

function syncLandingAwaitingStateFromLastMessage() {
  const lastMsg = state.landingMessages[state.landingMessages.length - 1];

  state.landingAwaitingLastVisitQuestions = false;
  state.landingLastVisitQsStep = null;
  state.landingAwaitingReviewTopics = false;
  state.landingReviewPriorityPhase = null;
  state.landingAwaitingSinceVisitChecklist = false;
  state.landingAwaitingConcernsChecklist = false;
  state.landingAwaitingVisitGoalsChecklist = false;
  state.landingAwaitingProviderQuestionContinue = false;
  state.landingSinceVisitFollowUp = null;
  state.landingAwaitingHandoffSummaryReview = false;
  state.landingAwaitingHandoffShareChoice = false;
  state.landingAwaitingPostWalkthroughFeedback = false;
  state.landingAwaitingWalkthroughContinue = false;
  state.landingEndConversationCtaVisible = false;
  state.reviewWrapStep = null;
  state.pendingPhaseTarget = null;
  state.landingStudyFeedbackReason = null;
  state.landingFeedbackSummaryMarkdown = null;

  if (!lastMsg || lastMsg.role !== 'assistant') return;

  if (lastMsg.content === onboardingLanguage() && lastMsg.chips?.includes('en') && lastMsg.chips?.includes('es')) {
    state.onboardingStep = 'language';
  } else if (lastMsg.content === onboardingName()) {
    state.onboardingStep = 'name';
  } else if (lastMsg.action?.handler === handlePrivacyContinue) {
    state.onboardingStep = 'privacy';
  } else {
    state.onboardingStep = null;
  }

  if (lastMsg.content === t('landing.review.summaryQuestion')) state.reviewWrapStep = 'summary-question';
  if (lastMsg.content === t('landing.review.moreQuestions')) state.reviewWrapStep = 'questions-loop';
  if (lastMsg.content === t('landing.review.nextSteps')) state.reviewWrapStep = 'next-steps';
  if (lastMsg.content === t('landing.review.exploreBlocker')) state.reviewWrapStep = 'next-steps-explore';

  if (lastMsg.sinceVisitFollowUpStep) state.landingSinceVisitFollowUp = lastMsg.sinceVisitFollowUpStep;
  if (lastMsg.reviewPriorityFieldsForm) {
    state.landingAwaitingReviewTopics = true;
    state.landingReviewPriorityPhase = 'fields';
  }
  if (lastMsg.sinceVisitChecklistForm) state.landingAwaitingSinceVisitChecklist = true;
  if (lastMsg.concernsChecklistForm) state.landingAwaitingConcernsChecklist = true;
  if (lastMsg.visitGoalsChecklistForm) state.landingAwaitingVisitGoalsChecklist = true;
  if (lastMsg.providerQuestionsSmsOffer) state.landingAwaitingProviderQuestionContinue = true;
  if (lastMsg.handoffSummaryReviewForm) state.landingAwaitingHandoffSummaryReview = true;
  if (lastMsg.handoffSharePrompt) state.landingAwaitingHandoffShareChoice = true;
  if (lastMsg.endConversationCta) state.landingEndConversationCtaVisible = true;
}

async function reverseLandingAssistantTurn() {
  const lastAssistantIdx = getLastReversibleLandingAssistantIndex();
  if (lastAssistantIdx === -1) return;

  const previousAssistantIdx = state.landingMessages
    .slice(0, lastAssistantIdx)
    .map(m => m.role)
    .lastIndexOf('assistant');

  bumpLandingEpoch();
  removeLandingTyping();
  state.landingIsTyping = false;
  state.landingMessages = state.landingMessages.slice(0, previousAssistantIdx + 1);
  syncLandingAwaitingStateFromLastMessage();
  renderJourneyStepper();
  renderLandingChatMessages();
  await saveLandingSession();
}

/**
 * @param {{ suppressChatScroll?: boolean }} [opts]
 */
export function renderLandingChatMessages(opts = {}) {
  const body = document.getElementById('landing-chat-body');
  if (!body) return;

  body.innerHTML = state.landingMessages
    .map((m, idx) => {
      if (m.role === 'assistant') {
        if (m.handoffSummaryReviewForm && typeof m.handoffSummaryDraft === 'string') {
          return '';
        }
        if (m.approvedSummaryDoc) {
          const ackHtml = typeof m.content === 'string' && m.content.trim()
            ? `<div class="msg-bubble landing-summary-doc-ack">${formatMessage(m.content)}</div>`
            : '';
          return `
<div class="msg-row assistant">
  <div class="msg-avatar">HC</div>
  <div class="landing-summary-doc-stack">
    ${ackHtml}
    <button type="button" class="landing-summary-doc-card" data-summary-doc-idx="${idx}" aria-label="${escapeHtml(t('landing.handoff.docCardOpenAria'))}">
      <span class="landing-summary-doc-card-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      </span>
      <span class="landing-summary-doc-card-text">
        <span class="landing-summary-doc-card-label">${escapeHtml(t('landing.handoff.docCardLabel'))}</span>
        <span class="landing-summary-doc-card-hint">${escapeHtml(t('landing.handoff.docCardHint'))}</span>
      </span>
      <span class="landing-summary-doc-card-chevron" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </span>
    </button>
  </div>
</div>`;
        }
        let journeyGraphicHtml = '';
        if (m.journeyGraphic) {
          journeyGraphicHtml = `
    <img class="msg-journey-graphic" src="/images/journey-steps-illustration.png" alt="${escapeHtml(t('landing.greeting.timelineGraphicAlt'))}" />`;
        }
        let bubbleInner = formatMessage(m.content);
        if (
          m.providerQuestionsSmsOffer &&
          Array.isArray(m.providerQuestionsItems) &&
          m.providerQuestionsItems.length
        ) {
          bubbleInner =
            formatMessage(t('landing.providerQs.header')) +
            providerQuestionsSuggestionsFieldsetHtml(
              m.providerQuestionsItems,
              idx,
              m.providerQuestionsChecked
            ) +
            formatMessage(t('landing.providerQs.footer'));
        }
        return `
<div class="msg-row assistant">
  <div class="msg-avatar">HC</div>
  <div class="msg-bubble">${bubbleInner}${journeyGraphicHtml}</div>
</div>`;
      }
      return `
<div class="msg-row user">
  <div class="msg-bubble-wrap">
    <div class="msg-bubble">${escapeHtml(m.content)}</div>
    <button type="button" class="msg-edit-btn" data-msg-idx="${idx}" title="${escapeHtml(t('landing.msg.edit'))}" aria-label="${escapeHtml(t('landing.msg.edit'))}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
  </div>
  <div class="msg-avatar">${getUserInitials()}</div>
</div>`;
    })
    .join('');

  body.querySelectorAll('.landing-pq-suggestion-cb').forEach((cb) => {
    cb.addEventListener('change', () => {
      const mi = Number(cb.dataset.msgIdx);
      const qi = Number(cb.dataset.qIdx);
      const msg = state.landingMessages[mi];
      if (!msg?.providerQuestionsItems?.length) return;
      if (!Array.isArray(msg.providerQuestionsChecked)) {
        msg.providerQuestionsChecked = msg.providerQuestionsItems.map(() => true);
      }
      msg.providerQuestionsChecked[qi] = cb.checked;
    });
  });

  body.querySelectorAll('.landing-pq-add-own-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mi = Number(btn.dataset.msgIdx);
      const wrap = body.querySelector(`#landing-pq-add-own-wrap-${mi}`);
      const inputEl = body.querySelector(`#landing-pq-add-own-input-${mi}`);
      if (!wrap) return;
      if (wrap.hidden) {
        wrap.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => inputEl?.focus());
      } else {
        wrap.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });

  body.querySelectorAll('.landing-pq-add-own-input').forEach((input) => {
    input.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const mi = Number(input.dataset.msgIdx);
      void addOwnProviderQuestion(mi);
    });
  });

  body.querySelectorAll('.landing-pq-add-own-submit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mi = Number(btn.dataset.msgIdx);
      void addOwnProviderQuestion(mi);
    });
  });

  renderHandoffSummaryReviewCard();
  body.querySelectorAll('.msg-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.msgIdx, 10);
      beginEditMessage(idx);
    });
  });
  body.querySelectorAll('.landing-summary-doc-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.summaryDocIdx, 10);
      const msg = state.landingMessages[idx];
      const text =
        typeof msg?.approvedSummaryDocText === 'string' && msg.approvedSummaryDocText
          ? msg.approvedSummaryDocText
          : getApprovedProviderNoteMarkdown();
      if (onOpenSummaryDoc) onOpenSummaryDoc(text);
    });
  });

  renderInteractiveElements(body);

  updateLandingBackTurnButton();
  updateEndConversationCta();
  if (!opts.suppressChatScroll) scrollLandingChatBottom();
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (sendBtn) {
    const reviewPriorityBlocksSend =
      state.landingAwaitingReviewTopics && state.landingReviewPriorityPhase === 'fields';
    const blockSend =
      state.landingIsTyping ||
      reviewPriorityBlocksSend ||
      state.landingAwaitingSinceVisitChecklist ||
      state.landingAwaitingConcernsChecklist ||
      state.landingAwaitingVisitGoalsChecklist ||
      state.landingAwaitingProviderQuestionContinue ||
      state.landingAwaitingHandoffShareChoice ||
      state.landingAwaitingPostWalkthroughFeedback ||
      state.landingAwaitingWalkthroughContinue;
    sendBtn.disabled = blockSend || !input?.value.trim();
  }
  if (input) {
    const reviewPriorityBlocksInput =
      state.landingAwaitingReviewTopics && state.landingReviewPriorityPhase === 'fields';
    input.disabled =
      reviewPriorityBlocksInput ||
      state.landingAwaitingSinceVisitChecklist ||
      state.landingAwaitingConcernsChecklist ||
      state.landingAwaitingVisitGoalsChecklist ||
      state.landingAwaitingProviderQuestionContinue ||
      state.landingAwaitingHandoffShareChoice ||
      state.landingAwaitingPostWalkthroughFeedback ||
      state.landingAwaitingWalkthroughContinue;
  }

  maybeFocusLandingChatInputAfterRender();
}

function renderHandoffSummaryReviewCard() {
  const chat = document.getElementById('landing-chat');
  const existing = chat?.querySelector(':scope > .landing-handoff-summary-card');
  existing?.remove();
  if (!chat) return;

  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (!lastMsg?.handoffSummaryReviewForm || typeof lastMsg.handoffSummaryDraft !== 'string') return;

  const isEditing = !!lastMsg.handoffSummaryIsEditing;
  const bodyHtml = typeof lastMsg.handoffSummaryDraftHtml === 'string' && lastMsg.handoffSummaryDraftHtml
    ? lastMsg.handoffSummaryDraftHtml
    : formatMessage(lastMsg.handoffSummaryDraft);
  const hasPendingEdits = htmlContainsTrackedChanges(lastMsg.handoffSummaryDraftHtml);

  const card = document.createElement('div');
  card.className = 'landing-handoff-summary-card';
  if (isEditing) card.classList.add('is-editing');
  card.setAttribute('aria-label', t('landing.noteCard.preNoteDraftAria'));
  const editBtnLabel = isEditing ? t('landing.handoff.editingBtn') : t('landing.handoff.editBtn');
  const approveBtnLabel = hasPendingEdits
    ? t('landing.handoff.applyEditsBtn')
    : t('landing.handoff.approveBtn');
  card.innerHTML = `
    <div class="landing-handoff-summary-card-header">
      <div class="landing-handoff-summary-label">${escapeHtml(t('landing.noteCard.preNoteLabel'))}</div>
    </div>
    <div class="landing-handoff-summary-guidance landing-handoff-summary-guidance--top">${formatMessage(lastMsg.content)}</div>
    <div
      class="landing-handoff-summary-body"
      id="landing-handoff-summary-body"
      ${isEditing ? 'contenteditable="true" spellcheck="true" aria-label="' + escapeHtml(t('landing.handoff.editAria')) + '"' : ''}
    >${bodyHtml}</div>
    <div class="landing-handoff-summary-footer">
      <div class="landing-action-row landing-handoff-main-actions">
        <button
          type="button"
          class="landing-action-btn${isEditing ? ' is-active' : ''}"
          id="landing-handoff-edit-btn"
          aria-pressed="${isEditing ? 'true' : 'false'}"
        >${escapeHtml(editBtnLabel)}</button>
        <button type="button" class="landing-action-btn" id="landing-handoff-approve-btn">${escapeHtml(approveBtnLabel)}</button>
      </div>
    </div>
  `;

  const inputArea = chat.querySelector(':scope > .landing-chat-input-area');
  chat.insertBefore(card, inputArea);

  card.querySelector('#landing-handoff-approve-btn')?.addEventListener('click', () => {
    void handleHandoffSummaryApprove();
  });
  card.querySelector('#landing-handoff-edit-btn')?.addEventListener('click', () => {
    toggleHandoffSummaryEditing();
  });

  if (isEditing) {
    const editor = card.querySelector('#landing-handoff-summary-body');
    const approveBtn = card.querySelector('#landing-handoff-approve-btn');
    if (editor) {
      const persist = () => {
        const msg = findCurrentHandoffReviewMessage();
        if (!msg) return;
        msg.handoffSummaryDraftHtml = editor.innerHTML;
        if (approveBtn) {
          approveBtn.textContent = hasTrackedChanges(editor)
            ? t('landing.handoff.applyEditsBtn')
            : t('landing.handoff.approveBtn');
        }
      };
      attachTrackChanges(editor, persist);
      requestAnimationFrame(() => editor.focus());
    }
  }
}

function htmlContainsTrackedChanges(html) {
  if (typeof html !== 'string' || !html) return false;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return hasTrackedChanges(tmp);
}

function findCurrentHandoffReviewMessage() {
  const idx = findLastAssistantHandoffReviewIndex();
  return idx >= 0 ? state.landingMessages[idx] : null;
}

function toggleHandoffSummaryEditing() {
  const msg = findCurrentHandoffReviewMessage();
  if (!msg) return;
  if (msg.handoffSummaryIsEditing) {
    const editor = document.getElementById('landing-handoff-summary-body');
    if (editor) {
      msg.handoffSummaryDraftHtml = editor.innerHTML;
      if (!hasTrackedChanges(editor)) {
        delete msg.handoffSummaryDraftHtml;
      }
    }
    msg.handoffSummaryIsEditing = false;
  } else {
    msg.handoffSummaryIsEditing = true;
  }
  renderHandoffSummaryReviewCard();
  void saveLandingSession();
}

function handleHandoffSummaryAcceptAll() {
  const editor = document.getElementById('landing-handoff-summary-body');
  const msg = findCurrentHandoffReviewMessage();
  if (!editor || !msg) return;
  acceptAllChanges(editor);
  const plain = flattenAcceptedText(editor);
  msg.handoffSummaryDraft = plain;
  delete msg.handoffSummaryDraftHtml;
  msg.handoffSummaryIsEditing = false;
  renderHandoffSummaryReviewCard();
  void saveLandingSession();
}

function handleHandoffSummaryRejectAll() {
  const editor = document.getElementById('landing-handoff-summary-body');
  const msg = findCurrentHandoffReviewMessage();
  if (!editor || !msg) return;
  rejectAllChanges(editor);
  delete msg.handoffSummaryDraftHtml;
  msg.handoffSummaryIsEditing = false;
  renderHandoffSummaryReviewCard();
  void saveLandingSession();
}

function renderInteractiveElements(body) {
  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (!lastMsg || lastMsg.role !== 'assistant') return;

  if (lastMsg.reviewPriorityFieldsForm) {
    const wrap = document.createElement('div');
    wrap.className = 'landing-review-topics-form';
    wrap.innerHTML = `
      <div class="landing-review-topics-fields" role="group" aria-label="${escapeHtml(t('landing.review.focusAria'))}">
        <label class="landing-review-topic-label">
          <span class="landing-review-topic-label-text">${escapeHtml(t('landing.review.focus1'))}</span>
          <div class="landing-review-topic-input-row">
            <textarea class="landing-review-topic-input" id="landing-review-topic-0" rows="1" maxlength="200" autocomplete="off" placeholder="${escapeHtml(t('landing.review.phExample'))}"></textarea>
            <button type="button" class="landing-review-topic-clear" hidden aria-label="${escapeHtml(t('landing.review.clearTopicAria'))}">${escapeHtml(t('landing.review.clearTopic'))}</button>
          </div>
        </label>
        <label class="landing-review-topic-label">
          <span class="landing-review-topic-label-text">${escapeHtml(t('landing.review.focus2'))}</span>
          <div class="landing-review-topic-input-row">
            <textarea class="landing-review-topic-input" id="landing-review-topic-1" rows="1" maxlength="200" autocomplete="off" placeholder="${escapeHtml(t('landing.review.optional'))}"></textarea>
            <button type="button" class="landing-review-topic-clear" hidden aria-label="${escapeHtml(t('landing.review.clearTopicAria'))}">${escapeHtml(t('landing.review.clearTopic'))}</button>
          </div>
        </label>
        <label class="landing-review-topic-label">
          <span class="landing-review-topic-label-text">${escapeHtml(t('landing.review.focus3'))}</span>
          <div class="landing-review-topic-input-row">
            <textarea class="landing-review-topic-input" id="landing-review-topic-2" rows="1" maxlength="200" autocomplete="off" placeholder="${escapeHtml(t('landing.review.optional'))}"></textarea>
            <button type="button" class="landing-review-topic-clear" hidden aria-label="${escapeHtml(t('landing.review.clearTopicAria'))}">${escapeHtml(t('landing.review.clearTopic'))}</button>
          </div>
        </label>
      </div>
      <div class="landing-action-row landing-review-topics-actions">
        <button type="button" class="landing-review-topics-btn-secondary" id="landing-review-priority-nothing">${escapeHtml(t('landing.review.nothingSpecific'))}</button>
        <button type="button" class="landing-review-topics-btn-secondary landing-review-priority-suggest-btn" id="landing-review-priority-suggest">${escapeHtml(t('landing.review.needSuggestions'))}</button>
      </div>
      <div id="landing-review-priority-suggestions-wrap" class="landing-review-priority-suggestions-wrap" hidden>
        <div class="landing-review-ai-suggestions" aria-label="${escapeHtml(t('landing.review.suggestionsAria'))}">
          <div class="landing-review-ai-suggestions-toolbar">
            <div class="landing-review-ai-suggestions-header">${escapeHtml(t('landing.review.fromNote'))}</div>
            <button type="button" class="landing-review-suggestions-refresh" id="landing-review-suggestions-refresh">${escapeHtml(t('landing.review.refresh'))}</button>
          </div>
          <div class="landing-review-ai-suggestions-body" id="landing-review-ai-suggestions-body">
            <span class="landing-review-ai-suggestions-placeholder">${escapeHtml(t('landing.review.suggestionsPlaceholder'))}</span>
          </div>
        </div>
      </div>
      <div class="landing-review-topics-divider" role="presentation"></div>
      <div class="landing-action-row landing-review-topics-submit-row">
        <button type="button" class="landing-action-btn" id="landing-review-topics-submit">${escapeHtml(t('landing.review.continue'))}</button>
      </div>
    `;
    wrap.querySelector('#landing-review-priority-nothing')?.addEventListener('click', () => {
      void handleReviewPriorityNothingExplicit();
    });
    wrap.querySelector('#landing-review-topics-submit')?.addEventListener('click', () => {
      void handleReviewPriorityFieldsContinue();
    });
    wrap.querySelector('#landing-review-priority-suggest')?.addEventListener('click', () => {
      void loadReviewFocusSuggestions();
    });
    wrap.querySelector('#landing-review-suggestions-refresh')?.addEventListener('click', () => {
      void loadReviewFocusSuggestions({ regenerate: true });
    });
    wrap.querySelectorAll('.landing-review-topic-input').forEach((el, i, arr) => {
      wireReviewTopicInputRow(el);
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (i < arr.length - 1) arr[i + 1].focus();
        else void handleReviewPriorityFieldsContinue();
      });
    });
    body.appendChild(wrap);
    requestAnimationFrame(() => {
      document.getElementById('landing-review-topic-0')?.focus();
    });
    return;
  }

  if (lastMsg.sinceVisitChecklistForm) {
    const wrap = document.createElement('div');
    wrap.className = 'landing-since-visit-checklist-form';
    const rowsHtml = sinceVisitChecklistItems().map(
      (item) => `
      <div class="landing-since-visit-check-row">
        <label class="landing-since-visit-check-item" for="landing-since-visit-${item.id}">
          <input type="checkbox" class="landing-since-visit-check-input" id="landing-since-visit-${item.id}" />
          <span class="landing-since-visit-check-text">${escapeHtml(item.label)}</span>
        </label>
        <div class="landing-since-visit-detail-wrap" id="landing-since-visit-detail-wrap-${item.id}" hidden>
          <input
            type="text"
            class="landing-since-visit-detail-input"
            id="landing-since-visit-detail-${item.id}"
            maxlength="300"
            autocomplete="off"
            placeholder="${escapeHtml(t('landing.sinceVisit.phDetail'))}"
            aria-label="${escapeHtml(t('landing.sinceVisit.ariaDetail'))}"
          />
        </div>
      </div>`
    ).join('');
    wrap.innerHTML = `
      <textarea
        id="landing-since-visit-narrative"
        class="landing-since-visit-narrative-input"
        rows="3"
        maxlength="2000"
        autocomplete="off"
        aria-label="${escapeHtml(t('landing.sinceVisit.narrativeLabel'))}"
        placeholder="${escapeHtml(t('landing.sinceVisit.narrativePlaceholder'))}"
      ></textarea>
      <fieldset class="landing-since-visit-check-fieldset">
        <legend class="sr-only">${escapeHtml(t('landing.sinceVisit.legend'))}</legend>
        ${rowsHtml}
      </fieldset>
      <p class="landing-since-visit-check-hint">${escapeHtml(t('landing.sinceVisit.hint'))}</p>
      <div class="landing-action-row landing-since-visit-check-actions">
        <button type="button" class="landing-review-topics-btn-secondary" id="landing-since-visit-none">${escapeHtml(t('landing.sinceVisit.none'))}</button>
        <button type="button" class="landing-action-btn" id="landing-since-visit-continue">${escapeHtml(t('landing.review.continue'))}</button>
      </div>
    `;
    const narrativeTa = wrap.querySelector('#landing-since-visit-narrative');
    if (narrativeTa) {
      const savedNarr = typeof state.landingSinceVisitNarrative === 'string' ? state.landingSinceVisitNarrative : '';
      if (savedNarr) narrativeTa.value = savedNarr;
      narrativeTa.addEventListener('input', () => {
        state.landingSinceVisitNarrative = narrativeTa.value;
      });
    }
    sinceVisitChecklistItems().forEach((item) => {
      const cb = wrap.querySelector(`#landing-since-visit-${item.id}`);
      const detailWrap = wrap.querySelector(`#landing-since-visit-detail-wrap-${item.id}`);
      const detailInput = wrap.querySelector(`#landing-since-visit-detail-${item.id}`);
      if (!cb || !detailWrap || !detailInput) return;
      const saved = state.landingSinceVisitDetails?.[item.id];
      if (saved) {
        cb.checked = !!saved.checked;
        if (typeof saved.detail === 'string') detailInput.value = saved.detail;
      }
      const syncDetailVisibility = () => {
        detailWrap.hidden = !cb.checked;
      };
      const persist = () => {
        updateLandingChecklistDetail('sinceVisit', item.id, item.label, cb.checked, detailInput.value);
      };
      cb.addEventListener('change', () => {
        syncDetailVisibility();
        persist();
      });
      detailInput.addEventListener('input', persist);
      syncDetailVisibility();
      persist();
    });
    wrap.querySelector('#landing-since-visit-continue')?.addEventListener('click', () => {
      handleSinceVisitChecklistSubmit();
    });
    wrap.querySelector('#landing-since-visit-none')?.addEventListener('click', () => {
      handleSinceVisitChecklistNone();
    });
    body.appendChild(wrap);
    requestAnimationFrame(() => {
      document.getElementById('landing-since-visit-narrative')?.focus();
    });
    return;
  }

  if (lastMsg.visitGoalsChecklistForm) {
    const wrap = document.createElement('div');
    wrap.className = 'landing-since-visit-checklist-form landing-visit-goals-checklist-form';
    const rowsHtml = visitGoalsChecklistItems().map(
      (item) => `
      <div class="landing-since-visit-check-row">
        <label class="landing-since-visit-check-item" for="landing-visit-goals-${item.id}">
          <input type="checkbox" class="landing-since-visit-check-input" id="landing-visit-goals-${item.id}" />
          <span class="landing-since-visit-check-text">${escapeHtml(item.label)}</span>
        </label>
      </div>`
    ).join('');
    wrap.innerHTML = `
      <div class="landing-visit-goals-examples-card" role="group" aria-labelledby="landing-visit-goals-examples-title">
        <div class="landing-visit-goals-examples-title" id="landing-visit-goals-examples-title">${escapeHtml(t('landing.visitGoals.examplesTitle'))}</div>
        <fieldset class="landing-since-visit-check-fieldset">
          <legend class="sr-only">${escapeHtml(t('landing.visitGoals.legend'))}</legend>
          ${rowsHtml}
        </fieldset>
      </div>
      <label class="landing-visit-goals-notes-label" for="landing-visit-goals-notes">${escapeHtml(t('landing.visitGoals.anythingElse'))} <span class="landing-visit-goals-optional">${escapeHtml(t('landing.visitGoals.optional'))}</span></label>
      <textarea
        id="landing-visit-goals-notes"
        class="landing-visit-goals-notes-input"
        rows="3"
        maxlength="1200"
        autocomplete="off"
        placeholder="${escapeHtml(t('landing.visitGoals.notesPlaceholder'))}"
      ></textarea>
      <p class="landing-since-visit-check-hint">${escapeHtml(t('landing.visitGoals.hint'))}</p>
      <div class="landing-action-row landing-since-visit-check-actions">
        <button type="button" class="landing-review-topics-btn-secondary" id="landing-visit-goals-none">${escapeHtml(t('landing.visitGoals.nothingToAdd'))}</button>
        <button type="button" class="landing-action-btn" id="landing-visit-goals-continue">${escapeHtml(t('landing.review.continue'))}</button>
      </div>
    `;
    visitGoalsChecklistItems().forEach((item) => {
      const cb = wrap.querySelector(`#landing-visit-goals-${item.id}`);
      if (!cb) return;
      const saved = state.landingVisitGoalsDetails?.[item.id];
      if (saved) cb.checked = !!saved.checked;
      const persist = () => {
        updateLandingChecklistDetail('visitGoals', item.id, item.label, cb.checked);
      };
      cb.addEventListener('change', persist);
      persist();
    });
    const notesTa = wrap.querySelector('#landing-visit-goals-notes');
    if (notesTa) {
      const savedNote = typeof state.landingVisitGoalsNote === 'string' ? state.landingVisitGoalsNote : '';
      if (savedNote) notesTa.value = savedNote;
      notesTa.addEventListener('input', () => {
        state.landingVisitGoalsNote = notesTa.value;
      });
    }
    wrap.querySelector('#landing-visit-goals-continue')?.addEventListener('click', () => {
      void handleVisitGoalsContinue();
    });
    wrap.querySelector('#landing-visit-goals-none')?.addEventListener('click', () => {
      void handleVisitGoalsNothingToAdd();
    });
    body.appendChild(wrap);
    requestAnimationFrame(() => {
      document.getElementById('landing-visit-goals-refill')?.focus();
    });
    return;
  }

  if (
    lastMsg.providerQuestionsSmsOffer &&
    lastMsg.sinceVisitFollowUpStep === 'provider-questions-suggestions'
  ) {
    const wrap = document.createElement('div');
    wrap.className = 'landing-provider-questions-followup';
    wrap.innerHTML = `
      <div class="landing-since-visit-checklist-form">
        <div class="landing-action-row landing-pq-sms-row">
          <button
            type="button"
            class="landing-review-topics-btn-secondary"
            id="landing-pq-sms-btn"
            aria-expanded="false"
            aria-controls="landing-pq-phone-wrap"
          >${escapeHtml(t('landing.pq.textPhone'))}</button>
          <div class="landing-pq-phone-wrap" id="landing-pq-phone-wrap" hidden>
            <label class="sr-only" for="landing-pq-phone">${escapeHtml(t('landing.pq.mobile'))}</label>
            <input type="tel" class="landing-since-visit-detail-input" id="landing-pq-phone" placeholder="${escapeHtml(t('landing.pq.phPhone'))}" autocomplete="tel" />
          </div>
        </div>
        <div class="landing-action-row landing-since-visit-check-actions">
          <button type="button" class="landing-action-btn" id="landing-pq-continue">${escapeHtml(t('landing.pq.continueGoals'))}</button>
        </div>
      </div>
    `;
    const pqSmsBtn = wrap.querySelector('#landing-pq-sms-btn');
    const pqPhoneWrap = wrap.querySelector('#landing-pq-phone-wrap');
    pqSmsBtn?.addEventListener('click', () => {
      const phoneEl = wrap.querySelector('#landing-pq-phone');
      if (pqPhoneWrap?.hidden) {
        pqPhoneWrap.removeAttribute('hidden');
        pqSmsBtn.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => phoneEl?.focus());
        return;
      }
      const phone = phoneEl?.value?.trim() || '';
      if (!phone) {
        showToast(t('landing.pq.toastNeedPhone'));
        return;
      }
      const bodyRaw = buildProviderQuestionsSmsBody(lastMsg);
      if (!bodyRaw) {
        showToast(t('landing.pq.toastNeedSelection'));
        return;
      }
      const body = encodeURIComponent(bodyRaw);
      window.open(`sms:${encodeURIComponent(phone)}?body=${body}`, '_self');
      showToast(t('landing.pq.toastOpening'));
    });
    wrap.querySelector('#landing-pq-continue')?.addEventListener('click', () => {
      void handleContinueToVisitGoalsFromSuggestions();
    });
    body.appendChild(wrap);
    return;
  }

  if (lastMsg.handoffSharePrompt) {
    const wrap = document.createElement('div');
    wrap.className = 'landing-since-visit-checklist-form landing-handoff-share-form';
    wrap.setAttribute('aria-label', t('landing.handoff.shareLegend'));
    const rowsHtml = handoffShareOptions().map((option) => {
      const otherFieldHtml = option.id === 'other'
        ? `
        <div class="landing-handoff-share-other-wrap" id="landing-handoff-share-other-wrap" hidden>
          <label class="sr-only" for="landing-handoff-share-other-input">${escapeHtml(t('landing.handoff.shareOtherAria'))}</label>
          <input
            type="text"
            class="landing-since-visit-detail-input landing-handoff-share-other-input"
            id="landing-handoff-share-other-input"
            maxlength="200"
            autocomplete="off"
            placeholder="${escapeHtml(t('landing.handoff.shareOtherPlaceholder'))}"
            aria-label="${escapeHtml(t('landing.handoff.shareOtherAria'))}"
          />
        </div>`
        : '';
      return `
      <div class="landing-since-visit-check-row">
        <label class="landing-since-visit-check-item" for="landing-handoff-share-${escapeHtml(option.id)}">
          <input
            type="checkbox"
            class="landing-since-visit-check-input"
            id="landing-handoff-share-${escapeHtml(option.id)}"
            data-share-recipient="${escapeHtml(option.id)}"
          />
          <span class="landing-since-visit-check-text">${escapeHtml(option.label)}</span>
        </label>${otherFieldHtml}
      </div>
    `;
    }).join('');
    wrap.innerHTML = `
      <fieldset class="landing-since-visit-check-fieldset">
        <legend class="sr-only">${escapeHtml(t('landing.handoff.shareLegend'))}</legend>
        ${rowsHtml}
      </fieldset>
      <div class="landing-action-row landing-since-visit-check-actions">
        <button type="button" class="landing-action-btn" id="landing-handoff-share-continue">${escapeHtml(t('landing.handoff.shareContinue'))}</button>
      </div>
    `;
    const otherCb = wrap.querySelector('#landing-handoff-share-other');
    const otherWrap = wrap.querySelector('#landing-handoff-share-other-wrap');
    const otherInput = wrap.querySelector('#landing-handoff-share-other-input');
    if (otherCb && otherWrap && otherInput) {
      const syncOtherVisibility = () => {
        otherWrap.hidden = !otherCb.checked;
        if (!otherCb.checked) otherInput.value = '';
      };
      otherCb.addEventListener('change', () => {
        syncOtherVisibility();
        if (otherCb.checked) {
          requestAnimationFrame(() => otherInput.focus());
        }
      });
      syncOtherVisibility();
    }
    wrap.querySelector('#landing-handoff-share-continue')?.addEventListener('click', () => {
      const selections = handoffShareOptions()
        .map((option) => {
          const cb = wrap.querySelector(`#landing-handoff-share-${option.id}`);
          const contact = option.id === 'other'
            ? (wrap.querySelector('#landing-handoff-share-other-input')?.value?.trim() || '')
            : '';
          return {
            id: option.id,
            label: option.label,
            selected: !!cb?.checked,
            contact,
          };
        })
        .filter((item) => item.selected);
      void handleHandoffShareChoice(selections);
    });
    body.appendChild(wrap);
    return;
  }

  if (lastMsg.chips && lastMsg.chips.length) {
    const chipRow = document.createElement('div');
    chipRow.className = 'landing-choice-chips';
    chipRow.innerHTML = lastMsg.chips.map((c, i) => {
      const code = canonicalChipValue(c);
      const label = labelForChipCode(code);
      return `<button type="button" class="chip" data-chip-value="${escapeHtml(code)}" style="animation-delay:${i * 0.08}s">${escapeHtml(label)}</button>`;
    }).join('');
    chipRow.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () =>
        handleChipClick(chip.getAttribute('data-chip-value') || '', chipRow)
      );
    });
    body.appendChild(chipRow);
  }

  if (
    lastMsg.secondaryAction &&
    typeof lastMsg.secondaryAction.label === 'string' &&
    typeof lastMsg.secondaryAction.handler === 'function' &&
    !lastMsg.action
  ) {
    const btnRow = document.createElement('div');
    btnRow.className = 'landing-action-row';
    btnRow.innerHTML = `<button type="button" class="landing-review-topics-btn-secondary" id="landing-secondary-only-action">${escapeHtml(lastMsg.secondaryAction.label)}</button>`;
    btnRow.querySelector('#landing-secondary-only-action')?.addEventListener('click', () => {
      btnRow.remove();
      const fn = lastMsg.secondaryAction?.handler;
      delete lastMsg.secondaryAction;
      fn?.();
    });
    body.appendChild(btnRow);
  }

  if (lastMsg.action) {
    const btnRow = document.createElement('div');
    btnRow.className = 'landing-action-row';
    if (lastMsg.secondaryAction && typeof lastMsg.secondaryAction.label === 'string') {
      btnRow.classList.add('landing-visit-confirm-actions');
      btnRow.innerHTML = `
        <button type="button" class="landing-action-btn" id="landing-visit-primary-action">${escapeHtml(lastMsg.action.label)}</button>
        <button type="button" class="landing-review-topics-btn-secondary" id="landing-visit-secondary-action">${escapeHtml(lastMsg.secondaryAction.label)}</button>
      `;
      btnRow.querySelector('#landing-visit-secondary-action')?.addEventListener('click', () => {
        lastMsg.secondaryAction.handler();
      });
      btnRow.querySelector('#landing-visit-primary-action')?.addEventListener('click', () => {
        const primary = lastMsg.action;
        btnRow.remove();
        delete lastMsg.action;
        delete lastMsg.secondaryAction;
        primary?.handler();
      });
    } else {
      btnRow.innerHTML = `<button class="landing-action-btn">${escapeHtml(lastMsg.action.label)}</button>`;
      btnRow.querySelector('.landing-action-btn').addEventListener('click', () => {
        btnRow.remove();
        lastMsg.action.handler();
      });
    }
    body.appendChild(btnRow);
  }
}

function handleChipClick(rawValue, chipsEl) {
  const value = canonicalChipValue(rawValue);
  chipsEl.remove();
  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (lastMsg) delete lastMsg.chips;

  if (state.onboardingStep === 'language') {
    handleLanguageSelection(value);
    return;
  }

  if (state.reviewWrapStep === 'summary-question' || state.reviewWrapStep === 'questions-loop') {
    state.landingMessages.push({ role: 'user', content: labelForChipCode(value) });
    renderLandingChatMessages();
    if (value === 'yes') {
      state.reviewWrapStep = 'questions-loop';
    } else {
      void showNextStepsQuestion();
    }
    return;
  }

  if (state.reviewWrapStep === 'next-steps') {
    state.landingMessages.push({ role: 'user', content: labelForChipCode(value) });
    renderLandingChatMessages();
    if (value === 'yes') {
      completeReviewWrapUp();
    } else {
      state.reviewWrapStep = 'next-steps-explore';
      void pushStaggeredAssistantMessage(
        t('landing.review.exploreBlocker'),
        randomShortStaggerDelayMs()
      );
    }
    return;
  }

  if (state.landingSinceVisitFollowUp === 'provider-questions') {
    void handleProviderQuestionsChipChoice(value);
    return;
  }

  const input = document.getElementById('landing-chat-input');
  if (input) {
    input.value = labelForChipCode(value);
    sendLandingMessage();
  }
}

async function handleLanguageSelection(value) {
  const lang = value === 'es' ? 'es' : 'en';
  const userLabel = lang === 'es' ? t('lang.spanish') : t('lang.english');
  state.landingMessages.push({ role: 'user', content: userLabel });
  renderLandingChatMessages();

  try {
    const result = await updateProfile({ language: lang });
    if (result?.profile) state.profile = { ...state.profile, ...result.profile };
  } catch (_) {
    state.profile.language = lang;
  }

  state.onboardingStep = 'name';
  await pushStaggeredAssistantMessage(onboardingName(), randomShortStaggerDelayMs());
}

async function handleNameInput(text) {
  state.landingMessages.push({ role: 'user', content: text });
  renderLandingChatMessages();

  state.profile.name = text;
  updateProfile({ name: text }).then(result => {
    if (result?.profile) state.profile = { ...state.profile, ...result.profile };
    if (result?.user) state.user = { ...state.user, ...result.user };
    updatePersonalization();
  }).catch(() => {});

  state.onboardingStep = 'privacy';
  await pushStaggeredAssistantMessage(
    onboardingPrivacy(text),
    randomShortStaggerDelayMs(),
    { action: { label: t('chip.continue'), handler: handlePrivacyContinue } }
  );
}

function handlePrivacyContinue() {
  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (lastMsg) delete lastMsg.action;

  state.landingMessages.push({ role: 'user', content: t('chip.continue') });

  state.onboardingStep = null;
  state.journeyPhase = 1;
  renderJourneyStepper();
  renderLandingChatMessages();

  void (async () => {
    await pushLandingGreetingMessages();
    await runVisitWalkthrough();
  })();
}

const STAGGER_DELAY_MIN_MS = 5000;
const STAGGER_DELAY_MAX_MS = 10000;
const SHORT_STAGGER_DELAY_MIN_MS = 900;
const SHORT_STAGGER_DELAY_MAX_MS = 1900;
const INITIAL_GREETING_DELAY_MS = 600;

function randomBetweenMs(minMs, maxMs) {
  return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

function randomStaggerDelayMs() {
  return randomBetweenMs(STAGGER_DELAY_MIN_MS, STAGGER_DELAY_MAX_MS);
}

function randomShortStaggerDelayMs() {
  return randomBetweenMs(SHORT_STAGGER_DELAY_MIN_MS, SHORT_STAGGER_DELAY_MAX_MS);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * For a sequence of `pushStaggeredAssistantMessage` calls in one flow, only the first
 * should auto-scroll; later messages would snap past long preceding bubbles (e.g. walkthrough recap).
 * Returns a function to pass as `suppressChatScroll` on each stagger call (first: scroll, rest: suppress).
 */
function createLandingStaggerScrollSuppress() {
  let isFirstStaggerInSeries = true;
  return () => {
    const suppressChatScroll = !isFirstStaggerInSeries;
    isFirstStaggerInSeries = false;
    return suppressChatScroll;
  };
}

/**
 * Show the typing indicator for `ms` milliseconds, then append an assistant
 * message. Keeps `state.landingIsTyping` true during the wait so the composer
 * stays disabled.
 *
 * @param {Record<string, unknown> | null} extras
 * @param {{ suppressChatScroll?: boolean }} [scrollOpts] Pass `suppressChatScroll: true` for 2nd+ message in a staggered series (see `createLandingStaggerScrollSuppress`).
 */
async function pushStaggeredAssistantMessage(content, ms, extras = null, scrollOpts = {}) {
  const suppressChatScroll = scrollOpts.suppressChatScroll === true;
  const epoch = currentLandingEpoch();
  state.landingIsTyping = true;
  renderLandingChatMessages({ suppressChatScroll });
  showLandingTyping({ suppressChatScroll });
  await delay(ms);
  if (isLandingEpochStale(epoch)) {
    removeLandingTyping();
    return;
  }
  removeLandingTyping();
  const msg = { role: 'assistant', content };
  if (extras && typeof extras === 'object') Object.assign(msg, extras);
  state.landingMessages.push(msg);
  state.landingIsTyping = false;
  renderLandingChatMessages({ suppressChatScroll });
}

/**
 * Ask the dashboard brief-ack LLM to reflect back what the patient just said
 * before the next scripted prompt is emitted. The patient's user line is assumed
 * to already be pushed onto `state.landingMessages`; we send the history up to
 * (but not including) that line plus the line itself as `message`.
 */
async function pushReflectiveBriefAck(userText) {
  if (typeof userText !== 'string' || !userText.trim()) return;
  const epoch = currentLandingEpoch();
  state.landingIsTyping = true;
  renderLandingChatMessages();
  showLandingTyping();
  try {
    const history = landingMessagesForModel(state.landingMessages.slice(0, -1));
    const data = await sendChatMessage({
      message: userText,
      history,
      mode: 'dashboard',
      path: 'guided',
      record: state.patientRecord || {},
      briefAck: true,
      checklistContext: buildLandingChecklistContext(),
    });
    if (isLandingEpochStale(epoch)) {
      removeLandingTyping();
      return;
    }
    removeLandingTyping();
    const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
    if (reply) {
      state.landingMessages.push({ role: 'assistant', content: reply });
    }
  } catch (_err) {
    removeLandingTyping();
  } finally {
    state.landingIsTyping = false;
    renderLandingChatMessages();
  }
}

async function pushLandingGreetingMessages() {
  const staggerScrollGate = createLandingStaggerScrollSuppress();
  await pushStaggeredAssistantMessage(greetingIntro(), INITIAL_GREETING_DELAY_MS, null, {
    suppressChatScroll: staggerScrollGate(),
  });
  await pushStaggeredAssistantMessage(
    greetingTimeline(),
    randomStaggerDelayMs(),
    { journeyGraphic: true },
    { suppressChatScroll: staggerScrollGate() }
  );
}

function syncReviewTopicClearButton(input) {
  if (!input?.classList?.contains('landing-review-topic-input')) return;
  const row = input.closest('.landing-review-topic-input-row');
  const btn = row?.querySelector('.landing-review-topic-clear');
  if (!btn) return;
  btn.hidden = !input.value.trim();
}

function autoGrowReviewTopicInput(input) {
  if (!input || input.tagName !== 'TEXTAREA') return;
  input.style.height = 'auto';
  const next = input.scrollHeight;
  if (next > 0) input.style.height = `${next}px`;
}

function wireReviewTopicInputRow(input) {
  input.addEventListener('input', () => {
    syncReviewTopicClearButton(input);
    autoGrowReviewTopicInput(input);
  });
  const row = input.closest('.landing-review-topic-input-row');
  const clearBtn = row?.querySelector('.landing-review-topic-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      syncReviewTopicClearButton(input);
      autoGrowReviewTopicInput(input);
      input.focus();
    });
  }
  syncReviewTopicClearButton(input);
  autoGrowReviewTopicInput(input);
}

function getReviewTopicDraftValuesFromInputs() {
  return [0, 1, 2]
    .map((i) => document.getElementById(`landing-review-topic-${i}`)?.value?.trim() || '')
    .filter(Boolean);
}

function applySuggestionToNextEmptyField(text) {
  const slice = text.slice(0, 200);
  for (let i = 0; i < MAX_REVIEW_PRIORITY_TOPICS; i++) {
    const el = document.getElementById(`landing-review-topic-${i}`);
    if (el && !el.value.trim()) {
      el.value = slice;
      syncReviewTopicClearButton(el);
      autoGrowReviewTopicInput(el);
      el.focus();
      return;
    }
  }
  showToast(t('landing.toast.focusFull'));
}

function autofillReviewTopicFields(suggestions, { regenerate = false } = {}) {
  const fields = [0, 1, 2].map((i) => document.getElementById(`landing-review-topic-${i}`));
  const existing = fields.map((el) => (el?.value || '').trim());
  const existingLower = new Set(existing.filter(Boolean).map((v) => v.toLowerCase()));
  const cleaned = Array.isArray(suggestions)
    ? suggestions
        .filter((x) => typeof x === 'string')
        .map((x) => x.trim().slice(0, 200))
        .filter(Boolean)
    : [];

  let filled = 0;
  let focusTarget = null;
  let nextIdx = 0;

  for (const s of cleaned) {
    if (nextIdx >= MAX_REVIEW_PRIORITY_TOPICS) break;
    if (!regenerate && existingLower.has(s.toLowerCase())) continue;
    while (nextIdx < MAX_REVIEW_PRIORITY_TOPICS) {
      const el = fields[nextIdx];
      const prev = existing[nextIdx];
      const isEmpty = !prev;
      if (el && (isEmpty || regenerate)) {
        if (regenerate && prev && existingLower.has(s.toLowerCase())) {
          nextIdx++;
          continue;
        }
        el.value = s;
        syncReviewTopicClearButton(el);
        autoGrowReviewTopicInput(el);
        filled++;
        if (!focusTarget) focusTarget = el;
        existingLower.add(s.toLowerCase());
        nextIdx++;
        break;
      }
      nextIdx++;
    }
  }

  if (focusTarget) {
    requestAnimationFrame(() => {
      try {
        focusTarget.focus({ preventScroll: true });
        const len = focusTarget.value.length;
        focusTarget.setSelectionRange?.(len, len);
      } catch {
        /* ignore */
      }
    });
  }

  return filled;
}

async function handleReviewPriorityFieldsContinue() {
  const topics = getReviewTopicDraftValuesFromInputs();
  if (!topics.length) {
    showToast(t('landing.toast.addFocus'));
    return;
  }
  await completeReviewTopicsFlow(topics, false);
}

async function handleReviewPriorityNothingExplicit() {
  const last = state.landingMessages[state.landingMessages.length - 1];
  if (last?.action) delete last.action;
  await completeReviewTopicsFlow([], true);
}

async function loadReviewFocusSuggestions({ regenerate = false } = {}) {
  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (!lastMsg?.reviewPriorityFieldsForm) return;

  const wrapEl = document.getElementById('landing-review-priority-suggestions-wrap');
  const bodyEl = document.getElementById('landing-review-ai-suggestions-body');
  const suggestBtn = document.getElementById('landing-review-priority-suggest');
  const refreshBtn = document.getElementById('landing-review-suggestions-refresh');

  if (wrapEl) wrapEl.hidden = false;
  if (suggestBtn) {
    suggestBtn.disabled = true;
    suggestBtn.setAttribute('aria-busy', 'true');
  }
  if (refreshBtn) refreshBtn.disabled = true;

  if (bodyEl) {
    bodyEl.innerHTML = `<span class="landing-review-ai-suggestions-loading" role="status">${escapeHtml(t('landing.review.suggestionsLoading'))}</span>`;
  }

  const draftTopics = regenerate ? [] : getReviewTopicDraftValuesFromInputs();

  try {
    const data = await requestReviewFocusSuggestions({
      record: state.patientRecord || {},
      draftTopics,
    });
    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
    if (!suggestions.length) {
      if (bodyEl) {
        bodyEl.innerHTML = `<span class="landing-review-ai-suggestions-error">${escapeHtml(t('landing.review.suggestionsError'))}</span>`;
      }
      return;
    }

    const filled = autofillReviewTopicFields(suggestions, { regenerate });

    if (bodyEl) {
      if (filled > 0) {
        bodyEl.innerHTML = `<span class="landing-review-ai-suggestions-filled" role="status">${escapeHtml(t('landing.review.suggestionsFilledHint'))}</span>`;
      } else {
        bodyEl.innerHTML = `<span class="landing-review-ai-suggestions-placeholder">${escapeHtml(t('landing.review.suggestionsFilledFull'))}</span>`;
      }
    }
  } catch (err) {
    const msg = err?.message || t('landing.error.suggestionsLoad');
    if (bodyEl) {
      bodyEl.innerHTML = `<span class="landing-review-ai-suggestions-error">${escapeHtml(msg)}${escapeHtml(t('landing.error.suggestionsRetry'))}</span>`;
    }
  } finally {
    if (suggestBtn) {
      suggestBtn.disabled = false;
      suggestBtn.removeAttribute('aria-busy');
    }
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

function getRecordedVisitDateString() {
  const rec = state.patientRecord;
  if (rec && typeof rec === 'object' && !Array.isArray(rec)) {
    const vd = rec.visitDate;
    if (typeof vd === 'string' && vd.trim()) return vd.trim();
  }
  return null;
}

function getRecordedProviderNameString() {
  const rec = state.patientRecord;
  if (rec && typeof rec === 'object' && !Array.isArray(rec)) {
    const p = rec.provider;
    if (typeof p === 'string' && p.trim()) return p.trim();
  }
  return null;
}

/** Fixed assistant lead before the LLM visit walkthrough (Phase 1). */
function buildVisitWalkthroughLeadMarkdown() {
  const vd = getRecordedVisitDateString();
  const provider = getRecordedProviderNameString();
  if (vd && provider) {
    return t('landing.walkthrough.leadBoth', { vd, provider });
  }
  if (vd) {
    return t('landing.walkthrough.leadDate', { vd });
  }
  if (provider) {
    return t('landing.walkthrough.leadProvider', { provider });
  }
  return t('landing.walkthrough.leadFallback');
}

async function appendReviewPriorityFieldsAfterWalkthrough(scrollOpts = {}) {
  state.landingAwaitingLastVisitQuestions = true;
  state.landingLastVisitQsStep = 'initial';
  state.landingAwaitingWalkthroughContinue = false;
  state.landingAwaitingPostWalkthroughFeedback = false;
  state.landingStudyFeedbackReason = null;
  await pushStaggeredAssistantMessage(
    composeMessageWithInstruction(
      t('landing.lastVisitQs.prompt'),
      t('landing.lastVisitQs.promptInstruction')
    ),
    randomShortStaggerDelayMs(),
    {
      lastVisitQuestionsForm: true,
      action: {
        label: t('landing.lastVisitQs.noQuestions'),
        handler: () => {
          void handleNoLastVisitQuestions();
        },
      },
    },
    scrollOpts
  );
  void saveLandingSession();
}

async function appendPrepareNextVisitFocusFields() {
  state.landingAwaitingLastVisitQuestions = false;
  state.landingLastVisitQsStep = null;
  state.landingAwaitingReviewTopics = true;
  state.landingReviewPriorityPhase = 'fields';
  state.landingPriorityTopics = [];
  await pushStaggeredAssistantMessage(
    reviewPriorityFieldsPrompt(),
    randomShortStaggerDelayMs(),
    { reviewPriorityFieldsForm: true }
  );
  void saveLandingSession();
}

async function animateJourneyAdvanceToPrepareNext() {
  if (state.journeyPhase < 2) {
    state.journeyPhase = 2;
    renderJourneyStepper();
    const stepper = document.getElementById('journey-stepper');
    const newActive = stepper?.querySelector('.journey-step--active');
    if (newActive) {
      newActive.classList.add('journey-step--just-activated');
      setTimeout(() => {
        newActive.classList.remove('journey-step--just-activated');
      }, 900);
    }
    await delay(650);
  }
}

async function handleNoLastVisitQuestions() {
  if (!state.landingAwaitingLastVisitQuestions) return;
  const last = state.landingMessages[state.landingMessages.length - 1];
  if (last) {
    delete last.action;
    delete last.lastVisitQuestionsForm;
  }
  state.landingMessages.push({
    role: 'user',
    content: t('landing.userLine.noLastVisitQs'),
  });
  renderLandingChatMessages();
  await animateJourneyAdvanceToPrepareNext();
  await appendPrepareNextVisitFocusFields();
}

async function handleReadyForNextVisitFromQs() {
  if (!state.landingAwaitingLastVisitQuestions) return;
  state.landingMessages.forEach((m) => {
    if (m.role === 'assistant' && m.lastVisitQuestionsForm) {
      delete m.action;
      delete m.secondaryAction;
      delete m.lastVisitQuestionsForm;
    }
  });
  state.landingMessages.push({
    role: 'user',
    content: t('landing.userLine.readyForNextVisit'),
  });
  renderLandingChatMessages();
  await animateJourneyAdvanceToPrepareNext();
  await appendPrepareNextVisitFocusFields();
}

function handleMoreLastVisitQuestions() {
  if (!state.landingAwaitingLastVisitQuestions) return;
  const last = state.landingMessages[state.landingMessages.length - 1];
  if (last) {
    delete last.action;
    delete last.secondaryAction;
    delete last.lastVisitQuestionsForm;
  }
  state.landingLastVisitQsStep = 'initial';
  state.landingMessages.push({
    role: 'user',
    content: t('landing.userLine.moreLastVisitQs'),
  });
  renderLandingChatMessages();
  const input = document.getElementById('landing-chat-input');
  if (input) {
    input.focus();
  }
  void saveLandingSession();
}

async function appendMoreOrReadyPrompt() {
  state.landingLastVisitQsStep = 'more-or-ready';
  await pushStaggeredAssistantMessage(
    t('landing.lastVisitQs.moreOrReady'),
    randomShortStaggerDelayMs(),
    {
      lastVisitQuestionsForm: true,
      action: {
        label: t('landing.lastVisitQs.readyForNext'),
        handler: () => {
          void handleReadyForNextVisitFromQs();
        },
      },
      secondaryAction: {
        label: t('landing.lastVisitQs.moreQuestions'),
        handler: () => {
          handleMoreLastVisitQuestions();
        },
      },
    }
  );
  void saveLandingSession();
}

function handleWalkthroughContinueToFeedback() {
  if (!state.landingAwaitingWalkthroughContinue) return;

  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (lastMsg?.role === 'assistant' && lastMsg.action) {
    delete lastMsg.action;
    delete lastMsg.walkthroughContinueAction;
  }

  state.landingAwaitingWalkthroughContinue = false;
  state.landingMessages.push({ role: 'user', content: t('chip.continue') });
  state.landingAwaitingPostWalkthroughFeedback = true;
  state.landingStudyFeedbackReason = 'after-walkthrough';
  state.landingFeedbackSummaryMarkdown = getWalkthroughRecapMarkdown() || getApprovedProviderNoteMarkdown();
  renderLandingChatMessages();
  void saveLandingSession();

  setTimeout(() => {
    if (onOpenStudyModal) onOpenStudyModal();
  }, 400);
}

async function runVisitWalkthrough() {
  const epoch = currentLandingEpoch();
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  const lead = buildVisitWalkthroughLeadMarkdown();
  const userRequest = t('landing.walkthrough.userRequest');

  try {
    const staggerScrollGate = createLandingStaggerScrollSuppress();
    await pushStaggeredAssistantMessage(lead, randomStaggerDelayMs(), null, {
      suppressChatScroll: staggerScrollGate(),
    });
    if (isLandingEpochStale(epoch)) return;

    state.landingIsTyping = true;
    renderLandingChatMessages();
    showLandingTyping();

    // Same text is sent to the API as the user turn only — do not append a fake bubble to the thread.
    const history = landingMessagesForModel(state.landingMessages);
    const data = await sendChatMessage({
      message: userRequest,
      history,
      mode: 'dashboard',
      path: 'guided',
      record: state.patientRecord || {},
      checklistContext: buildLandingChecklistContext(),
    });
    if (isLandingEpochStale(epoch)) {
      removeLandingTyping();
      return;
    }
    removeLandingTyping();
    const recap =
      typeof data?.reply === 'string'
        ? stripTrailingVisitRecapEngagementQuestion(data.reply)
        : '';
    state.landingMessages.push({ role: 'assistant', content: recap || data.reply || '' });
    state.landingIsTyping = false;
    renderLandingChatMessages();

    await pushStaggeredAssistantMessage(
      walkthroughContinuePrompt(),
      randomShortStaggerDelayMs(),
      {
        walkthroughContinueStep: true,
        walkthroughContinueAction: true,
        action: {
          label: t('chip.continue'),
          handler: handleWalkthroughContinueToFeedback,
        },
      },
      { suppressChatScroll: staggerScrollGate() }
    );
    if (isLandingEpochStale(epoch)) return;
    state.landingAwaitingWalkthroughContinue = true;
    renderLandingChatMessages();
  } catch (err) {
    if (isLandingEpochStale(epoch)) {
      removeLandingTyping();
      return;
    }
    removeLandingTyping();
    state.landingIsTyping = false;
    const errStaggerGate = createLandingStaggerScrollSuppress();
    await pushStaggeredAssistantMessage(
      err.message || t('landing.walkthrough.error'),
      randomShortStaggerDelayMs(),
      null,
      { suppressChatScroll: errStaggerGate() }
    );
    if (isLandingEpochStale(epoch)) return;
    await appendReviewPriorityFieldsAfterWalkthrough({ suppressChatScroll: errStaggerGate() });
  } finally {
    if (!isLandingEpochStale(epoch)) {
      state.landingIsTyping = false;
      if (sendBtn) sendBtn.disabled = !input?.value.trim();
    }
  }

  if (isLandingEpochStale(epoch)) return;
  await saveLandingSession();
}

function buildSinceVisitRecapLeadMarkdown() {
  const vd = getRecordedVisitDateString();
  if (vd) return t('landing.sinceVisitRecap.lead', { vd });
  return t('landing.sinceVisitRecap.leadGeneric');
}

async function runSinceVisitRecap() {
  const epoch = currentLandingEpoch();
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  const lead = buildSinceVisitRecapLeadMarkdown();
  const userRequest = t('landing.sinceVisitRecap.userRequest');

  try {
    const staggerScrollGate = createLandingStaggerScrollSuppress();
    await pushStaggeredAssistantMessage(lead, randomStaggerDelayMs(), null, {
      suppressChatScroll: staggerScrollGate(),
    });
    if (isLandingEpochStale(epoch)) return;

    state.landingIsTyping = true;
    renderLandingChatMessages();
    showLandingTyping();

    const data = await requestSinceVisitRecap({
      record: state.patientRecord || {},
      message: userRequest,
    });
    if (isLandingEpochStale(epoch)) {
      removeLandingTyping();
      return;
    }
    removeLandingTyping();
    const recap = typeof data?.reply === 'string' ? data.reply.trim() : '';
    state.landingMessages.push({ role: 'assistant', content: recap || data.reply || '' });
    state.landingIsTyping = false;
    renderLandingChatMessages();
  } catch (err) {
    if (isLandingEpochStale(epoch)) {
      removeLandingTyping();
      return;
    }
    removeLandingTyping();
    state.landingIsTyping = false;
    const errStaggerGate = createLandingStaggerScrollSuppress();
    await pushStaggeredAssistantMessage(
      err.message || t('landing.sinceVisitRecap.error'),
      randomShortStaggerDelayMs(),
      null,
      { suppressChatScroll: errStaggerGate() }
    );
  } finally {
    if (!isLandingEpochStale(epoch)) {
      state.landingIsTyping = false;
      if (sendBtn) sendBtn.disabled = !input?.value.trim();
    }
  }

  if (isLandingEpochStale(epoch)) return;
  await saveLandingSession();
}

function buildSinceVisitChecklistLeadMarkdown() {
  return `**${t('landing.sinceVisit.narrativeLabel')}**`;
}

async function completeReviewTopicsFlow(topics, nothingExplicit) {
  if (!state.landingAwaitingReviewTopics) return;

  state.landingMessages.forEach((m) => {
    delete m.reviewTopicsForm;
    if (m.reviewPriorityConfirmation) {
      delete m.reviewPriorityConfirmation;
      delete m.priorityTopicsSnapshot;
    }
    if (m.reviewPriorityOpenPrompt) {
      delete m.reviewPriorityOpenPrompt;
      delete m.action;
    }
    if (m.reviewPriorityFieldsForm) {
      delete m.reviewPriorityFieldsForm;
      delete m.action;
    }
  });
  state.landingAwaitingReviewTopics = false;
  state.landingReviewPriorityPhase = null;
  state.landingPriorityTopics = [];

  const hasTopics = topics.length > 0;
  const list = hasTopics ? topics.map((topic, i) => `${i + 1}. ${topic}`).join('\n') : '';
  const userLine = nothingExplicit
    ? t('landing.userLine.nothingTopics')
    : hasTopics
      ? t('landing.userLine.focusTopics', { list })
      : t('landing.userLine.readyNoTopics');

  state.landingMessages.push({ role: 'user', content: userLine });
  renderLandingChatMessages();
  const staggerScrollGate = createLandingStaggerScrollSuppress();
  await pushStaggeredAssistantMessage(
    hasTopics ? t('landing.assistant.thanksTopics') : t('landing.assistant.noTopics'),
    randomShortStaggerDelayMs(),
    null,
    { suppressChatScroll: staggerScrollGate() }
  );
  state.landingAwaitingSinceVisitChecklist = true;
  await pushStaggeredAssistantMessage(
    buildSinceVisitChecklistLeadMarkdown(),
    randomShortStaggerDelayMs(),
    { sinceVisitChecklistForm: true },
    { suppressChatScroll: staggerScrollGate() }
  );
  await saveLandingSession();
}

function formatSinceVisitChecklistEntry(entry) {
  const detail = entry.detail?.trim();
  if (detail) return `${entry.label} — ${detail}`;
  return entry.label;
}

function syncSinceVisitNarrativeFromDom() {
  const narEl = document.getElementById('landing-since-visit-narrative');
  if (narEl) state.landingSinceVisitNarrative = narEl.value;
}

async function finishSinceVisitChecklist(selectedEntries) {
  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (!lastMsg || !lastMsg.sinceVisitChecklistForm) return;

  syncSinceVisitNarrativeFromDom();
  const narrative = (typeof state.landingSinceVisitNarrative === 'string' ? state.landingSinceVisitNarrative : '').trim();

  delete lastMsg.sinceVisitChecklistForm;
  state.landingAwaitingSinceVisitChecklist = false;

  const hasAny = selectedEntries.length > 0;
  const list = selectedEntries.map(formatSinceVisitChecklistEntry).join('; ');
  const checklistPart = hasAny
    ? t('landing.userLine.sinceVisitChecked', { list })
    : t('landing.userLine.sinceVisitNone');
  const userLine = narrative
    ? `${t('landing.userLine.sinceVisitNarrativeLine', { narrative })}\n\n${checklistPart}`
    : checklistPart;

  const fullEntries = serializeLandingChecklistEntries(
    sinceVisitChecklistItems(),
    state.landingSinceVisitDetails,
    { includeUnchecked: true }
  );
  state.landingSinceVisitNarrative = '';
  state.landingMessages.push({
    role: 'user',
    content: userLine,
    sinceVisitEntries: fullEntries,
    ...(narrative ? { sinceVisitNarrative: narrative } : {}),
  });
  renderLandingChatMessages();
  const staggerScrollGate = createLandingStaggerScrollSuppress();

  const epoch = currentLandingEpoch();
  const hasContentToAck = hasAny || !!narrative;

  if (!hasContentToAck) {
    await pushStaggeredAssistantMessage(
      t('landing.assistant.gotCheckin'),
      randomShortStaggerDelayMs(),
      null,
      { suppressChatScroll: staggerScrollGate() }
    );
    await appendSinceVisitConcernsPrompt({ suppressChatScroll: staggerScrollGate() });
    await saveLandingSession();
    return;
  }

  state.landingIsTyping = true;
  renderLandingChatMessages();
  showLandingTyping();

  let ackReply = '';
  try {
    const history = landingMessagesForModel(state.landingMessages.slice(0, -1));
    const data = await sendChatMessage({
      message: userLine,
      history,
      mode: 'dashboard',
      path: 'guided',
      record: state.patientRecord || {},
      briefAck: true,
      checklistContext: buildLandingChecklistContext(),
    });
    if (isLandingEpochStale(epoch)) {
      removeLandingTyping();
      state.landingIsTyping = false;
      return;
    }
    ackReply = typeof data?.reply === 'string' ? data.reply.trim() : '';
  } catch (err) {
    if (isLandingEpochStale(epoch)) {
      removeLandingTyping();
      state.landingIsTyping = false;
      return;
    }
  }

  removeLandingTyping();
  state.landingIsTyping = false;

  if (ackReply) {
    state.landingMessages.push({ role: 'assistant', content: ackReply });
    renderLandingChatMessages();
  } else {
    await pushStaggeredAssistantMessage(
      t('landing.assistant.thanksCheckin'),
      randomShortStaggerDelayMs(),
      null,
      { suppressChatScroll: staggerScrollGate() }
    );
  }

  await appendSinceVisitConcernsPrompt({ suppressChatScroll: staggerScrollGate() });
  await saveLandingSession();
}

function syncLandingSinceVisitFollowUpFromMessages() {
  let step = null;
  for (let i = state.landingMessages.length - 1; i >= 0; i--) {
    const m = state.landingMessages[i];
    if (m.sinceVisitFollowUpStep) {
      step = m.sinceVisitFollowUpStep;
      break;
    }
  }
  state.landingSinceVisitFollowUp = step;
}

function clearSinceVisitFollowUpMetaFromMessages() {
  state.landingMessages.forEach((m) => {
    if (m.role === 'assistant') {
      delete m.sinceVisitFollowUpStep;
      delete m.action;
      delete m.secondaryAction;
      delete m.chips;
      delete m.concernsChecklistForm;
      delete m.visitGoalsChecklistForm;
      delete m.providerQuestionsSmsOffer;
      delete m.providerQuestionsSmsBody;
      delete m.providerQuestionsItems;
      delete m.providerQuestionsChecked;
    }
  });
}

function clearHandoffSummaryFromMessages() {
  state.landingMessages.forEach((m) => {
    if (m.role === 'assistant') {
      delete m.handoffSummaryReviewForm;
      delete m.handoffSummaryDraft;
      delete m.handoffSummaryDraftHtml;
      delete m.handoffSummaryIsEditing;
    }
  });
}

function stripSinceVisitFollowUpPromptForStep(step) {
  for (let i = state.landingMessages.length - 1; i >= 0; i--) {
    const m = state.landingMessages[i];
    if (m.role === 'assistant' && m.sinceVisitFollowUpStep === step) {
      delete m.sinceVisitFollowUpStep;
      delete m.action;
      delete m.secondaryAction;
      delete m.chips;
      delete m.concernsChecklistForm;
      delete m.visitGoalsChecklistForm;
      delete m.providerQuestionsSmsOffer;
      delete m.providerQuestionsSmsBody;
      delete m.providerQuestionsItems;
      delete m.providerQuestionsChecked;
      return;
    }
  }
}

/** First follow-up after the since-last-visit checklist: going-well prompt, then provider questions. */
async function appendSinceVisitConcernsPrompt(scrollOpts = {}) {
  state.landingSinceVisitFollowUp = 'concerns';
  await pushStaggeredAssistantMessage(
    t('landing.goingWell.lead'),
    randomShortStaggerDelayMs(),
    {
      sinceVisitFollowUpStep: 'concerns',
      secondaryAction: {
        label: t('landing.goingWell.nothingToAdd'),
        handler: () => {
          void submitSinceVisitFollowUpStep(t('landing.userLine.goingWellNone'), 'concerns');
        },
      },
    },
    scrollOpts
  );
}

async function appendPreSummaryPrompt() {
  state.landingSinceVisitFollowUp = 'pre-summary';
  state.landingAwaitingVisitGoalsChecklist = true;
  await pushStaggeredAssistantMessage(
    visitGoalsPromptLead(),
    randomShortStaggerDelayMs(),
    { sinceVisitFollowUpStep: 'pre-summary', visitGoalsChecklistForm: true }
  );
}

async function appendProviderQuestionsOffer() {
  state.landingSinceVisitFollowUp = 'provider-questions';
  await pushStaggeredAssistantMessage(
    providerQuestionsOffer(),
    randomShortStaggerDelayMs(),
    { sinceVisitFollowUpStep: 'provider-questions', chips: ['yes', 'no'] }
  );
}

async function runProviderQuestionsGenerationFlow() {
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (sendBtn) sendBtn.disabled = true;
  state.landingIsTyping = true;
  renderLandingChatMessages();
  showLandingTyping();
  try {
    const msgs = landingMessagesForModel(state.landingMessages);
    const data = await requestProviderQuestionSuggestions({
      messages: msgs,
      record: state.patientRecord || {},
    });
    removeLandingTyping();
    const questions = Array.isArray(data?.questions) ? data.questions : [];
      if (!questions.length) {
      throw new Error(t('landing.error.noQuestions'));
    }
    const md = buildProviderQuestionsMarkdown(questions);
    state.landingMessages.push({
      role: 'assistant',
      content: md,
      sinceVisitFollowUpStep: 'provider-questions-suggestions',
      providerQuestionsSmsOffer: true,
      providerQuestionsItems: questions,
      providerQuestionsChecked: questions.map(() => true),
    });
    state.landingSinceVisitFollowUp = 'provider-questions-suggestions';
    state.landingAwaitingProviderQuestionContinue = true;
    state.landingIsTyping = false;
    renderLandingChatMessages();
  } catch (err) {
    removeLandingTyping();
    state.landingIsTyping = false;
    await pushStaggeredAssistantMessage(
      err?.message || t('landing.pq.errorQuestions'),
      randomShortStaggerDelayMs()
    );
    await appendPreSummaryPrompt();
  } finally {
    state.landingIsTyping = false;
    if (sendBtn) sendBtn.disabled = !input?.value.trim();
  }
  await saveLandingSession();
}

async function addOwnProviderQuestion(msgIdx) {
  const msg = state.landingMessages[msgIdx];
  if (!msg?.providerQuestionsSmsOffer) return;
  const inputEl = document.getElementById(`landing-pq-add-own-input-${msgIdx}`);
  const raw = (inputEl?.value || '').trim();
  if (!raw) {
    showToast(t('landing.pq.toastNeedOwnQuestion'));
    inputEl?.focus();
    return;
  }
  const text = raw.slice(0, 220);
  if (!Array.isArray(msg.providerQuestionsItems)) msg.providerQuestionsItems = [];
  if (!Array.isArray(msg.providerQuestionsChecked)) {
    msg.providerQuestionsChecked = msg.providerQuestionsItems.map(() => true);
  }
  msg.providerQuestionsItems.push(text);
  msg.providerQuestionsChecked.push(true);
  msg.content = buildProviderQuestionsMarkdown(msg.providerQuestionsItems);
  if (inputEl) inputEl.value = '';
  renderLandingChatMessages();
  await saveLandingSession();
}

async function handleContinueToVisitGoalsFromSuggestions() {
  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (!lastMsg?.providerQuestionsSmsOffer) return;
  stripSinceVisitFollowUpPromptForStep('provider-questions-suggestions');
  state.landingAwaitingProviderQuestionContinue = false;
  state.landingSinceVisitFollowUp = null;
  state.landingMessages.push({ role: 'user', content: t('landing.pq.continueGoals') });
  renderLandingChatMessages();
  await appendPreSummaryPrompt();
  await saveLandingSession();
}

async function handleProviderQuestionsChipChoice(value) {
  if (state.landingSinceVisitFollowUp !== 'provider-questions') return;
  const isYes = value === 'yes';
  if (!isYes && value !== 'no') return;

  stripSinceVisitFollowUpPromptForStep('provider-questions');
  state.landingSinceVisitFollowUp = null;

  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');

  if (isYes) {
    state.landingMessages.push({ role: 'user', content: t('common.yes') });
    renderLandingChatMessages();
    await runProviderQuestionsGenerationFlow();
    return;
  }

  state.landingMessages.push({ role: 'user', content: t('landing.userLine.noThanks') });
  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }
  if (sendBtn) sendBtn.disabled = !input?.value.trim();
  renderLandingChatMessages();
  await appendPreSummaryPrompt();
  await saveLandingSession();
}

async function handlePreHandoffConfirm() {
  if (state.landingSinceVisitFollowUp !== 'pre-handoff-confirm') return;
  stripSinceVisitFollowUpPromptForStep('pre-handoff-confirm');
  state.landingMessages.push({
    role: 'user',
    content: t('landing.userLine.readySummary'),
  });
  state.landingSinceVisitFollowUp = null;
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  await runHandoffSummaryGeneration();
  if (sendBtn) sendBtn.disabled = !input?.value.trim();
}

/** After a user line is appended: brief reflective LLM ack, then next follow-up step or handoff generation. */
async function afterSinceVisitFollowUpUserMessage(step, userText, input, sendBtn) {
  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }
  if (sendBtn) sendBtn.disabled = true;

  state.landingIsTyping = true;
  renderLandingChatMessages();

  const history = landingMessagesForModel(state.landingMessages.slice(0, -1));
  showLandingTyping();

  try {
    const data = await sendChatMessage({
      message: userText,
      history,
      mode: 'dashboard',
      path: 'guided',
      record: state.patientRecord || {},
      briefAck: true,
      checklistContext: buildLandingChecklistContext(),
    });
    removeLandingTyping();
    state.landingMessages.push({ role: 'assistant', content: data.reply });
    state.landingIsTyping = false;
    renderLandingChatMessages();

    if (step === 'anything-else') {
      await appendSinceVisitConcernsPrompt();
    } else if (step === 'concerns') {
      await appendProviderQuestionsOffer();
    } else if (step === 'pre-summary') {
      await pushStaggeredAssistantMessage(
        handoffReadyPrompt(),
        randomShortStaggerDelayMs(),
        {
          sinceVisitFollowUpStep: 'pre-handoff-confirm',
          action: {
            label: t('landing.handoff.actionYesGo'),
            handler: () => {
              void handlePreHandoffConfirm();
            },
          },
        }
      );
      state.landingSinceVisitFollowUp = 'pre-handoff-confirm';
    } else {
      state.landingSinceVisitFollowUp = null;
    }
  } catch (err) {
    removeLandingTyping();
    state.landingMessages.push({
      role: 'assistant',
      content: err.message || t('errors.serverRetry'),
    });
    state.landingSinceVisitFollowUp = null;
  } finally {
    state.landingIsTyping = false;
    if (sendBtn) sendBtn.disabled = !input?.value.trim();
  }

  renderLandingChatMessages();
  await saveLandingSession();
}

async function submitSinceVisitFollowUpStep(text, step) {
  if (state.landingSinceVisitFollowUp !== step) return;
  if (step === 'pre-handoff-confirm' || step === 'provider-questions' || step === 'provider-questions-suggestions') {
    return;
  }
  if (step === 'pre-summary' && state.landingAwaitingVisitGoalsChecklist) return;

  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');

  let displayContent = text;
  if (step === 'concerns') {
    const noneLine = t('landing.userLine.goingWellNone');
    const trimmed = text.trim();
    state.landingGoingWellReply = trimmed === noneLine ? '' : trimmed;
    displayContent = state.landingGoingWellReply
      ? t('landing.userLine.goingWellReply', { detail: state.landingGoingWellReply })
      : t('landing.userLine.goingWellNone');
  }

  stripSinceVisitFollowUpPromptForStep(step);
  const userMsg = { role: 'user', content: displayContent };
  if (step === 'concerns' && state.landingGoingWellReply) {
    userMsg.goingWellNote = state.landingGoingWellReply;
  }
  state.landingMessages.push(userMsg);
  state.landingSinceVisitFollowUp = null;

  await afterSinceVisitFollowUpUserMessage(step, displayContent, input, sendBtn);
}

async function finishVisitGoalsChecklist(selectedLabels, optionalNote) {
  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (!lastMsg?.visitGoalsChecklistForm) return;

  delete lastMsg.visitGoalsChecklistForm;
  delete lastMsg.sinceVisitFollowUpStep;
  state.landingAwaitingVisitGoalsChecklist = false;

  const labels = Array.isArray(selectedLabels) ? selectedLabels.filter(Boolean) : [];
  const note = typeof optionalNote === 'string' ? optionalNote.trim() : '';

  let userLine;
  if (!labels.length && !note) {
    userLine = t('landing.userLine.visitGoalsNone');
  } else {
    const parts = [];
    if (labels.length) {
      parts.push(t('landing.userLine.visitGoalsHopingPart', { labels: labels.join('; ') }));
    }
    if (note) {
      parts.push(t('landing.userLine.visitGoalsNotePart', { note }));
    }
    userLine = t('landing.userLine.visitGoalsPrefix', { rest: parts.join(' ') });
  }

  const fullEntries = serializeLandingChecklistEntries(
    visitGoalsChecklistItems(),
    state.landingVisitGoalsDetails,
    { includeUnchecked: false, includeDetail: false }
  );
  state.landingMessages.push({
    role: 'user',
    content: userLine,
    visitGoalsEntries: fullEntries,
    visitGoalsNote: note,
  });
  state.landingSinceVisitFollowUp = null;

  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  await afterSinceVisitFollowUpUserMessage('pre-summary', userLine, input, sendBtn);
}

async function handleVisitGoalsContinue() {
  const selected = visitGoalsChecklistItems().filter((item) =>
    document.getElementById(`landing-visit-goals-${item.id}`)?.checked
  ).map((item) => item.label);
  const optional = document.getElementById('landing-visit-goals-notes')?.value?.trim() || '';
  if (!selected.length && !optional) {
    showToast(t('landing.toast.visitGoalsPick'));
    return;
  }
  await finishVisitGoalsChecklist(selected, optional);
}

async function handleVisitGoalsNothingToAdd() {
  visitGoalsChecklistItems().forEach((item) => {
    const el = document.getElementById(`landing-visit-goals-${item.id}`);
    if (el) el.checked = false;
  });
  const ta = document.getElementById('landing-visit-goals-notes');
  if (ta) ta.value = '';
  state.landingVisitGoalsDetails = {};
  state.landingVisitGoalsNote = '';
  await finishVisitGoalsChecklist([], '');
}

function findLastAssistantHandoffReviewIndex() {
  for (let i = state.landingMessages.length - 1; i >= 0; i--) {
    const m = state.landingMessages[i];
    if (m.role === 'assistant' && m.handoffSummaryReviewForm) return i;
  }
  return -1;
}

async function submitHandoffSummaryRevision(text, input, sendBtn) {
  const idx = findLastAssistantHandoffReviewIndex();
  if (idx < 0) return;
  const reviewMsg = state.landingMessages[idx];
  let currentDraft = '';
  if (typeof reviewMsg.handoffSummaryDraftHtml === 'string' && reviewMsg.handoffSummaryDraftHtml) {
    const tmp = document.createElement('div');
    tmp.innerHTML = reviewMsg.handoffSummaryDraftHtml;
    acceptAllChanges(tmp);
    currentDraft = flattenAcceptedText(tmp);
  } else {
    currentDraft = typeof reviewMsg.handoffSummaryDraft === 'string' ? reviewMsg.handoffSummaryDraft.trim() : '';
  }
  if (!currentDraft) return;

  state.landingMessages.push({ role: 'user', content: text });
  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }
  if (sendBtn) sendBtn.disabled = true;
  state.landingIsTyping = true;
  renderLandingChatMessages();
  showLandingTyping();

  const msgsForApi = landingMessagesForModel(state.landingMessages);

  try {
    const data = await requestHandoffSummaryRevise({
      currentSummary: currentDraft,
      patientRequest: text,
      messages: msgsForApi,
      checklistContext: buildLandingChecklistContext(),
    });
    removeLandingTyping();
    const revised = typeof data?.summary === 'string' ? data.summary.trim() : '';
    if (!revised) {
      throw new Error(t('landing.error.noRevise'));
    }

    delete reviewMsg.handoffSummaryReviewForm;
    delete reviewMsg.handoffSummaryDraft;
    delete reviewMsg.handoffSummaryDraftHtml;
    delete reviewMsg.handoffSummaryIsEditing;

    state.landingMessages.push({
      role: 'assistant',
      content: handoffReviewAfterRevise(),
      handoffSummaryReviewForm: true,
      handoffSummaryDraft: revised,
    });
    state.landingAwaitingHandoffSummaryReview = true;
  } catch (err) {
    removeLandingTyping();
    state.landingMessages.pop();
    showToast(err?.message || t('landing.error.handoffRevise'));
  } finally {
    state.landingIsTyping = false;
    if (sendBtn) sendBtn.disabled = !input?.value.trim();
  }
  renderLandingChatMessages();
  await saveLandingSession();
}

async function runHandoffSummaryGeneration() {
  removeLandingTyping();
  state.landingIsTyping = true;
  renderLandingChatMessages();
  showLandingTyping();
  try {
    const msgs = landingMessagesForModel(state.landingMessages);
    const data = await requestHandoffSummary({
      messages: msgs,
      checklistContext: buildLandingChecklistContext(),
    });
    removeLandingTyping();
    const summary = typeof data?.summary === 'string' ? data.summary.trim() : '';
    if (!summary) {
      throw new Error(t('landing.error.noSummary'));
    }
    state.landingMessages.push({
      role: 'assistant',
      content: handoffReviewIntro(),
      handoffSummaryReviewForm: true,
      handoffSummaryDraft: summary,
    });
    state.landingAwaitingHandoffSummaryReview = true;
  } catch (err) {
    removeLandingTyping();
    state.landingMessages.push({
      role: 'assistant',
      content: err?.message || t('landing.error.handoffGen'),
    });
    state.landingAwaitingHandoffSummaryReview = false;
  } finally {
    state.landingIsTyping = false;
  }
  renderLandingChatMessages();
  await saveLandingSession();
}

async function handleHandoffSummaryApprove() {
  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (!lastMsg?.handoffSummaryReviewForm) return;
  const editor = document.getElementById('landing-handoff-summary-body');

  const hasPendingHtml = htmlContainsTrackedChanges(lastMsg.handoffSummaryDraftHtml);
  const hasPendingLive = !!(editor && lastMsg.handoffSummaryIsEditing && hasTrackedChanges(editor));
  if (hasPendingHtml || hasPendingLive) {
    let flat = '';
    if (editor && (lastMsg.handoffSummaryIsEditing || lastMsg.handoffSummaryDraftHtml)) {
      acceptAllChanges(editor);
      flat = flattenAcceptedText(editor);
    } else if (typeof lastMsg.handoffSummaryDraftHtml === 'string' && lastMsg.handoffSummaryDraftHtml) {
      const tmp = document.createElement('div');
      tmp.innerHTML = lastMsg.handoffSummaryDraftHtml;
      acceptAllChanges(tmp);
      flat = flattenAcceptedText(tmp);
    } else {
      flat = typeof lastMsg.handoffSummaryDraft === 'string' ? lastMsg.handoffSummaryDraft : '';
    }
    lastMsg.handoffSummaryDraft = flat;
    delete lastMsg.handoffSummaryDraftHtml;
    delete lastMsg.handoffSummaryIsEditing;
    renderLandingChatMessages();
    await saveLandingSession();
    return;
  }

  const draft = typeof lastMsg.handoffSummaryDraft === 'string' ? lastMsg.handoffSummaryDraft.trim() : '';
  delete lastMsg.handoffSummaryReviewForm;
  delete lastMsg.handoffSummaryDraft;
  delete lastMsg.handoffSummaryDraftHtml;
  delete lastMsg.handoffSummaryIsEditing;
  state.landingAwaitingHandoffSummaryReview = false;

  state.landingMessages.push({
    role: 'user',
    content: handoffApproveUserLine(),
  });
  renderLandingChatMessages();

  const staggerScrollGate = createLandingStaggerScrollSuppress();
  await pushStaggeredAssistantMessage(
    t('landing.handoff.approvedAck'),
    randomShortStaggerDelayMs(),
    {
      approvedSummaryDoc: true,
      approvedSummaryDocText: draft,
    },
    { suppressChatScroll: staggerScrollGate() }
  );
  await pushStaggeredAssistantMessage(
    t('landing.handoff.privacyReminder'),
    randomShortStaggerDelayMs(),
    null,
    { suppressChatScroll: staggerScrollGate() }
  );
  await pushStaggeredAssistantMessage(
    handoffSharePrompt(),
    randomShortStaggerDelayMs(),
    {
      handoffSharePrompt: true,
      handoffSummaryDraft: draft,
    },
    { suppressChatScroll: staggerScrollGate() }
  );
  state.landingAwaitingHandoffShareChoice = true;
  renderLandingChatMessages();
  await saveLandingSession();
}

async function handleHandoffShareChoice(selections) {
  if (!state.landingAwaitingHandoffShareChoice) return;
  if (!Array.isArray(selections) || !selections.length) {
    showToast(t('landing.toast.handoffShare'));
    return;
  }

  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  const draft = typeof lastMsg?.handoffSummaryDraft === 'string'
    ? lastMsg.handoffSummaryDraft.trim()
    : getApprovedProviderNoteMarkdown();
  if (lastMsg?.handoffSharePrompt) {
    delete lastMsg.handoffSharePrompt;
    delete lastMsg.handoffSummaryDraft;
  }

  state.landingAwaitingHandoffShareChoice = false;
  state.landingAwaitingPostWalkthroughFeedback = true;
  state.landingStudyFeedbackReason = 'after-handoff-share';
  state.landingFeedbackSummaryMarkdown = draft;
  const selectedLabels = selections
    .map((item) => (item.id === 'other' && item.contact ? `${item.label} (${item.contact})` : item.label))
    .join(', ');
  const shareUserLine = t('landing.handoff.shareUserLine').replace('{recipient}', selectedLabels);
  state.landingMessages.push({
    role: 'user',
    content: shareUserLine,
  });
  renderLandingChatMessages();

  const summaryShareIntent = {
    provider: { selected: false, contact: '' },
    self: { selected: false, contact: '' },
    caretaker: { selected: false, contact: '' },
    other: { selected: false, contact: '' },
  };
  selections.forEach((item) => {
    if (summaryShareIntent[item.id]) {
      summaryShareIntent[item.id] = { selected: true, contact: item.contact };
    }
  });
  submitFeedback({
    type: 'summary_share_intent',
    sessionId: state.landingSessionId || null,
    chatMode: 'prepare',
    summaryShareIntent,
  }).catch(() => {});

  await pushReflectiveBriefAck(shareUserLine);
  await pushStaggeredAssistantMessage(handoffFeedbackIntro(), randomShortStaggerDelayMs(), {
    endConversationCta: true,
  });
  state.landingEndConversationCtaVisible = true;
  updateEndConversationCta();
  await saveLandingSession();
  setTimeout(() => {
    if (onOpenStudyModal) onOpenStudyModal();
  }, 600);
}

async function handleSinceVisitChecklistSubmit() {
  const selected = sinceVisitChecklistItems().filter((item) =>
    document.getElementById(`landing-since-visit-${item.id}`)?.checked
  ).map((item) => ({
    label: item.label,
    detail: document.getElementById(`landing-since-visit-detail-${item.id}`)?.value?.trim() || '',
  }));
  await finishSinceVisitChecklist(selected);
}

async function handleSinceVisitChecklistNone() {
  syncSinceVisitNarrativeFromDom();
  sinceVisitChecklistItems().forEach((item) => {
    const el = document.getElementById(`landing-since-visit-${item.id}`);
    if (el) el.checked = false;
    const detail = document.getElementById(`landing-since-visit-detail-${item.id}`);
    if (detail) detail.value = '';
    const detailWrap = document.getElementById(`landing-since-visit-detail-wrap-${item.id}`);
    if (detailWrap) detailWrap.hidden = true;
  });
  state.landingSinceVisitDetails = {};
  await finishSinceVisitChecklist([]);
}

async function startReviewWrapUp() {
  state.reviewWrapStep = 'summary-question';
  state.landingStudyFeedbackReason = 'phase-wrapup';
  state.landingFeedbackSummaryMarkdown = getApprovedProviderNoteMarkdown() || getWalkthroughRecapMarkdown();
  await pushStaggeredAssistantMessage(
    t('landing.review.summaryQuestion'),
    randomShortStaggerDelayMs()
  );

  setTimeout(() => {
    if (onOpenStudyModal) onOpenStudyModal();
  }, 600);
}

/** Called when StudyFeedbackModal closes (submit or X). Routes by why the modal was opened. */
export function handleStudyFeedbackClosed() {
  if (state.landingStudyFeedbackReason === 'after-walkthrough') {
    state.landingStudyFeedbackReason = null;
    void (async () => {
      await runSinceVisitRecap();
      await appendReviewPriorityFieldsAfterWalkthrough();
    })();
    return;
  }
  if (state.landingStudyFeedbackReason === 'after-handoff-share') {
    state.landingStudyFeedbackReason = null;
    state.landingAwaitingPostWalkthroughFeedback = false;
    renderLandingChatMessages();
    return;
  }
  state.landingStudyFeedbackReason = null;
  if (state.reviewWrapStep === 'summary-question') {
    showQuestionsChips();
  }
}

export function showQuestionsChips() {
  const lastMsg = state.landingMessages[state.landingMessages.length - 1];
  if (lastMsg && lastMsg.role === 'assistant') {
    lastMsg.chips = ['yes', 'no'];
  }
  renderLandingChatMessages();
}

async function askMoreQuestions() {
  state.reviewWrapStep = 'questions-loop';
  await pushStaggeredAssistantMessage(
    t('landing.review.moreQuestions'),
    randomShortStaggerDelayMs(),
    { chips: ['yes', 'no'] }
  );
}

async function showNextStepsQuestion() {
  state.reviewWrapStep = 'next-steps';
  await pushStaggeredAssistantMessage(
    t('landing.review.nextSteps'),
    randomShortStaggerDelayMs(),
    { chips: ['yes', 'no'] }
  );
}

async function completeReviewWrapUp() {
  state.reviewWrapStep = null;
  const target = state.pendingPhaseTarget;
  state.pendingPhaseTarget = null;
  if (target != null) {
    await executePhaseTransition(target);
  }
}

function removeLandingTyping() {
  const row = document.getElementById('landing-typing-row');
  if (row) row.remove();
}

function showLandingTyping(opts = {}) {
  const body = document.getElementById('landing-chat-body');
  if (!body) return;
  removeLandingTyping();
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.id = 'landing-typing-row';
  row.innerHTML = `
    <div class="msg-avatar">HC</div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  body.appendChild(row);
  if (!opts.suppressChatScroll) scrollLandingChatBottom();
}

async function saveLandingSession() {
  if (!state.landingMessages.length) return;
  if (!state.landingSessionId) {
    state.landingSessionId = crypto.randomUUID();
  }
  const date = new Date().toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
  try {
    await apiSaveSession(
      state.landingSessionId,
      'dashboard',
      date,
      state.landingMessages.map((m) => {
        const out = { role: m.role, content: m.content };
        if (Array.isArray(m.sinceVisitEntries) && m.sinceVisitEntries.length) {
          out.sinceVisitEntries = m.sinceVisitEntries;
        }
        if (typeof m.sinceVisitNarrative === 'string' && m.sinceVisitNarrative.trim()) {
          out.sinceVisitNarrative = m.sinceVisitNarrative.trim();
        }
        if (Array.isArray(m.concernsEntries) && m.concernsEntries.length) {
          out.concernsEntries = m.concernsEntries;
        }
        if (typeof m.goingWellNote === 'string' && m.goingWellNote.trim()) {
          out.goingWellNote = m.goingWellNote.trim();
        }
        if (Array.isArray(m.visitGoalsEntries) && m.visitGoalsEntries.length) {
          out.visitGoalsEntries = m.visitGoalsEntries;
        }
        if (typeof m.visitGoalsNote === 'string' && m.visitGoalsNote.trim()) {
          out.visitGoalsNote = m.visitGoalsNote.trim();
        }
        if (m.endConversationCta) {
          out.endConversationCta = true;
        }
        if (m.approvedSummaryDoc) {
          out.approvedSummaryDoc = true;
          if (typeof m.approvedSummaryDocText === 'string' && m.approvedSummaryDocText.trim()) {
            out.approvedSummaryDocText = m.approvedSummaryDocText;
          }
        }
        if (m.handoffSharePrompt) {
          out.handoffSharePrompt = true;
          if (typeof m.handoffSummaryDraft === 'string' && m.handoffSummaryDraft.trim()) {
            out.handoffSummaryDraft = m.handoffSummaryDraft;
          }
        }
        return out;
      })
    );
  } catch (_) {}
}

function beginEditMessage(idx) {
  if (state.landingIsTyping) return;
  const msg = state.landingMessages[idx];
  if (!msg || msg.role !== 'user') return;

  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (!input) return;

  state.landingAwaitingPostWalkthroughFeedback = false;
  state.landingAwaitingWalkthroughContinue = false;
  state.landingStudyFeedbackReason = null;
  state.landingFeedbackSummaryMarkdown = null;
  state.landingEndConversationCtaVisible = false;

  state.landingMessages = state.landingMessages.slice(0, idx);
  const stillAwaitingReview = state.landingMessages.some(
    (m) =>
      m.reviewTopicsForm ||
      m.reviewPriorityConfirmation ||
      m.reviewPriorityOpenPrompt ||
      m.reviewPriorityFieldsForm
  );
  if (!stillAwaitingReview) {
    state.landingAwaitingReviewTopics = false;
    state.landingReviewPriorityPhase = null;
    state.landingPriorityTopics = [];
  }
  if (!state.landingMessages.some((m) => m.sinceVisitChecklistForm)) {
    state.landingAwaitingSinceVisitChecklist = false;
  }
  if (!state.landingMessages.some((m) => m.concernsChecklistForm)) {
    state.landingAwaitingConcernsChecklist = false;
  }
  if (!state.landingMessages.some((m) => m.visitGoalsChecklistForm)) {
    state.landingAwaitingVisitGoalsChecklist = false;
  }
  if (!state.landingMessages.some((m) => m.providerQuestionsSmsOffer)) {
    state.landingAwaitingProviderQuestionContinue = false;
  }
  if (!state.landingMessages.some((m) => m.lastVisitQuestionsForm)) {
    state.landingAwaitingLastVisitQuestions = false;
    state.landingLastVisitQsStep = null;
  }
  syncLandingSinceVisitFollowUpFromMessages();
  if (!state.landingMessages.some((m) => m.handoffSummaryReviewForm)) {
    state.landingAwaitingHandoffSummaryReview = false;
  }
  if (!state.landingMessages.some((m) => m.handoffSharePrompt)) {
    state.landingAwaitingHandoffShareChoice = false;
  }
  renderLandingChatMessages();

  input.value = msg.content;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  if (sendBtn) sendBtn.disabled = false;
  input.focus();
}

async function sendLandingMessage() {
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (!input || !sendBtn) return;
  const text = input.value.trim();
  if (state.landingIsTyping) return;

  if (state.landingAwaitingPostWalkthroughFeedback) {
    showToast(t('landing.toast.closeFeedback'));
    return;
  }

  if (state.landingAwaitingWalkthroughContinue) {
    showToast(t('landing.toast.tapContinue'));
    return;
  }

  if (state.onboardingStep === 'privacy') {
    const lastPrivacy = state.landingMessages[state.landingMessages.length - 1];
    if (lastPrivacy?.role === 'assistant' && lastPrivacy.action) {
      const low = text.toLowerCase();
      const ok = !text || low === 'continue' || low === 'continuar';
      if (ok) {
        clearLandingComposerInput();
        handlePrivacyContinue();
        return;
      }
      showToast(t('landing.toast.tapContinueStart'));
      return;
    }
  }

  if (state.landingAwaitingVisitGoalsChecklist) {
    showToast(t('landing.toast.visitGoals'));
    return;
  }

  if (!text) return;

  if (
    state.landingAwaitingReviewTopics &&
    state.landingReviewPriorityPhase === 'fields'
  ) {
    showToast(t('landing.toast.reviewFields'));
    return;
  }

  if (state.landingAwaitingSinceVisitChecklist) {
    showToast(t('landing.toast.sinceVisit'));
    return;
  }

  if (state.landingAwaitingConcernsChecklist) {
    showToast(t('landing.toast.concerns'));
    return;
  }

  if (state.landingAwaitingProviderQuestionContinue) {
    showToast(t('landing.toast.pqContinue'));
    return;
  }

  if (state.landingAwaitingHandoffShareChoice) {
    showToast(t('landing.toast.handoffShare'));
    return;
  }

  if (state.landingSinceVisitFollowUp === 'provider-questions') {
    const low = text.toLowerCase();
    const isYes = low === 'yes' || low === 'y' || low === 'sí' || low === 'si';
    const isNo =
      low === 'no' ||
      low === 'n' ||
      low === 'no thanks' ||
      low === 'nope' ||
      low === 'no gracias';
    if (isYes || isNo) {
      const lm = state.landingMessages[state.landingMessages.length - 1];
      if (lm) delete lm.chips;
      input.value = '';
      input.style.height = 'auto';
      void handleProviderQuestionsChipChoice(isYes ? 'yes' : 'no');
    } else {
      showToast(t('landing.toast.pqYesNo'));
    }
    return;
  }

  if (state.landingSinceVisitFollowUp === 'pre-handoff-confirm') {
    const low = text.toLowerCase();
    if (
      low.includes('yes') ||
      low.includes('ready') ||
      low.includes('go') ||
      low.includes('sí') ||
      low.includes('si') ||
      low.includes('listo')
    ) {
      input.value = '';
      input.style.height = 'auto';
      void handlePreHandoffConfirm();
    } else {
      showToast(t('landing.toast.preHandoff'));
    }
    return;
  }

  if (isEmergency(text, 'dashboard')) {
    if (state.landingSinceVisitFollowUp) {
      state.landingSinceVisitFollowUp = null;
      state.landingAwaitingConcernsChecklist = false;
      state.landingAwaitingVisitGoalsChecklist = false;
      state.landingAwaitingProviderQuestionContinue = false;
      clearSinceVisitFollowUpMetaFromMessages();
    }
    if (state.landingAwaitingReviewTopics) {
      state.landingAwaitingReviewTopics = false;
      state.landingReviewPriorityPhase = null;
      state.landingPriorityTopics = [];
      state.landingMessages.forEach((m) => {
        delete m.reviewTopicsForm;
        delete m.reviewPriorityConfirmation;
        delete m.priorityTopicsSnapshot;
        if (m.reviewPriorityOpenPrompt) {
          delete m.reviewPriorityOpenPrompt;
          delete m.action;
        }
        if (m.reviewPriorityFieldsForm) {
          delete m.reviewPriorityFieldsForm;
          delete m.action;
        }
      });
    }
    if (state.landingAwaitingHandoffSummaryReview) {
      state.landingAwaitingHandoffSummaryReview = false;
      clearHandoffSummaryFromMessages();
    }
    if (state.landingAwaitingHandoffShareChoice) {
      state.landingAwaitingHandoffShareChoice = false;
      state.landingMessages.forEach((m) => {
        if (m.role === 'assistant' && m.handoffSharePrompt) {
          delete m.handoffSharePrompt;
          delete m.handoffSummaryDraft;
        }
      });
    }
    if (state.landingAwaitingLastVisitQuestions) {
      state.landingAwaitingLastVisitQuestions = false;
      state.landingLastVisitQsStep = null;
      state.landingMessages.forEach((m) => {
        if (m.role === 'assistant' && m.lastVisitQuestionsForm) {
          delete m.lastVisitQuestionsForm;
          delete m.action;
          delete m.secondaryAction;
        }
      });
    }
    if (state.landingAwaitingWalkthroughContinue || state.landingAwaitingPostWalkthroughFeedback) {
      state.landingAwaitingWalkthroughContinue = false;
      state.landingAwaitingPostWalkthroughFeedback = false;
      state.landingStudyFeedbackReason = null;
      state.landingFeedbackSummaryMarkdown = null;
      state.landingMessages.forEach((m) => {
        if (m.role === 'assistant' && m.walkthroughContinueAction) {
          delete m.walkthroughContinueAction;
          delete m.action;
        }
      });
    }
    state.landingMessages.push({
      role: 'assistant',
      content: t('landing.emergency.dashboard'),
    });
    input.value = '';
    input.style.height = 'auto';
    renderLandingChatMessages();
    await saveLandingSession();
    return;
  }

  if (state.landingAwaitingHandoffSummaryReview) {
    await submitHandoffSummaryRevision(text, input, sendBtn);
    return;
  }

  if (
    state.landingSinceVisitFollowUp === 'anything-else' ||
    state.landingSinceVisitFollowUp === 'concerns' ||
    state.landingSinceVisitFollowUp === 'pre-summary'
  ) {
    const followStep = state.landingSinceVisitFollowUp;
    await submitSinceVisitFollowUpStep(text, followStep);
    return;
  }

  if (state.onboardingStep === 'name') {
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    void handleNameInput(text);
    return;
  }

  if (state.reviewWrapStep === 'questions-loop' || state.reviewWrapStep === 'next-steps-explore') {
    const wrapStep = state.reviewWrapStep;
    state.landingMessages.push({ role: 'user', content: text });
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    state.landingIsTyping = true;
    renderLandingChatMessages();

    const history = landingMessagesForModel(state.landingMessages.slice(0, -1));
    showLandingTyping();

    try {
      const data = await sendChatMessage({
        message: text,
        history,
        mode: 'dashboard',
        path: 'guided',
        record: state.patientRecord || {},
        checklistContext: buildLandingChecklistContext(),
      });
      removeLandingTyping();
      state.landingMessages.push({ role: 'assistant', content: data.reply });
      renderLandingChatMessages();
      await saveLandingSession();
    } catch (err) {
      removeLandingTyping();
      state.landingMessages.push({
        role: 'assistant',
        content: err.message || t('errors.serverRetry'),
      });
      renderLandingChatMessages();
    } finally {
      state.landingIsTyping = false;
      sendBtn.disabled = !input.value.trim();
    }

    if (wrapStep === 'questions-loop') {
      void askMoreQuestions();
    } else {
      completeReviewWrapUp();
    }
    return;
  }

  const inLastVisitQuestions = state.landingAwaitingLastVisitQuestions;
  if (inLastVisitQuestions) {
    state.landingMessages.forEach((m) => {
      if (m.role === 'assistant' && m.lastVisitQuestionsForm) {
        delete m.action;
        delete m.secondaryAction;
        delete m.lastVisitQuestionsForm;
      }
    });
  }

  state.landingMessages.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  state.landingIsTyping = true;
  renderLandingChatMessages();

  const history = landingMessagesForModel(state.landingMessages.slice(0, -1));

  showLandingTyping();

  try {
    const data = await sendChatMessage({
      message: text,
      history,
      mode: 'dashboard',
      path: 'guided',
      record: state.patientRecord || {},
      checklistContext: buildLandingChecklistContext(),
    });
    removeLandingTyping();
    state.landingMessages.push({ role: 'assistant', content: data.reply });
    renderLandingChatMessages();
    await saveLandingSession();
  } catch (err) {
    removeLandingTyping();
    state.landingMessages.push({
      role: 'assistant',
      content: err.message || t('errors.serverRetry'),
    });
    renderLandingChatMessages();
  } finally {
    state.landingIsTyping = false;
    sendBtn.disabled = !input.value.trim();
  }

  if (inLastVisitQuestions && state.landingAwaitingLastVisitQuestions) {
    await appendMoreOrReadyPrompt();
  }
}

function applyFontSize(size) {
  const body = document.getElementById('landing-chat-body');
  if (!body) return;
  FONT_SIZES.forEach(c => body.classList.remove(c));
  body.classList.add(size);
  try { localStorage.setItem(FONT_SIZE_KEY, size); } catch (_) {}

  const idx = FONT_SIZES.indexOf(size);
  const mdIdx = FONT_SIZES.indexOf('font-md');
  const smBtn = document.getElementById('font-toggle-sm');
  const lgBtn = document.getElementById('font-toggle-lg');
  if (smBtn) smBtn.classList.toggle('active', idx < mdIdx);
  if (lgBtn) lgBtn.classList.toggle('active', idx > mdIdx);
}

function wireFontToggle() {
  if (fontToggleWired) return;
  const smBtn = document.getElementById('font-toggle-sm');
  const lgBtn = document.getElementById('font-toggle-lg');
  if (!smBtn || !lgBtn) return;
  fontToggleWired = true;

  const saved = localStorage.getItem(FONT_SIZE_KEY) || 'font-md';
  applyFontSize(FONT_SIZES.includes(saved) ? saved : 'font-md');

  smBtn.addEventListener('click', () => {
    const body = document.getElementById('landing-chat-body');
    if (!body) return;
    const idx = FONT_SIZES.findIndex(c => body.classList.contains(c));
    if (idx > 0) applyFontSize(FONT_SIZES[idx - 1]);
  });

  lgBtn.addEventListener('click', () => {
    const body = document.getElementById('landing-chat-body');
    if (!body) return;
    const idx = FONT_SIZES.findIndex(c => body.classList.contains(c));
    if (idx < FONT_SIZES.length - 1) applyFontSize(FONT_SIZES[idx + 1]);
  });
}

function openCujDocs() {
  window.open(CUJ_DOCS_URL, '_blank', 'noopener,noreferrer');
}

function wireLandingBrandNav() {
  const el = document.getElementById('landing-brand-hit');
  if (!el) return;
  el.addEventListener('click', () => {
    openCujDocs();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCujDocs();
    }
  });
}

export function init() {
  teardownLandingHooks();
  landingHooksAbortController = new AbortController();
  const { signal } = landingHooksAbortController;
  wireLandingMenu(signal);
  const backTurnBtn = document.getElementById('landing-back-turn-btn');
  backTurnBtn?.addEventListener('click', () => {
    void reverseLandingAssistantTurn();
  }, { signal });
  const endConversationBtn = document.getElementById('landing-end-conversation-cta');
  endConversationBtn?.addEventListener('click', () => {
    state.landingEndConversationCtaVisible = false;
    updateEndConversationCta();
    if (onOpenEndConversation) onOpenEndConversation();
  }, { signal });
  const restartBtn = document.getElementById('landing-restart-btn');
  restartBtn?.addEventListener('click', () => {
    restartLandingFromBeginning();
  }, { signal });
  wireLandingChatInput(signal);
  wireLandingBrandNav();
  wireFontToggle();
}

export function updatePersonalization() {
  const name = state.profile.name || state.user?.displayName || '';
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? t('greeting.morning') : hour < 17 ? t('greeting.afternoon') : t('greeting.evening');
  const greeting = name ? `${timeGreeting}, ${name}` : timeGreeting;
  const el = document.getElementById('greeting-text');
  if (el) el.textContent = greeting;
  if (name) {
    document.getElementById('landing-avatar').textContent =
      name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
}

export function updateNoteCard() {
  const chip = document.getElementById('landing-note-chip');
  if (!chip) return;
  if (state.patientRecordIsDefault) {
    chip.classList.remove('custom-active');
  } else {
    chip.classList.add('custom-active');
  }
}
