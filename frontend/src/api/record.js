import { apiRequest } from './client.js';

export function getRecord() {
  return apiRequest('GET', '/api/record');
}

export function uploadRecord(content) {
  return apiRequest('POST', '/api/record', { content });
}

export function resetRecord() {
  return apiRequest('DELETE', '/api/record');
}
