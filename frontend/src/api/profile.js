import { updateProfile as updateFirebaseProfile } from 'firebase/auth';

import { auth } from '../firebase.js';
import { apiRequest } from './client.js';

export function getProfile() {
  return apiRequest('GET', '/api/profile');
}

export async function updateProfile(data) {
  const result = await apiRequest('PUT', '/api/profile', data);
  const displayName = result.user?.displayName;
  if (displayName && auth.currentUser && auth.currentUser.displayName !== displayName) {
    await updateFirebaseProfile(auth.currentUser, { displayName });
  }
  return result;
}
