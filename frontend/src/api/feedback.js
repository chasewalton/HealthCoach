import { apiRequest } from './client.js';

export function submitFeedback(data) {
  return apiRequest('POST', '/api/feedback', data);
}
