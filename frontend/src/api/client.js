import { auth } from '../firebase.js';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {object} [opts]
 * @param {import('firebase/auth').User | null} [opts.user] Use the User from onAuthStateChanged when auth.currentUser is not set yet.
 */
export async function apiRequest(method, path, body, opts = {}) {
  const options = { method, headers: {} };
  const tokenUser = opts.user ?? auth.currentUser;
  if (tokenUser) {
    const token = await tokenUser.getIdToken();
    options.headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let res = await fetch(path, options);
  if (res.status === 401 && tokenUser) {
    const token = await tokenUser.getIdToken(true);
    options.headers.Authorization = `Bearer ${token}`;
    res = await fetch(path, options);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(data.error || 'Request failed', res.status);
  }
  return res.json();
}
