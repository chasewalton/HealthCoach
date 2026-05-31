import state from './state.js';

const dictionaries = { en: {}, es: {} };

export function registerTranslations(lang, entries) {
  if (!dictionaries[lang]) dictionaries[lang] = {};
  Object.assign(dictionaries[lang], entries);
}

/**
 * @param {string} key
 * @param {Record<string, string | number | undefined> | undefined} params
 */
export function t(key, params) {
  const lang = state.profile?.language || 'en';
  const str = dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
}

export function currentLang() {
  return state.profile?.language || 'en';
}

export function dateLocale() {
  return currentLang() === 'es' ? 'es-ES' : 'en-US';
}

/** Sync `<html lang>` with profile language (call after profile load and reloadApp). */
export function syncDocumentLang() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = currentLang() === 'es' ? 'es' : 'en';
}
