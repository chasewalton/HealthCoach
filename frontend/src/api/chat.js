import { apiRequest } from './client.js';

export function sendChatMessage({ message, history, mode, path, record, briefAck, checklistContext }) {
  const body = { message, history, mode, path, record };
  if (briefAck) body.briefAck = true;
  if (checklistContext) body.checklistContext = checklistContext;
  return apiRequest('POST', '/api/chat', body);
}

/** @param {{ record?: unknown; timeline?: unknown; message?: string }} body */
export function requestSinceVisitRecap(body) {
  return apiRequest('POST', '/api/since-visit-recap', body);
}

export function generateSummary(history, mode) {
  return apiRequest('POST', '/api/summary', { history, mode });
}

/** @param {{ record?: unknown; draftTopics?: string[] }} body */
export function requestReviewFocusSuggestions(body) {
  return apiRequest('POST', '/api/review-focus-suggestions', body);
}

/** @param {{ messages: { role: string; content: string }[]; record?: unknown }} body */
export function requestProviderQuestionSuggestions(body) {
  return apiRequest('POST', '/api/provider-question-suggestions', body);
}
