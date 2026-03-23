import type { DecodedIdToken } from 'firebase-admin/auth';

import { adminDb, nowIso } from './firebaseAdmin.js';
import { HttpError } from './http.js';
import { DEFAULT_MODEL_PREF, MODEL_MAP } from './prompts.js';

const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;

export const PROFILE_DEFAULTS = {
  name: '',
  dob: '',
  gender: '',
  language: 'en',
  literacy: 'high',
  interpreter: 'no',
  education: '',
  modelPref: DEFAULT_MODEL_PREF,
};

type EditableProfileInput = {
  username?: unknown;
  name?: unknown;
  dob?: unknown;
  gender?: unknown;
  language?: unknown;
  literacy?: unknown;
  interpreter?: unknown;
  education?: unknown;
  modelPref?: unknown;
};

function toTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeUsername(value: unknown) {
  return toTrimmedString(value).toLowerCase();
}

function sanitizeProfileUpdates(data: EditableProfileInput) {
  const updates: Record<string, string> = {};

  if ('name' in data) updates.name = toTrimmedString(data.name);
  if ('dob' in data) updates.dob = toTrimmedString(data.dob);
  if ('gender' in data) updates.gender = toTrimmedString(data.gender);
  if ('language' in data) updates.language = toTrimmedString(data.language) === 'es' ? 'es' : 'en';
  if ('literacy' in data) updates.literacy = toTrimmedString(data.literacy) || PROFILE_DEFAULTS.literacy;
  if ('interpreter' in data) updates.interpreter = toTrimmedString(data.interpreter) || PROFILE_DEFAULTS.interpreter;
  if ('education' in data) updates.education = toTrimmedString(data.education);
  if ('modelPref' in data) {
    const modelPref = toTrimmedString(data.modelPref);
    updates.modelPref = modelPref in MODEL_MAP ? modelPref : DEFAULT_MODEL_PREF;
  }

  return updates;
}

function mergeProfile(profileData?: Record<string, unknown>) {
  return {
    ...PROFILE_DEFAULTS,
    ...(profileData || {}),
  };
}

export async function getProfileResponse(uid: string, authToken: DecodedIdToken) {
  const userRef = adminDb.collection('users').doc(uid);
  const profileRef = adminDb.collection('profiles').doc(uid);
  const [userSnap, profileSnap] = await Promise.all([userRef.get(), profileRef.get()]);
  const userData = (userSnap.data() || {}) as Record<string, unknown>;
  const profileData = (profileSnap.data() || {}) as Record<string, unknown>;

  return {
    user: {
      uid,
      email: String(userData.email || authToken.email || ''),
      username: String(userData.username || ''),
      displayName: String(userData.displayName || authToken.name || ''),
    },
    profile: mergeProfile(profileData),
  };
}

export async function saveProfile(uid: string, authToken: DecodedIdToken, data: EditableProfileInput) {
  const userRef = adminDb.collection('users').doc(uid);
  const profileRef = adminDb.collection('profiles').doc(uid);
  const usernameInputProvided = Object.prototype.hasOwnProperty.call(data, 'username');
  const normalizedUsername = normalizeUsername(data.username);
  const profileUpdates = sanitizeProfileUpdates(data);
  const now = nowIso();

  await adminDb.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const profileSnap = await tx.get(profileRef);
    const existingUser = (userSnap.data() || {}) as Record<string, unknown>;
    const existingProfile = (profileSnap.data() || {}) as Record<string, unknown>;
    const currentUsername = typeof existingUser.username === 'string' ? existingUser.username : '';

    if (usernameInputProvided) {
      if (!normalizedUsername && !currentUsername) {
        throw new HttpError(400, 'Username is required.');
      }
      if (normalizedUsername && !USERNAME_PATTERN.test(normalizedUsername)) {
        throw new HttpError(
          400,
          'Usernames must be 3-40 characters and use only letters, numbers, dots, underscores, or hyphens.'
        );
      }
      if (currentUsername && normalizedUsername && currentUsername !== normalizedUsername) {
        throw new HttpError(409, 'Username is already set and cannot be changed.');
      }
      if (normalizedUsername) {
        const usernameRef = adminDb.collection('usernames').doc(normalizedUsername);
        const usernameSnap = await tx.get(usernameRef);
        const reservedUid = usernameSnap.data()?.uid;
        if (usernameSnap.exists && reservedUid && reservedUid !== uid) {
          throw new HttpError(409, 'That username is already taken.');
        }
        tx.set(
          usernameRef,
          {
            uid,
            createdAt: usernameSnap.data()?.createdAt || now,
          },
          { merge: true }
        );
      }
    }

    const nameProvided = Object.prototype.hasOwnProperty.call(profileUpdates, 'name');
    const nextDisplayName =
      (nameProvided && profileUpdates.name) ||
      String(existingUser.displayName || authToken.name || normalizedUsername || currentUsername || authToken.email || '');

    tx.set(
      userRef,
      {
        email: authToken.email || existingUser.email || '',
        username: currentUsername || normalizedUsername || '',
        displayName: nextDisplayName,
        createdAt: existingUser.createdAt || now,
      },
      { merge: true }
    );

    tx.set(
      profileRef,
      {
        ...PROFILE_DEFAULTS,
        ...existingProfile,
        ...profileUpdates,
      },
      { merge: false }
    );
  });

  return getProfileResponse(uid, authToken);
}
