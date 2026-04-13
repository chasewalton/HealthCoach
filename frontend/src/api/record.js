import { apiRequest } from './client.js';

export function getRecord(authUser) {
  return apiRequest('GET', '/api/record', undefined, authUser ? { user: authUser } : {});
}

export function uploadRecord(content) {
  return apiRequest('POST', '/api/record', { content });
}

export function resetRecord() {
  return apiRequest('DELETE', '/api/record');
}
