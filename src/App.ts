/**
 * Application : démarrage, chargement, boucle de jeu à pas fixe, pause et menus.
 */
import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import { View } from './render/View';
import { Assets } from './core/Assets';
import { AudioEngine } from './core/Audio';
import { Input, type Layout, cloneBindings, detectLayout } from './core/Input';
import { SaveManager } from './core/Save';
import { ModelRegistry } from './render/characters';
import { Game } from './game/Game';
import { LEVELS } from './game/levels';
import { Ui, type UiHost } from './ui/Ui';
import { setLang, t } from './i18n';

const STEP = 1 / 60;

/** Images nécessaires dès l'écran d'accueil et pour l'affichage en jeu. */
const CORE = [
  'hero/idle', 'hero/talk', 'bg/village', 'items/piece', 'items/coeur', 'items/banane', 'items/pierre',
  'items/parchemin', 'items/cle', 'items/plume', 'items/gemme', 'items/bouclier', 'items/lanterne', 'props/pot',
];

export class App implements UiHost {
  readonly save = new SaveManager();
  readonly input = new Input();
  readonly audio = new AudioEngine();
  readonly assets = new Assets();
  readonly models = new ModelRegistry();
  view!: View;
  ui!: Ui;
  game!: Game;
  paused = false;
  private acc = 0;
  private last = 0;
  private keyboard: Layout = 'qwerty';

  async boot(): Promise<void> {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const root = document.getElementById('ui') as HTMLElement;
    setLang(this.save.settings.lang);
    try {
      this.view = new View(canvas);
    } catch (err) {
      console.error(err);
      root.innerHTML = '';
      const msg = document.createElement('div');
      msg.className = 'loading';
      msg.textContent = t('menu.webgl');
      root.append(msg);
      return;
    }
    this.assets.maxAnisotropy = this.view.maxAnisotropy;
    await this.assets.loadManifest();
    const params = new URLSearchParams(location.search);
    await this.models.load(params.get('modeles') ?? 'models.json');
    this.ui = new Ui(root, this.save, this.input, this.audio, this.assets, this);
    this.game = new Game(this.view, this.assets, this.audio, this.input, this.save, this.models, this.ui);
    this.ui.game = this.game;
    this.game.onQuit = () => this.toTitle();
    this.keyboard = await detectLayout();
    this.settingsChanged();

    this.ui.loading(0);
    await this.assets.load(CORE, (p) => this.ui.loading(p));
    this.ui.loading(null);
    if (this.assets.missing.length) this.ui.reportMissing(this.assets.missing);

    const unlock = (): void => {
      this.audio.unlock();
      this.audio.configure(this.save.settings);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.game.stage && this.game.mode === 'play' && !this.paused) this.pause();
        this.save.saveProgress();
      }
      this.audio.suspend(document.hidden);
    });
    window.addEventListener('pagehide', () => this.save.saveProgress());

    (window as unknown as { __ousmane: unknown }).__ousmane = this;

    // Raccourci de développement : ?niveau=3 démarre directement au niveau 3.
    const direct = Number(params.get('niveau'));
    if (direct >= 1 && direct <= LEVELS.length) {
      this.save.progress.unlocked = Math.max(this.save.progress.unlocked, direct);
      this.startLevel(direct - 1);
    } else {
      this.toTitle();
    }
    this.last = performance.now();
    requestAnimationFrame((now) => this.frame(now));
  }

  private toTitle(): void {
    this.paused = false;
    this.audio.setPaused(false);
    this.audio.playMusic('menu');
    this.audio.setAmbience(['oiseaux']);
    this.view.renderer.setClearColor(0x2a1205, 1);
    this.ui.setPlaying(false);
    this.ui.showTitle();
  }

  // ------------------------------------------------------------------ boutons des menus

  startNew(): void {
    this.save.resetProgress();
    this.startLevel(0);
  }

  continueGame(): void {
    this.ui.closeScreens();
    void this.game.startLevel(Math.min(this.save.progress.level, LEVELS.length - 1), true);
  }

  startLevel(index: number): void {
    this.ui.closeScreens();
    this.paused = false;
    void this.game.startLevel(index, false);
  }

  pause(): void {
    if (this.paused || !this.game.stage) return;
    this.paused = true;
    this.input.releaseAll();
    this.audio.setPaused(true);
    this.ui.showPause();
  }

  resume(): void {
    this.paused = false;
    this.audio.setPaused(false);
    this.ui.closeScreens();
    this.input.releaseAll();
  }

  restartCheckpoint(): void {
    this.resume();
    void this.game.startLevel(this.game.levelIndex, true);
  }

  quitToMenu(): void {
    this.resume();
    this.game.quit();
  }

  settingsChanged(): void {
    const s = this.save.settings;
    setLang(s.lang);
    this.audio.configure(s);
    this.input.bindings = cloneBindings(s.bindings);
    this.ui.refreshTouch();
    this.ui.hud();
  }

  layout(): Layout {
    const s = this.save.settings.layout;
    return s === 'auto' ? this.keyboard : s;
  }

  levelCount(): number {
    return LEVELS.length;
  }

  // ------------------------------------------------------------------ boucle

  private frame(now: number): void {
    requestAnimationFrame((n) => this.frame(n));
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.input.pollGamepad();
    const g = this.game;

    // L'interface lit les appuis en premier (dialogues, menus).
    this.ui.update(dt);

    if (g.stage && this.input.wasPressed('pause')) {
      this.input.consume('pause');
      if (this.paused) this.resume();
      else if (g.mode === 'play' && !this.ui.hasScreen) this.pause();
    }

    if (g.stage && !this.paused) {
      // Simulation à pas fixe : le comportement du jeu ne dépend pas de la fréquence d'affichage.
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        g.update(STEP);
        this.input.endStep();
        this.acc -= STEP;
        steps++;
      }
      if (steps === 5) this.acc = 0;
    } else {
      this.input.endStep();
    }
    this.view.update(dt);
    this.view.render();
  }
}
