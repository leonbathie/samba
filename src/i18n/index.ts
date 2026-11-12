/**
 * Traductions. Le français est la langue de référence : toute clé absente d'une autre langue
 * retombe sur le texte français. Le pulaar est prévu (fichier ff.ts) mais volontairement vide :
 * aucune traduction n'est inventée.
 */
import { fr } from './fr';
import { en } from './en';
import { ff } from './ff';

export type Lang = 'fr' | 'en' | 'ff';
export type Dict = Record<string, string>;

export const DICTS: Record<Lang, Dict> = { fr, en, ff };

export interface LangInfo {
  id: Lang;
  label: string;
  /** Faux tant que la traduction n'a pas été fournie par des locuteurs. */
  available: boolean;
}

export const LANGS: readonly LangInfo[] = [
  { id: 'fr', label: 'Français', available: true },
  { id: 'en', label: 'English', available: true },
  { id: 'ff', label: 'Pulaar', available: Object.keys(ff).length > 0 },
];

let current: Lang = 'fr';
const listeners = new Set<() => void>();

export function setLang(lang: Lang): void {
  const info = LANGS.find((l) => l.id === lang);
  current = info && info.available ? lang : 'fr';
  if (typeof document !== 'undefined') document.documentElement.lang = current;
  for (const cb of listeners) cb();
}

export function getLang(): Lang {
  return current;
}

export function onLangChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Texte traduit ; les paramètres remplacent les marqueurs {nom}. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = DICTS[current][key] ?? fr[key];
  if (s === undefined) {
    if (import.meta.env?.DEV) console.warn('[i18n] clé absente : ' + key);
    return key;
  }
  if (params) {
    for (const k of Object.keys(params)) s = s.split('{' + k + '}').join(String(params[k]));
  }
  return s;
}

export function hasKey(key: string): boolean {
  return fr[key] !== undefined;
}
