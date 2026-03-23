import './styles/tokens.css';
import './styles/reset.css';
import './styles/layout.css';
import './styles/auth.css';
import './styles/landing.css';
import './styles/chat.css';
import './styles/modals.css';
import './styles/home-landing.css';
import './styles/utilities.css';

import state from './state.js';
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
import * as NoteModal from './components/modals/NoteModal.js';
import * as ShareModal from './components/modals/ShareModal.js';
import * as AdminModal from './components/modals/AdminModal.js';
import * as ProfileModal from './components/modals/ProfileModal.js';
import * as VersionChangelogModal from './components/modals/VersionChangelogModal.js';

import * as NotePrompt from './components/chat/NotePrompt.js';
import * as HistoryDrawer from './components/HistoryDrawer.js';
import * as Toast from './components/Toast.js';
import * as VersionBadge from './components/VersionBadge.js';
import { disposeLandingAmbient3d } from './three/landingAmbient.js';

const API_DOWN_HINT =
  'Cannot reach the backend. Check BACKEND_URL in frontend/.env.local and make sure the Firebase Hosting site is available.';

let activeAuthTransition = 0;

function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = [
    AuthScreen.render(),
    LandingScreen.render(),
    ChatScreen.render(),
    HomeLandingScreen.render(),
    SummaryModal.render(),
    NoteModal.render(),
    ShareModal.render(),
    AdminModal.render(),
    ProfileModal.render(),
    VersionChangelogModal.render(),
    HistoryDrawer.render(),
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
  NoteModal.init();
  HistoryDrawer.init();
  ShareModal.init();
  AdminModal.init();
  ProfileModal.init();
  VersionChangelogModal.init();
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
      await enterApp();
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
    onLoadSession: loadSessionById,
    onStartCombinedFlow: () => {
      ChatScreen.startChat('combined');
      showScreen('chat');
      ChatScreen.showInitialPrompt();
    },
    onOpenHomeLanding: () => {
      state.homeLandingReturnScreen = 'landing';
      HomeLandingScreen.refresh();
      showScreen('home');
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

  HistoryDrawer.setCallbacks({
    onLoadSession: loadSessionById,
    onSessionDeleted: async (deletedId) => {
      if (deletedId === state.landingSessionId) {
        LandingScreen.resetLandingChat();
      }
      await LandingScreen.renderRecentList();
    },
  });
}

async function enterApp() {
  showScreen('landing');
  await Promise.all([fetchProfile(), fetchPatientRecord()]);
  LandingScreen.updatePersonalization();
  LandingScreen.updateNoteCard();
  LandingScreen.initLandingChat();
  await LandingScreen.renderRecentList();
}

async function signOut() {
  if (!window.confirm('Sign out?')) return;
  try {
    await logout();
  } catch (err) {
    Toast.showToast(err?.message || 'Could not sign out. Please try again.');
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
  state.landingConversationStarted = false;
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

async function fetchProfile() {
  try {
    const data = await getProfile();
    mergeUserAndProfile(data);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 502)) {
      console.warn('HealthCoach:', API_DOWN_HINT);
      Toast.showToast(API_DOWN_HINT);
    }
  }
}

async function fetchPatientRecord() {
  try {
    const data = await getRecord();
    state.patientRecord = data.content;
    state.patientRecordIsDefault = data.isDefault;
  } catch (_) {}
}

async function goBack() {
  showScreen('landing');
  await LandingScreen.renderRecentList();
}

async function loadSessionById(id) {
  HistoryDrawer.close();
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
    state.currentSessionId = null;
    LandingScreen.loadDashboardSession(s);
    showScreen('landing');
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

  await enterApp();
  if (transitionId !== activeAuthTransition) return;
  HomeLandingScreen.refresh();
}

(async function initApp() {
  renderApp();
  initComponents();
  wireCallbacks();

  checkSession(async (user) => {
    await handleAuthStateChange(user);
  });
  HomeLandingScreen.refresh();
})();
