import { apiRequest } from './client.js';

export function authenticateAdmin(password) {
  return apiRequest('POST', '/api/admin/prompts', { password });
}

export function saveAdminPrompts(password, prompts) {
  return apiRequest('PUT', '/api/admin/prompts', { password, prompts });
}
