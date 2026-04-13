/** Display version (keep in sync with VersionBadge / release notes). */
export const VERSION = 'v2.0.9';

/**
 * Newest first. Update when you ship changes.
 * @type {{ version: string; date?: string; changes: string[] }[]}
 */
export const CHANGELOG = [
  {
    version: 'v2.0.9',
    date: '2026-04-08',
    changes: [
      'End-chat and landing share modals, chat export helper, and related landing/auth/API UI updates.',
    ],
  },
  {
    version: 'v2.0.8',
    date: '2026-04-06',
    changes: [
      'Chat: “Here’s how to prepare” section headers render as plain subheadings instead of boxed cards.',
    ],
  },
  {
    version: 'v2.0.6',
    date: '2026-03-22',
    changes: ['Version bump.'],
  },
  {
    version: 'v2.0.5',
    date: '2026-03-23',
    changes: [
      'Landing quick actions: "Help me prepare for my next visit" now starts the same dashboard chat flow as the other landing prompts instead of jumping into the separate combined chat screen.',
    ],
  },
  {
    version: 'v2.0.4',
    date: '2026-03-22',
    changes: [
      'Registration: save the new account profile with the freshly created Firebase user so signup no longer fails with `/api/profile` 401 errors.',
    ],
  },
  {
    version: 'v2.0.3',
    date: '2026-03-23',
    changes: [
      'API client: attach ID tokens using the Firebase User from the auth listener when needed; retry once with a forced token refresh on 401.',
    ],
  },
  {
    version: 'v2.0.2',
    date: '2026-03-23',
    changes: [
      'Wait for Firebase auth to finish restoring the session before calling the API so the first /api/profile request includes an ID token.',
    ],
  },
  {
    version: 'v2.0.1',
    date: '2026-03-23',
    changes: [
      'HTTP API: public invoker on the Cloud Function so Hosting /api rewrites work. Local Vite: set BACKEND_URL to production Hosting for the API proxy.',
    ],
  },
  {
    version: 'v2.0.0',
    date: '2026-03-22',
    changes: [
      'Rebuilt authentication on Firebase Auth with email/password sign-in and registration.',
      'Moved the backend API to Firebase Cloud Functions with Firestore-backed profile, note, session, and admin prompt data.',
      'Conversation history and custom note reset now use Firestore and real UUID session IDs.',
    ],
  },
  {
    version: 'v1.6.0',
    date: '2026-03-22',
    changes: [
      'Major conversation overhaul: HealthCoach now asks before telling, follows the patient\'s lead, and acknowledges multiple conditions and providers.',
      'Removed rigid yes/no greeting flow -- conversations start with an open-ended question.',
      'AI prompts rewritten for empathy, pacing, and genuine back-and-forth dialogue.',
      'Progress bar advances more gently so patients never feel rushed.',
      'Increased response length for more thoughtful, conversational replies.',
    ],
  },
  {
    version: 'v1.5.11',
    date: '2026-03-22',
    changes: [
      'Redesigned chat message formatting: section headers, grouped bullet cards, and clearer visual hierarchy for easier reading.',
    ],
  },
  {
    version: 'v1.5.10',
    date: '2025-03-22',
    changes: [
      'Language and admin prompt dropdowns vertically center the selected value.',
    ],
  },
  {
    version: 'v1.5.9',
    date: '2025-03-21',
    changes: [
      'Version label opens release notes with a running changelog.',
      'Admin access is available from the top of the release notes dialog.',
    ],
  },
  {
    version: 'v1.5.8',
    changes: [
      'Landing dashboard chat, session history, and combined review + prep flow refinements.',
    ],
  },
];
