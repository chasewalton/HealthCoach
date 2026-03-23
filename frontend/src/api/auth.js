import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth';

import { auth } from '../firebase.js';
import { ApiError } from './client.js';
import { updateProfile as persistProfile } from './profile.js';

let pendingRegistration = null;

function trackPendingRegistration(promise) {
  const trackedPromise = promise.finally(() => {
    if (pendingRegistration === trackedPromise) {
      pendingRegistration = null;
    }
  });
  pendingRegistration = trackedPromise;
  return trackedPromise;
}

async function waitForPendingRegistration() {
  if (!pendingRegistration) return;
  try {
    await pendingRegistration;
  } catch (_) {
    // The registration path surfaces its own error. The auth listener should
    // continue using the final settled auth state after the rollback.
  }
}

function mapAuthError(err) {
  if (err instanceof ApiError) return err;
  const code = err?.code || '';
  if (code === 'auth/email-already-in-use') return new Error('That email is already registered.');
  if (code === 'auth/invalid-email') return new Error('Please enter a valid email address.');
  if (code === 'auth/weak-password') return new Error('Password should be at least 6 characters.');
  if (code === 'auth/too-many-requests') return new Error('Too many attempts. Please wait a moment and try again.');
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials' ||
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password'
  ) {
    return new Error('Incorrect email or password.');
  }
  return new Error(err?.message || 'Something went wrong. Please try again.');
}

export async function register(email, password, displayName, language, username) {
  let createdUser = null;
  return trackPendingRegistration((async () => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = credential.user;
      await updateFirebaseProfile(createdUser, { displayName });
      await persistProfile({ username, name: displayName, language });
      return {
        uid: createdUser.uid,
        email: createdUser.email,
        username,
        displayName,
      };
    } catch (err) {
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (_) {
          // If rollback fails, the next auth listener tick will still reconcile
          // the current user and the UI can prompt the user to try again.
        }
      }
      throw mapAuthError(err);
    }
  })());
}

export async function login(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (err) {
    throw mapAuthError(err);
  }
}

export async function logout() {
  try {
    await signOut(auth);
  } catch (err) {
    throw mapAuthError(err);
  }
}

export function checkSession(onChange) {
  return onAuthStateChanged(auth, async () => {
    await waitForPendingRegistration();
    await onChange(auth.currentUser);
  });
}
