import { apiRequest } from './client.js';

export function sendChatMessage({ message, history, mode, path, record }) {
  return apiRequest('POST', '/api/chat', { message, history, mode, path, record });
}

export function generateSummary(history, mode) {
  return apiRequest('POST', '/api/summary', { history, mode });
}
