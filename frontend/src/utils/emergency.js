const EMERGENCY_PATTERN = /chest pain|can't breathe|can not breathe|suicid|emergency|call 911|heart attack/i;

/**
 * Returns true when text looks like an active emergency.
 * Skipped entirely in review mode (patient is discussing a past visit note).
 */
export function isEmergency(text, chatMode) {
  if (chatMode === 'review' || chatMode === 'combined') return false;
  return EMERGENCY_PATTERN.test(text);
}
