/**
 * Canonical chip values for language-agnostic logic. Legacy English/Spanish UI strings map here.
 */
export const LEGACY_CHIP_TO_CANONICAL = {
  English: 'en',
  Español: 'es',
  Yes: 'yes',
  No: 'no',
  Continue: 'continue',
  'No thanks': 'noThanks',
  'No gracias': 'noThanks',
  'Continue to visit goals': 'continueToVisitGoals',
  'Continuar a objetivos de la visita': 'continueToVisitGoals',
};

/**
 * @param {string | { value?: string; v?: string; label?: string }} c
 * @returns {string}
 */
export function canonicalChipValue(c) {
  if (c == null) return '';
  if (typeof c === 'object') {
    const v = c.value ?? c.v;
    if (v) return String(v);
  }
  const s = String(c);
  return LEGACY_CHIP_TO_CANONICAL[s] ?? s;
}
