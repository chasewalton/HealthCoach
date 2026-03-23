/** Display version (keep in sync with VersionBadge / release notes). */
export const VERSION = 'v2.0.0';

/**
 * Newest first. Update when you ship user-visible changes.
 * @type {{ version: string; date?: string; changes: string[] }[]}
 */
export const CHANGELOG = [
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
