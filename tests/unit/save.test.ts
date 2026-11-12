import { describe, expect, it } from 'vitest';
import { MemoryStore, PROGRESS_KEY, SETTINGS_KEY, SaveManager } from '../../src/core/Save';
import { DEFAULT_BINDINGS } from '../../src/core/Input';

describe('sauvegarde locale', () => {
  it('une partie neuve commence avec trois cœurs et rien à continuer', () => {
    const s = new SaveManager(new MemoryStore());
    expect(s.progress.hearts).toBe(3);
    expect(s.progress.maxHearts).toBe(3);
    expect(s.hasGame()).toBe(false);
  });

  it('la progression et les paramètres survivent à un rechargement', () => {
    const store = new MemoryStore();
    const a = new SaveManager(store);
    a.progress.started = true;
    a.progress.level = 3;
    a.progress.checkpoint = 2;
    a.progress.coins = 42;
    a.progress.flags.cle = 1;
    a.progress.quests.sorcier = 'done';
    a.progress.collected.village = ['ballon'];
    a.saveProgress();
    a.settings.lang = 'en';
    a.settings.musicVol = 0.25;
    a.settings.bindings.jump = ['KeyZ'];
    a.saveSettings();

    const b = new SaveManager(store);
    expect(b.hasGame()).toBe(true);
    expect(b.progress.level).toBe(3);
    expect(b.progress.checkpoint).toBe(2);
    expect(b.progress.coins).toBe(42);
    expect(b.progress.flags.cle).toBe(1);
    expect(b.progress.quests.sorcier).toBe('done');
    expect(b.progress.collected.village).toEqual(['ballon']);
    expect(b.settings.lang).toBe('en');
    expect(b.settings.musicVol).toBe(0.25);
    expect(b.settings.bindings.jump).toEqual(['KeyZ']);
    expect(b.settings.bindings.left).toEqual(DEFAULT_BINDINGS.left);
  });

  it('une sauvegarde abîmée ne bloque pas le jeu', () => {
    const store = new MemoryStore();
    store.setItem(PROGRESS_KEY, '{oups');
    store.setItem(SETTINGS_KEY, JSON.stringify({ lang: 'xx', musicVol: 'fort' }));
    const s = new SaveManager(store);
    expect(s.progress.level).toBe(0);
    expect(['fr', 'en']).toContain(s.settings.lang);
    expect(s.settings.musicVol).toBeGreaterThanOrEqual(0);
    expect(s.settings.musicVol).toBeLessThanOrEqual(1);
  });

  it('effacer la progression garde les paramètres', () => {
    const store = new MemoryStore();
    const s = new SaveManager(store);
    s.progress.started = true;
    s.saveProgress();
    s.settings.sfxOn = false;
    s.saveSettings();
    s.resetProgress();
    const again = new SaveManager(store);
    expect(again.hasGame()).toBe(false);
    expect(again.settings.sfxOn).toBe(false);
  });
});
