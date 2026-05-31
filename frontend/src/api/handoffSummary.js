import { apiRequest } from './client.js';

/**
 * @typedef {Object} LandingChecklistContext
 * @property {Array<{ id: string; label: string; checked: boolean; detail?: string }>} [sinceVisit]
 * @property {Array<{ id: string; label: string; checked: boolean; detail?: string }>} [concerns]
 * @property {string} [goingWellNote]
 * @property {Array<{ id: string; label: string; checked: boolean }>} [visitGoals]
 * @property {string} [visitGoalsNote]
 */

/** @param {{ messages: { role: string; content: string }[]; checklistContext?: LandingChecklistContext | null }} body */
export function requestHandoffSummary(body) {
  return apiRequest('POST', '/api/handoff-summary', body);
}

/**
 * @param {{
 *   currentSummary: string;
 *   patientRequest: string;
 *   messages: { role: string; content: string }[];
 *   checklistContext?: LandingChecklistContext | null;
 * }} body
 */
export function requestHandoffSummaryRevise(body) {
  return apiRequest('POST', '/api/handoff-summary-revise', body);
}
