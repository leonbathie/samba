import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fr } from '../../src/i18n/fr';
import { en } from '../../src/i18n/en';
import { ff } from '../../src/i18n/ff';
import { LANGS, setLang, t } from '../../src/i18n';
import { ACTIONS } from '../../src/core/Input';
import { LEVELS, ROOMS } from '../../src/game/levels';
import { QUESTS, SPEAKERS } from '../../src/game/story';

const NAMESPACES = [
  'menu', 'settings', 'action', 'key', 'pause', 'hud', 'weapon', 'touch', 'prompt', 'dialogue', 'end', 'defeat', 'toast',
  'lock', 'obj', 'level', 'room', 'name', 'quest', 'clue', 'sign', 'dlg', 'choice',
];

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (p.endsWith('.ts') && !p.includes('i18n')) out.push(p);
  }
  return out;
}

describe('traductions', () => {
  it('toutes les clés utilisées dans le code existent en français', () => {
    const used = new Set<string>();
    const re = new RegExp(`'((?:${NAMESPACES.join('|')})\\.[A-Za-z0-9.]+)'`, 'g');
    for (const file of sources('src')) {
      for (const m of readFileSync(file, 'utf-8').matchAll(re)) used.add(m[1]);
    }
    for (const a of ACTIONS) used.add('action.' + a);
    for (const w of ['banana', 'stone', 'sling']) used.add('weapon.' + w);
    LEVELS.forEach((_, i) => used.add('level.' + (i + 1)));
    for (const q of Object.values(QUESTS)) used.add(q.title);
    for (const s of Object.values(SPEAKERS)) used.add(s.name);
    for (const make of Object.values(ROOMS)) used.add(make().name);
    const missing = [...used].filter((k) => !k.endsWith('.') && fr[k] === undefined);
    expect(missing).toEqual([]);
    expect(used.size).toBeGreaterThan(200);
  });

  it('l’anglais traduit toutes les clés françaises', () => {
    expect(Object.keys(fr).filter((k) => en[k] === undefined)).toEqual([]);
    expect(Object.keys(en).filter((k) => fr[k] === undefined)).toEqual([]);
  });

  it('les marqueurs {param} sont les mêmes dans les deux langues', () => {
    const marks = (s: string): string => (s.match(/\{[a-z]+\}/g) ?? []).sort().join();
    expect(Object.keys(fr).filter((k) => marks(fr[k]) !== marks(en[k]))).toEqual([]);
  });

  it('le pulaar est prévu mais aucune traduction n’est inventée', () => {
    expect(Object.keys(ff)).toEqual([]);
    expect(LANGS.find((l) => l.id === 'ff')?.available).toBe(false);
  });

  it('les paramètres remplacent les marqueurs et une langue indisponible retombe sur le français', () => {
    setLang('en');
    expect(t('toast.bananas', { n: 3 })).toBe('+3 bananas');
    setLang('ff');
    expect(t('menu.play')).toBe('Jouer');
    setLang('fr');
    expect(t('hud.level', { n: 4 })).toBe('Niveau 4');
  });
});
