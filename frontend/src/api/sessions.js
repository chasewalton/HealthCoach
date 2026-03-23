import { apiRequest } from './client.js';

export function listSessions() {
  return apiRequest('GET', '/api/sessions');
}

export function saveSession(id, mode, date, messages) {
  return apiRequest('POST', '/api/sessions', { id, mode, date, messages });
}

export function getSession(id) {
  return apiRequest('GET', `/api/sessions/${id}`);
}

export function deleteSessionById(id) {
  return apiRequest('DELETE', `/api/sessions/${id}`);
}
