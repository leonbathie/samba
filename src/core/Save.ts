/**
 * Sauvegarde locale (localStorage) des paramètres et de la progression.
 * Tout passe par une interface de stockage : le jeu reste jouable si le stockage est indisponible
 * (navigation privée) et les tests peuvent fournir un stockage en mémoire.
 */
import { type Bindings, cloneBindings, DEFAULT_BINDINGS } from './Input';

export type Lang = 'fr' | 'en' | 'ff';
export type Weapon = 'banana' | 'stone' | 'sling';

export interface Settings {
  lang: Lang;
  musicOn: boolean;
  sfxOn: boolean;
  musicVol: number;
  sfxVol: number;
  layout: 'auto' | 'azerty' | 'qwerty';
  bindings: Bindings;
  touch: 'auto' | 'on' | 'off';
}

export type QuestStatus = 'active' | 'done';

export interface Progress {
  version: 1;
  /** Faux tant qu'aucune partie n'a commencé : « Continuer » est alors désactivé. */
  started: boolean;
  /** Index du niveau en cours (0 à 6). */
  level: number;
  /** Index du dernier point de sauvegarde activé dans ce niveau (-1 = début du niveau). */
  checkpoint: number;
  /** Nombre de niveaux débloqués. */
  unlocked: number;
  hearts: number;
  maxHearts: number;
  coins: number;
  score: number;
  bananas: number;
  stones: number;
  feathers: number;
  shield: boolean;
  hasSling: boolean;
  equipped: Weapon;
  /** Drapeaux d'histoire (carte obtenue, clé reçue, indices trouvés…) et compteurs de quêtes. */
  flags: Record<string, number>;
  quests: Record<string, QuestStatus>;
  /** Objets uniques déjà ramassés, par niveau : ils ne réapparaissent pas. */
  collected: Record<string, string[]>;
  finished: boolean;
  playTime: number;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

export const SETTINGS_KEY = 'ousmane.settings.v1';
export const PROGRESS_KEY = 'ousmane.progress.v1';

export function defaultSettings(): Settings {
  const nav = typeof navigator !== 'undefined' ? navigator.language || 'fr' : 'fr';
  return {
    lang: /^en/i.test(nav) ? 'en' : 'fr',
    musicOn: true,
    sfxOn: true,
    musicVol: 0.6,
    sfxVol: 0.8,
    layout: 'auto',
    bindings: cloneBindings(DEFAULT_BINDINGS),
    touch: 'auto',
  };
}

export function newProgress(): Progress {
  return {
    version: 1,
    started: false,
    level: 0,
    checkpoint: -1,
    unlocked: 1,
    hearts: 3,
    maxHearts: 3,
    coins: 0,
    score: 0,
    bananas: 0,
    stones: 0,
    feathers: 0,
    shield: false,
    hasSling: false,
    equipped: 'banana',
    flags: {},
    quests: {},
    collected: {},
    finished: false,
    playTime: 0,
  };
}

function browserStore(): KeyValueStore {
  try {
    const s = window.localStorage;
    const probe = '__ousmane_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return new MemoryStore();
  }
}

export class SaveManager {
  readonly store: KeyValueStore;
  /** Faux si le navigateur refuse le stockage : la progression ne survivra pas au rechargement. */
  readonly persistent: boolean;
  settings: Settings;
  progress: Progress;

  constructor(store?: KeyValueStore) {
    this.store = store ?? (typeof window !== 'undefined' ? browserStore() : new MemoryStore());
    this.persistent = !(this.store instanceof MemoryStore) || !!store;
    this.settings = this.loadSettings();
    this.progress = this.loadProgress();
  }

  private read<T>(key: string): Partial<T> | null {
    try {
      const raw = this.store.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? (data as Partial<T>) : null;
    } catch {
      return null;
    }
  }

  private loadSettings(): Settings {
    const base = defaultSettings();
    const data = this.read<Settings>(SETTINGS_KEY);
    if (!data) return base;
    const out: Settings = { ...base, ...data };
    out.bindings = cloneBindings({ ...DEFAULT_BINDINGS, ...(data.bindings ?? {}) } as Bindings);
    out.musicVol = clamp01(out.musicVol);
    out.sfxVol = clamp01(out.sfxVol);
    if (!['fr', 'en', 'ff'].includes(out.lang)) out.lang = base.lang;
    return out;
  }

  private loadProgress(): Progress {
    const base = newProgress();
    const data = this.read<Progress>(PROGRESS_KEY);
    if (!data || data.version !== 1) return base;
    return {
      ...base,
      ...data,
      flags: { ...(data.flags ?? {}) },
      quests: { ...(data.quests ?? {}) },
      collected: { ...(data.collected ?? {}) },
    };
  }

  saveSettings(): void {
    try {
      this.store.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* stockage plein ou refusé : on continue sans sauvegarder. */
    }
  }

  saveProgress(): void {
    try {
      this.store.setItem(PROGRESS_KEY, JSON.stringify(this.progress));
    } catch {
      /* idem */
    }
  }

  hasGame(): boolean {
    return this.progress.started;
  }

  /** Nouvelle partie : la progression est remise à zéro, les paramètres sont conservés. */
  resetProgress(): void {
    this.progress = newProgress();
    try {
      this.store.removeItem(PROGRESS_KEY);
    } catch {
      /* rien */
    }
  }
}

function clamp01(v: unknown): number {
  const n = typeof v === 'number' && isFinite(v) ? v : 0.7;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
