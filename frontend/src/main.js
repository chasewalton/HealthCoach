import './styles/tokens.css';
import './styles/reset.css';
import './styles/layout.css';
import './styles/auth.css';
import './styles/landing.css';
import './styles/chat.css';
import './styles/modals.css';
import './styles/home-landing.css';
import './styles/utilities.css';

import { registerTranslations, syncDocumentLang, t } from './i18n.js';
import en from './translations/en.js';
import es from './translations/es.js';

registerTranslations('en', en);
registerTranslations('es', es);

import state from './state.js';
import { auth } from './firebase.js';
import { showScreen } from './router.js';
import { ApiError } from './api/client.js';
import { checkSession, logout } from './api/auth.js';
import { getProfile } from './api/profile.js';
import { getRecord } from './api/record.js';
import { getSession } from './api/sessions.js';

import * as AuthScreen from './components/screens/AuthScreen.js';
import * as LandingScreen from './components/screens/LandingScreen.js';
import * as ChatScreen from './components/screens/ChatScreen.js';
import * as HomeLandingScreen from './components/screens/HomeLandingScreen.js';

import * as SummaryModal from './components/modals/SummaryModal.js';
import * as SummaryDocModal from './components/modals/SummaryDocModal.js';
import * as NoteModal from './components/modals/NoteModal.js';
import * as ShareModal from './components/modals/ShareModal.js';
import * as AdminModal from './components/modals/AdminModal.js';
import * as ProfileModal from './components/modals/ProfileModal.js';
import * as VersionChangelogModal from './components/modals/VersionChangelogModal.js';
import * as StudyFeedbackModal from './components/modals/StudyFeedbackModal.js';
import * as EndChatModal from './components/modals/EndChatModal.js';
import * as PairModal from './components/modals/PairModal.js';
import * as NotePrompt from './components/chat/NotePrompt.js';
import * as Toast from './components/Toast.js';
import * as VersionBadge from './components/VersionBadge.js';
import { disposeLandingAmbient3d } from './three/landingAmbient.js';

function apiDownHint() {
  return t('main.apiDown');
}

let activeAuthTransition = 0;

/** Full DOM re-init after language change from Profile (keeps router state). */
export function reloadApp() {
  const activeId = document.querySelector('.screen.active')?.id || '';
  const name = activeId.replace(/^screen-/, '') || 'landing';
  LandingScreen.teardownLandingHooks();
  renderApp();
  initComponents();
  wireCallbacks();
  syncDocumentLang();
  if (typeof document !== 'undefined') {
    document.title = t('app.title');
  }
  showScreen(name);
  if (name === 'landing') {
    LandingScreen.renderJourneyStepper();
    LandingScreen.renderLandingChatMessages();
    LandingScreen.updatePersonalization();
    LandingScreen.updateNoteCard();
  }
  HomeLandingScreen.refresh();
}

function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = [
    AuthScreen.render(),
    LandingScreen.render(),
    ChatScreen.render(),
    HomeLandingScreen.render(),
    SummaryModal.render(),
    SummaryDocModal.render(),
    NoteModal.render(),
    ShareModal.render(),
    AdminModal.render(),
    ProfileModal.render(),
    VersionChangelogModal.render(),
    StudyFeedbackModal.render(),
    EndChatModal.render(),
    PairModal.render(),
    Toast.render(),
    VersionBadge.render(),
  ].join('');
}

function initComponents() {
  AuthScreen.init();
  LandingScreen.init();
  ChatScreen.init();
  HomeLandingScreen.init();
  SummaryModal.init();
  SummaryDocModal.init();
  NoteModal.init();
  ShareModal.init();
  AdminModal.init();
  ProfileModal.init();
  VersionChangelogModal.init();
  StudyFeedbackModal.init();
  EndChatModal.init();
  PairModal.init();
  VersionBadge.init();
}

function wireCallbacks() {
  AuthScreen.setCallbacks({
    onOpenHomeLanding: () => {
      state.homeLandingReturnScreen = 'auth';
      HomeLandingScreen.refresh();
      showScreen('home');
    },
  });

  HomeLandingScreen.setCallbacks({
    onBack: () => {
      showScreen(state.homeLandingReturnScreen || 'landing');
    },
    onSignIn: () => {
      state.homeLandingReturnScreen = 'auth';
      showScreen('auth');
    },
    onGoDashboard: async () => {
      if (!state.user) {
        state.homeLandingReturnScreen = 'auth';
        showScreen('auth');
        return;
      }
      await enterApp(auth.currentUser);
      showScreen('landing');
    },
  });

  VersionChangelogModal.setCallbacks({
    onOpenAdminLogin: () => AdminModal.openLogin(),
  });

  LandingScreen.setCallbacks({
    onOpenNoteModal: () => NoteModal.open(),
    onOpenProfile: () => ProfileModal.open(),
    onOpenAdminLogin: () => AdminModal.openLogin(),
    onSignOut: signOut,
    onOpenHomeLanding: () => {
      state.homeLandingReturnScreen = 'landing';
      HomeLandingScreen.refresh();
      showScreen('home');
    },
    onOpenStudyModal: () => StudyFeedbackModal.open(),
    onOpenEndConversation: () => PairModal.open(),
    onOpenSummaryDoc: (summaryText) => SummaryDocModal.open(summaryText),
  });

  StudyFeedbackModal.setCallbacks({
    onClose: () => LandingScreen.handleStudyFeedbackClosed(),
  });

  PairModal.setCallbacks({
    // After the required PAIR questionnaire, continue to the editable summary + Share step.
    onComplete: () => EndChatModal.open(),
  });

  EndChatModal.setCallbacks({
    onConfirmEnd: () => {},
    onOpenShare: async () => {
      const LandingShareModal = await import('./components/modals/LandingShareModal.js');
      if (!document.getElementById('modal-landing-share')) {
        document.getElementById('app')?.insertAdjacentHTML('beforeend', LandingShareModal.render());
        LandingShareModal.init();
      }
      LandingShareModal.open();
    },
  });

  ChatScreen.setCallbacks({
    onGoBack: goBack,
    onOpenSummary: () => SummaryModal.open(),
    onOpenShareModal: () => ShareModal.open(),
    onSignOut: signOut,
    onShowNotePrompt: () => NotePrompt.show(),
  });

  NoteModal.setCallbacks({
    onNoteUpdated: () => LandingScreen.updateNoteCard(),
    onProceedFromNote: () => ChatScreen.proceedFromNotePrompt(),
  });

  ShareModal.setCallbacks({
    onShareWithProvider: () => SummaryModal.open(),
    onDeleteSession: async () => {
      await ChatScreen.deleteCurrentSession();
      await goBack();
    },
  });

  NotePrompt.setCallbacks({
    onProceed: () => ChatScreen.proceedFromNotePrompt(),
    onOpenNoteReplace: () => {
      NoteModal.setAwaitingConfirm(true);
      NoteModal.openInReplaceMode();
    },
  });

}

