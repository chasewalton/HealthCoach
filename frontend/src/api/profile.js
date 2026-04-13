import { updateProfile as updateFirebaseProfile } from 'firebase/auth';

import { auth } from '../firebase.js';
import { apiRequest } from './client.js';

export function getProfile(authUser) {
  return apiRequest('GET', '/api/profile', undefined, authUser ? { user: authUser } : {});
}

export async function updateProfile(data, authUser) {
  const result = await apiRequest('PUT', '/api/profile', data, authUser ? { user: authUser } : {});
  const displayName = result.user?.displayName;
  const profileUser = authUser || auth.currentUser;
  if (displayName && profileUser && profileUser.displayName !== displayName) {
    await updateFirebaseProfile(profileUser, { displayName });
  }
  return result;
}