async function enterApp(firebaseUser) {
  await auth.authStateReady();
  showScreen('landing');
  await Promise.all([fetchProfile(firebaseUser), fetchPatientRecord(firebaseUser)]);
  LandingScreen.updatePersonalization();
  LandingScreen.updateNoteCard();
  LandingScreen.initLandingChat();
}

async function signOut() {
  if (!window.confirm(t('main.signOutConfirm'))) return;
  try {
    await logout();
  } catch (err) {
    Toast.showToast(err?.message || t('main.signOutError'));
  }
}

function resetAuthenticatedState() {
  state.user = null;
  state.profile = {};
  state.sessions = [];
  state.patientRecord = null;
  state.patientRecordIsDefault = true;
  state.messages = [];
  state.currentSessionId = null;
  state.lastSummary = null;
  state.landingMessages = [];
  state.landingSessionId = null;
  state.landingIsTyping = false;
  state.landingAwaitingReviewTopics = false;
  state.landingReviewPriorityPhase = null;
  state.landingPriorityTopics = [];
  state.landingAwaitingSinceVisitChecklist = false;
  state.landingAwaitingConcernsChecklist = false;
  state.landingAwaitingVisitGoalsChecklist = false;
  state.landingSinceVisitFollowUp = null;
  state.landingSinceVisitDetails = {};
  state.landingSinceVisitNarrative = '';
  state.landingGoingWellReply = '';
  state.landingConcernsDetails = {};
  state.landingVisitGoalsDetails = {};
  state.landingVisitGoalsNote = '';
  state.landingAwaitingProviderQuestionContinue = false;
  state.landingAwaitingHandoffSummaryReview = false;
  state.landingAwaitingHandoffShareChoice = false;
  state.landingConversationStarted = false;
  state.journeyPhase = 0;
  state.onboardingStep = null;
  state.landingWalkthroughLaunched = false;
  state.landingBootstrapStarted = false;
  state.reviewWrapStep = null;
  state.pendingPhaseTarget = null;
  state.landingStudyFeedbackReason = null;
  state.landingFeedbackSummaryMarkdown = null;
  state.landingAwaitingPostWalkthroughFeedback = false;
  state.landingAwaitingWalkthroughContinue = false;
  state.landingEndConversationCtaVisible = false;
  disposeLandingAmbient3d();
}

function mergeUserAndProfile(data) {
  if (data?.user) {
    state.user = {
      ...state.user,
      ...data.user,
    };
  }
  if (data?.profile) {
    state.profile = {
      ...state.profile,
      ...data.profile,
    };
  }
}

async function fetchProfile(firebaseUser) {
  try {
    const data = await getProfile(firebaseUser);
    mergeUserAndProfile(data);
    syncDocumentLang();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 502)) {
      console.warn('HealthCoach:', apiDownHint());
      Toast.showToast(apiDownHint());
    }
  }
}

async function fetchPatientRecord(firebaseUser) {
  try {
    const data = await getRecord(firebaseUser);
    state.patientRecord = data.content;
    state.patientRecordIsDefault = data.isDefault;
  } catch (_) {}
}

async function goBack() {
  showScreen('landing');
}

async function loadSessionById(id) {
  let s = state.sessions.find(x => x.id === id);
  if (!s) {
    try {
      s = await getSession(id);
    } catch (_) {}
  }
  if (!s) return;
  if (!state.sessions.some(x => x.id === s.id)) {
    state.sessions = [s, ...state.sessions];
  }
  if (s.mode === 'dashboard') {
    return;
  }
  state.landingSessionId = null;
  ChatScreen.loadSession(s);
  showScreen('chat');
}

async function handleAuthStateChange(user) {
  const transitionId = ++activeAuthTransition;

  if (!user) {
    resetAuthenticatedState();
    showScreen('auth');
    HomeLandingScreen.refresh();
    return;
  }

  state.user = {
    uid: user.uid,
    email: user.email || '',
    username: state.user?.username || '',
    displayName: user.displayName || '',
  };

  await enterApp(user);
  if (transitionId !== activeAuthTransition) return;
  HomeLandingScreen.refresh();
}

(async function initApp() {
  if (typeof document !== 'undefined') {
    document.title = t('app.title');
  }
  renderApp();
  initComponents();
  wireCallbacks();
  syncDocumentLang();

  checkSession(async (user) => {
    await handleAuthStateChange(user);
  });
  HomeLandingScreen.refresh();
})();
