/**
 * Interface : affichage en jeu (héros, cœurs, pièces, score, objets), invites, aides, dialogues,
 * menus (accueil, paramètres, pause, missions, fins) et commandes tactiles.
 * Tout est en HTML/CSS par-dessus le canevas 3D : net à toutes les tailles d'écran.
 */
import '../styles/ui.css';
import type { Game, LevelStats, UiBridge } from '../game/Game';
import type { SaveManager } from '../core/Save';
import { ACTIONS, type Action, DEFAULT_BINDINGS, type Input, type Layout, cloneBindings, keyLabel } from '../core/Input';
import type { AudioEngine } from '../core/Audio';
import type { Assets } from '../core/Assets';
import { LANGS, type Lang, getLang, t } from '../i18n';
import { QUESTS, knownClues } from '../game/story';

type Child = HTMLElement | string | null | false | undefined;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const k of kids) if (k) el.append(k);
  return el;
}

const SLING_ICON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M14 8c4 14 9 20 16 23M50 8c-4 14-9 20-16 23' fill='none' stroke='%238a5a2b' stroke-width='7' stroke-linecap='round'/%3E%3Cpath d='M32 30v26' stroke='%23a06a30' stroke-width='9' stroke-linecap='round'/%3E%3Cpath d='M14 9c8 10 28 10 36 0' fill='none' stroke='%23f6b93b' stroke-width='3'/%3E%3Ccircle cx='32' cy='17' r='5' fill='%236b4a3a'/%3E%3C/svg%3E\")";

/** Ce que l'interface demande à l'application (boutons des menus). */
export interface UiHost {
  startNew(): void;
  continueGame(): void;
  startLevel(index: number): void;
  resume(): void;
  restartCheckpoint(): void;
  quitToMenu(): void;
  settingsChanged(): void;
  layout(): Layout;
  levelCount(): number;
}

interface DialogueState {
  el: HTMLElement;
  line: HTMLElement;
  more: HTMLElement;
  text: string;
  shown: number;
  choices?: string[];
  choiceBox?: HTMLElement;
  resolve: (n: number) => void;
}

export class Ui implements UiBridge {
  game: Game | null = null;
  private hudEl: HTMLElement;
  private hearts: HTMLElement;
  private levelN: HTMLElement;
  private levelObj: HTMLElement;
  private coinsEl: HTMLElement;
  private scoreEl: HTMLElement;
  private slots: Record<'banana' | 'stone' | 'sling', HTMLButtonElement>;
  private bag: HTMLElement;
  private promptEl: HTMLElement;
  private promptKey: HTMLElement;
  private promptText: HTMLElement;
  private promptPos: { x: number; y: number } | null = null;
  private hintEl: HTMLElement;
  private toasts: HTMLElement;
  private fadeEl: HTMLElement;
  private loadingEl: HTMLElement;
  private loadingBar: HTMLElement;
  private touchEl: HTMLElement;
  private interactBtn!: HTMLButtonElement;
  private screens: HTMLElement[] = [];
  private layer: HTMLElement;
  private dlg: DialogueState | null = null;
  private blip = 0;
  private playing = false;
  private lastHearts = -1;
  private waitKey: (() => void) | null = null;
  private reported = new Set<string>();

  constructor(
    private root: HTMLElement,
    private save: SaveManager,
    private input: Input,
    private audio: AudioEngine,
    private assets: Assets,
    private host: UiHost,
  ) {
    // ---- affichage en jeu
    const avatar = h('div', 'avatar');
    avatar.style.backgroundImage = `url(${assets.url('hero/talk')})`;
    this.hearts = h('div', 'hearts');
    const heroCard = h('div', 'hero-card panel', avatar, h('div', '', h('div', 'hero-name', t('hud.hero')), this.hearts));
    this.levelN = h('div', 'level-n');
    this.levelObj = h('div', 'level-obj');
    const levelCard = h('div', 'level-card panel', this.levelN, this.levelObj);
    const coinIcon = h('i');
    coinIcon.style.backgroundImage = `url(${assets.url('items/piece')})`;
    this.coinsEl = h('span', '', '0');
    this.scoreEl = h('span', '', '0');
    const pause = h('button', 'icon-btn', '❚❚');
    pause.setAttribute('aria-label', 'Pause');
    pause.onclick = () => this.input.tap('pause');
    const right = h('div', 'hud-right',
      h('div', 'counter panel', coinIcon, this.coinsEl),
      h('div', 'counter panel', h('small', '', t('hud.score')), this.scoreEl),
      pause);
    const mkSlot = (img: string): HTMLButtonElement => {
      const b = h('button', 'slot', h('b', '', '0'));
      b.style.backgroundImage = img;
      b.onclick = () => this.input.tap('switch');
      return b;
    };
    this.slots = {
      banana: mkSlot(`url(${assets.url('items/banane')})`),
      stone: mkSlot(`url(${assets.url('items/pierre')})`),
      sling: mkSlot(SLING_ICON),
    };
    this.bag = h('div', 'bag');
    const inv = h('div', 'inv', h('div', 'slots', this.slots.banana, this.slots.stone, this.slots.sling), this.bag);
    this.hudEl = h('div', 'hud hidden', h('div', 'hud-top', heroCard, levelCard, right), inv);

    this.promptKey = h('kbd');
    this.promptText = h('span');
    this.promptEl = h('div', 'prompt hidden', this.promptKey, ' ', this.promptText);
    this.hintEl = h('div', 'hint hidden');
    this.toasts = h('div', 'toasts');
    this.touchEl = this.buildTouch();
    this.layer = h('div');
    this.fadeEl = h('div', 'fade');
    this.loadingBar = h('i');
    this.loadingEl = h('div', 'loading hidden', h('b', '', t('menu.loading')), h('div', 'bar', this.loadingBar));
    const rotate = h('div', 'rotate', t('menu.rotate'));
    root.append(this.hudEl, this.promptEl, this.hintEl, this.toasts, this.touchEl, this.layer, this.fadeEl, this.loadingEl, rotate);

    window.addEventListener('touchstart', () => {
      if (!this.input.touchUsed) {
        this.input.touchUsed = true;
        this.refreshTouch();
      }
    }, { passive: true });
  }

  // ------------------------------------------------------------------ touches et libellés

  private keyName(a: Action): string {
    const code = this.input.bindings[a][0];
    return keyLabel(code, this.host.layout(), { space: t('key.space'), enter: t('key.enter'), escape: t('key.escape') });
  }

  /** Nom du bouton à afficher pour une action, selon le mode de contrôle utilisé. */
  private actionLabel(a: Action): string {
    if (this.touchVisible()) {
      const map: Partial<Record<Action, string>> = {
        left: '◀', right: '▶', up: '▲', down: '▼', jump: t('touch.jump'), throw: t('touch.throw'),
        defend: t('touch.defend'), switch: t('touch.switch'), interact: '✋',
      };
      return map[a] ?? this.keyName(a);
    }
    return this.keyName(a);
  }

  // ------------------------------------------------------------------ commandes tactiles

  private touchVisible(): boolean {
    const mode = this.save.settings.touch;
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return this.input.touchUsed || !!window.matchMedia?.('(pointer: coarse)').matches;
  }

  refreshTouch(): void {
    this.touchEl.classList.toggle('hidden', !(this.playing && this.touchVisible()));
  }

  private buildTouch(): HTMLElement {
    const arrows = { left: h('i', 'l', '◀'), right: h('i', 'r', '▶'), up: h('i', 'u', '▲'), down: h('i', 'd', '▼') };
    const pad = h('div', 'pad', arrows.left, arrows.right, arrows.up, arrows.down);
    const dirs: Action[] = ['left', 'right', 'up', 'down'];
    let padId: number | null = null;
    const setDirs = (on: Partial<Record<Action, boolean>>): void => {
      for (const d of dirs) {
        const v = !!on[d];
        this.input.setVirtual(d, v);
        arrows[d as 'left'].classList.toggle('on', v);
      }
    };
    const move = (e: PointerEvent): void => {
      const r = pad.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      setDirs({
        left: dx < -0.26,
        right: dx > 0.26,
        // Les directions verticales demandent un geste franc : pas de montée accidentelle en courant.
        up: dy < -0.34 && ay > ax * 0.75,
        down: dy > 0.34 && ay > ax * 0.75,
      });
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      padId = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      move(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === padId) move(e);
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== padId) return;
      padId = null;
      setDirs({});
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);

    const mk = (cls: string, action: Action, label: string): HTMLButtonElement => {
      const b = h('button', 'tb ' + cls, label);
      const up = (): void => {
        b.classList.remove('on');
        this.input.setVirtual(action, false);
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        b.classList.add('on');
        this.input.setVirtual(action, true);
      });
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    };
    this.interactBtn = mk('interact hidden', 'interact', '✋');
    const btns = h('div', 'tbtns',
      mk('jump', 'jump', t('touch.jump')),
      mk('throw', 'throw', t('touch.throw')),
      mk('defend', 'defend', t('touch.defend')),
      mk('switch', 'switch', '⇄'),
      this.interactBtn);
    return h('div', 'touch hidden', pad, btns);
  }

  // ------------------------------------------------------------------ pont avec le jeu

  setPlaying(on: boolean): void {
    this.playing = on;
    this.hudEl.classList.toggle('hidden', !on);
    this.refreshTouch();
    if (!on) {
      this.prompt(null);
      this.hint(null);
    }
  }

  hud(): void {
    const g = this.game;
    if (!g) return;
    const p = g.progress;
    if (this.hearts.childElementCount !== p.maxHearts) {
      this.hearts.replaceChildren();
      for (let i = 0; i < p.maxHearts; i++) {
        const el = h('i', 'heart');
        el.style.backgroundImage = `url(${this.assets.url('items/coeur')})`;
        this.hearts.append(el);
      }
    }
    [...this.hearts.children].forEach((el, i) => {
      el.classList.toggle('empty', i >= p.hearts);
      if (this.lastHearts >= 0 && i === p.hearts - 1 && p.hearts > this.lastHearts) {
        el.classList.remove('pop');
        void (el as HTMLElement).offsetWidth;
        el.classList.add('pop');
      }
    });
    this.lastHearts = p.hearts;
    this.coinsEl.textContent = String(p.coins);
    this.scoreEl.textContent = String(p.score);
    const def = g.level;
    if (def) {
      this.levelN.textContent = `${t('hud.level', { n: def.number })} — ${t(def.name)}`;
      const obj = g.objective();
      this.levelObj.textContent = obj ? t(obj, { n: g.flag('jarres') }) : '';
    }
    const set = (k: 'banana' | 'stone' | 'sling', n: number, visible: boolean): void => {
      const b = this.slots[k];
      b.classList.toggle('hidden', !visible);
      b.classList.toggle('on', p.equipped === k);
      b.classList.toggle('empty', n <= 0);
      b.firstElementChild!.textContent = String(n);
      b.title = t('weapon.' + k);
    };
    set('banana', p.bananas, true);
    set('stone', p.stones, true);
    set('sling', p.stones, p.hasSling);
    const items: [string, number, boolean][] = [
      ['items/parchemin', 0, g.has('carte')],
      ['items/cle', 0, g.has('cle')],
      ['items/plume', p.feathers, p.feathers > 0],
      ['items/gemme', g.flag('gems'), g.flag('gems') > 0],
      ['items/bouclier', 0, p.shield],
      ['props/pot', g.flag('jarres'), g.flag('jarres') > 0 && !g.has('indice3')],
    ];
    this.bag.replaceChildren();
    for (const [img, n, show] of items) {
      if (!show) continue;
      const s = h('span', '', n > 0 ? h('b', '', String(n)) : null);
      s.style.backgroundImage = `url(${this.assets.url(img)})`;
      this.bag.append(s);
    }
  }

  prompt(pos: { x: number; y: number } | null, label?: string): void {
    this.promptPos = pos;
    const show = !!pos && this.playing;
    this.promptEl.classList.toggle('hidden', !show);
    this.interactBtn.classList.toggle('hidden', !show);
    if (show && label) {
      this.promptText.textContent = label;
      const touch = this.touchVisible();
      this.promptKey.classList.toggle('hidden', touch);
      if (!touch) this.promptKey.textContent = this.keyName('interact');
    }
  }

  hint(text: string | null, keys: Action[] = []): void {
    if (!text) {
      this.hintEl.classList.add('hidden');
      return;
    }
    this.hintEl.replaceChildren(text);
    if (keys.length) {
      const row = h('div', 'keys');
      for (const k of keys) row.append(h('kbd', '', this.actionLabel(k)));
      this.hintEl.append(row);
    }
    this.hintEl.classList.remove('hidden');
  }

  toast(text: string, icon?: string): void {
    const el = h('div', 'toast');
    if (icon) {
      const i = h('i');
      i.style.backgroundImage = `url(${this.assets.url(icon)})`;
      el.append(i);
    }
    el.append(text);
    this.toasts.append(el);
    while (this.toasts.childElementCount > 4) this.toasts.firstElementChild!.remove();
    window.setTimeout(() => el.classList.add('out'), 3200);
    window.setTimeout(() => el.remove(), 3700);
  }

  banner(title: string, sub?: string): void {
    this.root.querySelector('.banner')?.remove();
    const el = h('div', 'banner', sub ? h('b', '', title) : null, h('span', '', sub ?? title));
    this.root.insertBefore(el, this.layer);
    window.setTimeout(() => el.remove(), 3500);
  }

  fade(dark: boolean, ms = 250): Promise<void> {
    this.fadeEl.style.transitionDuration = ms + 'ms';
    this.fadeEl.classList.toggle('on', dark);
    return new Promise((r) => window.setTimeout(r, ms + 20));
  }

  loading(p: number | null): void {
    this.loadingEl.classList.toggle('hidden', p === null);
    if (p !== null) this.loadingBar.style.width = Math.round(p * 100) + '%';
  }

  reportMissing(ids: string[]): void {
    const fresh = ids.filter((id) => !this.reported.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => this.reported.add(id));
    this.toast(`${t('menu.missing')} (${fresh.slice(0, 3).join(', ')}${fresh.length > 3 ? '…' : ''})`);
  }

  // ------------------------------------------------------------------ dialogues

  dialogue(speaker: string, portrait: string | null, text: string, choices?: string[]): Promise<number> {
    this.closeDialogue(0);
    return new Promise((resolve) => {
      const line = h('div', 'line');
      const more = h('div', 'more hidden', '▼ ' + t('dialogue.next'));
      const el = h('div', 'dialogue panel' + (portrait ? '' : ' plain'));
      if (portrait) {
        const pic = h('div', 'portrait');
        pic.style.backgroundImage = `url(${portrait})`;
        el.append(pic);
      }
      if (speaker) el.append(h('div', 'speaker', speaker));
      el.append(line, more);
      el.addEventListener('pointerdown', (e) => {
        if (!(e.target as HTMLElement).closest('button')) this.advance();
      });
      this.root.insertBefore(el, this.layer);
      this.dlg = { el, line, more, text, shown: 0, choices, resolve };
    });
  }

  private closeDialogue(result: number): void {
    const d = this.dlg;
    if (!d) return;
    this.dlg = null;
    d.el.remove();
    d.resolve(result);
  }

  private advance(): void {
    const d = this.dlg;
    if (!d) return;
    if (d.shown < d.text.length) {
      d.shown = d.text.length;
      d.line.textContent = d.text;
      this.dialogueReady(d);
      return;
    }
    if (d.choices) return;
    this.audio.sfx('click', 0.6);
    this.closeDialogue(0);
  }

  private dialogueReady(d: DialogueState): void {
    if (d.choices && !d.choiceBox) {
      d.choiceBox = h('div', 'choices');
      d.choices.forEach((c, i) => {
        const b = h('button', 'btn' + (i ? ' alt' : ''), c);
        b.onclick = () => {
          this.audio.sfx('click');
          this.closeDialogue(i);
        };
        d.choiceBox!.append(b);
      });
      d.el.append(d.choiceBox);
      (d.choiceBox.firstElementChild as HTMLElement).focus();
    } else if (!d.choices) {
      d.more.classList.remove('hidden');
    }
  }

  // ------------------------------------------------------------------ écrans

  private open(el: HTMLElement): void {
    this.layer.replaceChildren(el);
    this.screens.push(el);
    this.focusFirst();
  }

  private back(): void {
    this.screens.pop();
    const prev = this.screens[this.screens.length - 1];
    if (prev) this.layer.replaceChildren(prev);
    else this.layer.replaceChildren();
    this.focusFirst();
  }

  closeScreens(): void {
    this.screens.length = 0;
    this.layer.replaceChildren();
    this.input.cancelCapture();
  }

  get hasScreen(): boolean {
    return this.screens.length > 0;
  }

  private focusables(): HTMLElement[] {
    const top = this.screens[this.screens.length - 1];
    return top ? [...top.querySelectorAll<HTMLElement>('button:not([disabled]), input')] : [];
  }

  private focusFirst(): void {
    const list = this.focusables();
    (list.find((el) => el.dataset.primary) ?? list[0])?.focus({ preventScroll: true });
  }

  private btn(label: string, fn: () => void, cls = ''): HTMLButtonElement {
    const b = h('button', 'btn ' + cls, label);
    b.onclick = () => {
      this.audio.unlock();
      this.audio.sfx('click');
      fn();
    };
    return b;
  }

  private box(title: string, wide = false): HTMLElement {
    return h('div', 'box panel' + (wide ? ' wide' : ''), h('div', 'band'), h('h3', '', title));
  }

  private screen(box: HTMLElement, cls = ''): HTMLElement {
    return h('div', 'screen ' + cls, box);
  }

  confirm(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      const box = this.box('');
      box.querySelector('h3')!.remove();
      box.append(h('p', 'big center', text));
      const done = (v: boolean): void => {
        this.back();
        resolve(v);
      };
      box.append(h('div', 'footer', this.btn(t('menu.no'), () => done(false), 'alt'), this.btn(t('menu.yes'), () => done(true))));
      this.open(this.screen(box));
    });
  }

  showTitle(): void {
    this.closeScreens();
    const hero = h('img', 'title-hero');
    hero.src = this.assets.url('hero/idle');
    hero.alt = '';
    const menu = h('div', 'menu');
    const play = this.btn(t('menu.play'), async () => {
      if (this.save.hasGame() && !(await this.confirm(t('menu.confirmNew')))) return;
      this.host.startNew();
    });
    const cont = this.btn(t('menu.continue'), () => this.host.continueGame());
    cont.disabled = !this.save.hasGame();
    (this.save.hasGame() ? cont : play).dataset.primary = '1';
    menu.append(play, cont);
    if (this.save.progress.unlocked > 1) menu.append(this.btn(t('menu.levels'), () => this.showLevels(), 'alt'));
    menu.append(this.btn(t('menu.settings'), () => this.showSettings(), 'alt'));
    const box = h('div', 'title-box', h('h1', '', t('menu.title')), h('h2', '', t('menu.subtitle')), menu, h('div', 'notice', t('menu.notice')));
    if (!this.save.persistent) box.append(h('div', 'notice', t('settings.noStorage')));
    const quick = h('div', 'lang-quick');
    for (const l of LANGS) {
      if (!l.available) continue;
      const b = this.btn(l.id.toUpperCase(), () => this.setLang(l.id, () => this.showTitle()), 'small' + (l.id === getLang() ? '' : ' alt'));
      quick.append(b);
    }
    const scr = h('div', 'screen title', hero, box, quick);
    scr.style.backgroundImage = `url(${this.assets.url('bg/village')})`;
    this.open(scr);
  }

  private setLang(lang: Lang, then: () => void): void {
    this.save.settings.lang = lang;
    this.save.saveSettings();
    this.host.settingsChanged();
    then();
  }

  showLevels(): void {
    const box = this.box(t('menu.levels'), true);
    const grid = h('div', 'levels');
    const n = this.host.levelCount();
    for (let i = 0; i < n; i++) {
      const open = i < this.save.progress.unlocked;
      const b = this.btn('', () => this.host.startLevel(i));
      b.append(h('small', '', t('hud.level', { n: i + 1 })), open ? t('level.' + (i + 1)) : '🔒 ' + t('menu.locked'));
      b.disabled = !open;
      grid.append(b);
    }
    box.append(grid, this.btn(t('menu.back'), () => this.back(), 'alt'));
    this.open(this.screen(box));
  }

  showSettings(): void {
    const s = this.save.settings;
    const changed = (): void => {
      this.save.saveSettings();
      this.host.settingsChanged();
    };
    const rerender = (): void => {
      this.screens.pop();
      this.showSettings();
    };
    const seg = <T extends string>(options: [T, string, boolean?][], value: T, set: (v: T) => void): HTMLElement => {
      const el = h('div', 'seg');
      for (const [id, label, disabled] of options) {
        const b = h('button', id === value ? 'on' : '', label);
        b.disabled = !!disabled;
        b.onclick = () => {
          this.audio.unlock();
          this.audio.sfx('click');
          set(id);
          changed();
          rerender();
        };
        el.append(b);
      }
      return el;
    };
    const slider = (value: number, set: (v: number) => void): HTMLInputElement => {
      const r = h('input');
      r.type = 'range';
      r.min = '0';
      r.max = '100';
      r.value = String(Math.round(value * 100));
      r.oninput = () => {
        this.audio.unlock();
        set(Number(r.value) / 100);
        changed();
      };
      r.onchange = () => this.audio.sfx('coin');
      return r;
    };
    const row = (label: string, ...ctl: HTMLElement[]): HTMLElement => h('div', 'row', h('span', '', label), h('div', 'ctl', ...ctl));
    const onOff = (v: boolean, set: (v: boolean) => void): HTMLElement =>
      seg<'1' | '0'>([['1', t('settings.on')], ['0', t('settings.off')]], v ? '1' : '0', (x) => set(x === '1'));

    const box = this.box(t('settings.title'), true);
    box.append(
      row(t('settings.language'), seg<Lang>(
        LANGS.map((l) => [l.id, l.available ? l.label : `${l.label} (${t('settings.soon')})`, !l.available] as [Lang, string, boolean]),
        s.lang, (v) => (s.lang = v))),
      row(t('settings.music'), onOff(s.musicOn, (v) => (s.musicOn = v)), slider(s.musicVol, (v) => (s.musicVol = v))),
      row(t('settings.sfx'), onOff(s.sfxOn, (v) => (s.sfxOn = v)), slider(s.sfxVol, (v) => (s.sfxVol = v))),
      row(t('settings.touch'), seg<'auto' | 'on' | 'off'>(
        [['auto', t('settings.auto')], ['on', t('settings.shown')], ['off', t('settings.hidden')]], s.touch, (v) => (s.touch = v))),
      row(t('settings.layout'), seg<'auto' | 'azerty' | 'qwerty'>(
        [['auto', t('settings.auto')], ['azerty', 'AZERTY'], ['qwerty', 'QWERTY']], s.layout, (v) => (s.layout = v))),
      h('h4', '', t('settings.keys')),
    );
    const grid = h('div', 'keys-grid');
    for (const a of ACTIONS) {
      const b = h('button', 'btn small alt', this.keyName(a));
      b.onclick = () => {
        this.audio.sfx('click');
        b.textContent = t('settings.press');
        this.input.captureNextKey((code) => {
          if (code !== 'Escape' || a === 'pause') {
            // Une touche ne peut servir qu'à une seule action.
            for (const other of ACTIONS) {
              if (other !== a) s.bindings[other] = s.bindings[other].filter((c) => c !== code);
              if (!s.bindings[other].length) s.bindings[other] = [DEFAULT_BINDINGS[other][0]];
            }
            s.bindings[a] = [code, ...s.bindings[a].filter((c) => c !== code).slice(0, 1)];
            changed();
          }
          rerender();
        });
      };
      grid.append(h('span', '', t('action.' + a)), b);
    }
    box.append(grid);
    const erase = this.btn(t('settings.erase'), async () => {
      if (!(await this.confirm(t('settings.eraseConfirm')))) return;
      this.save.resetProgress();
      this.toast(t('settings.erased'));
    }, 'small danger');
    erase.disabled = !!this.game?.stage;
    box.append(h('div', 'footer',
      this.btn(t('settings.resetKeys'), () => {
        s.bindings = cloneBindings(DEFAULT_BINDINGS);
        changed();
        rerender();
      }, 'small alt'),
      erase));
    const back = this.btn(t('menu.back'), () => {
      this.input.cancelCapture();
      this.back();
      // L'écran précédent a pu être construit dans une autre langue : on le reconstruit.
      if (!this.screens.length && !this.game?.stage) this.showTitle();
      else if (this.screens.length === 1 && !this.game?.stage) this.showTitle();
      else if (this.game?.stage) {
        this.closeScreens();
        this.showPause();
      }
    });
    back.dataset.primary = '1';
    box.append(h('div', 'footer', back));
    this.open(this.screen(box));
  }

  showPause(): void {
    this.closeScreens();
    const box = this.box(t('pause.title'));
    const resume = this.btn(t('pause.resume'), () => this.host.resume());
    resume.dataset.primary = '1';
    const menu = h('div', 'menu', resume,
      this.btn(t('pause.quests'), () => this.showQuests(), 'alt'),
      this.btn(t('pause.controls'), () => this.showControls(), 'alt'),
      this.btn(t('menu.settings'), () => this.showSettings(), 'alt'),
      this.btn(t('pause.restart'), () => this.host.restartCheckpoint(), 'alt'),
      this.btn(t('pause.quit'), () => this.host.quitToMenu(), 'danger'));
    box.append(menu, h('div', 'notice center', t('menu.notice')));
    this.open(this.screen(box));
  }

  private showQuests(): void {
    const g = this.game!;
    const box = this.box(t('pause.quests'), true);
    const add = (title: string, main: boolean): void => {
      box.append(h('h4', '', title));
      let n = 0;
      for (const [id, q] of Object.entries(QUESTS)) {
        if (!!q.main !== main || !g.progress.quests[id]) continue;
        const done = g.questDone(id);
        box.append(h('div', 'quest' + (done ? ' done' : ''),
          h('b', '', t(q.title) + (done ? ` — ${t('pause.done')}` : '')),
          done ? null : h('span', '', t(q.detail(g)))));
        n++;
      }
      if (!n) box.append(h('p', '', t('pause.none')));
    };
    add(t('pause.questMain'), true);
    add(t('pause.questSide'), false);
    const clues = knownClues(g);
    if (clues.length) {
      box.append(h('h4', '', t('pause.clues')), h('p', '', clues.map((c) => t(c)).join(', ') + '…'));
    }
    box.append(h('div', 'footer', this.btn(t('menu.back'), () => this.back())));
    this.open(this.screen(box));
  }

  private showControls(): void {
    const box = this.box(t('pause.controls'), true);
    const grid = h('div', 'keys-grid');
    for (const a of ACTIONS) {
      const keys = h('span');
      for (const code of this.input.bindings[a]) {
        keys.append(h('kbd', '', keyLabel(code, this.host.layout(), { space: t('key.space'), enter: t('key.enter'), escape: t('key.escape') })));
      }
      grid.append(h('span', '', t('action.' + a)), keys);
    }
    box.append(grid, h('p', '', t('pause.touchHelp')), h('p', '', t('pause.padHelp')),
      h('div', 'footer', this.btn(t('menu.back'), () => this.back())));
    this.open(this.screen(box));
  }

  private time(s: number): string {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  levelEnd(st: LevelStats): Promise<void> {
    return new Promise((resolve) => {
      this.closeScreens();
      const box = this.box(t('end.level'));
      box.append(
        h('p', 'center big', `${t('hud.level', { n: st.number })} — ${st.name}`),
        h('div', 'stats',
          h('span', '', t('end.time')), h('b', '', this.time(st.time)),
          h('span', '', t('end.coins')), h('b', '', String(st.coins)),
          h('span', '', t('end.bonus')), h('b', '', '+' + st.bonus),
          h('span', '', t('end.score')), h('b', '', String(st.score))),
      );
      const next = this.btn(t(st.last ? 'end.finish' : 'end.next'), () => {
        this.closeScreens();
        resolve();
      });
      next.dataset.primary = '1';
      box.append(next);
      this.open(this.screen(box));
    });
  }

  adventureEnd(st: { score: number; coins: number; time: number; gems: number }): Promise<void> {
    return new Promise((resolve) => {
      this.closeScreens();
      const box = this.box(t('end.adventure'), true);
      box.append(
        h('p', 'center big', t('end.text1')),
        h('p', 'center big', t('end.text2')),
        h('div', 'stats',
          h('span', '', t('end.score')), h('b', '', String(st.score)),
          h('span', '', t('end.coins')), h('b', '', String(st.coins)),
          h('span', '', t('end.gems')), h('b', '', String(st.gems)),
          h('span', '', t('end.time')), h('b', '', this.time(st.time))),
        h('h4', 'center', t('end.toBeContinued')),
        h('p', 'center', t('end.thanks')),
        h('div', 'notice center', t('menu.notice')),
      );
      const done = this.btn(t('end.menu'), () => {
        this.closeScreens();
        resolve();
      });
      done.dataset.primary = '1';
      box.append(h('div', 'footer', done));
      const scr = this.screen(box, 'title');
      scr.style.backgroundImage = `url(${this.assets.url('bg/village')})`;
      this.open(scr);
    });
  }

  defeat(): Promise<void> {
    return new Promise((resolve) => {
      const box = this.box(t('defeat.title'));
      box.append(h('p', 'center big', t('defeat.text')));
      this.open(this.screen(box));
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        this.waitKey = null;
        this.closeScreens();
        resolve();
      };
      window.setTimeout(() => (this.waitKey = finish), 500);
      window.setTimeout(finish, 2400);
    });
  }

  // ------------------------------------------------------------------ mise à jour par image

  /** À appeler à chaque image : texte des dialogues, navigation au clavier, position des invites. */
  update(dt: number): void {
    const input = this.input;
    const ok = input.wasPressed('interact') || input.wasPressed('jump');
    const d = this.dlg;
    if (d) {
      if (d.shown < d.text.length) {
        d.shown = Math.min(d.text.length, d.shown + dt * 60);
        d.line.textContent = d.text.slice(0, Math.floor(d.shown));
        this.blip -= dt;
        if (this.blip <= 0) {
          this.blip = 0.055;
          this.audio.sfx('blip');
        }
        if (d.shown >= d.text.length) this.dialogueReady(d);
        if (ok) this.advance();
      } else if (d.choices && d.choiceBox) {
        const btns = [...d.choiceBox.querySelectorAll('button')];
        const i = Math.max(0, btns.indexOf(document.activeElement as HTMLButtonElement));
        if (input.wasPressed('right') || input.wasPressed('down')) btns[(i + 1) % btns.length].focus();
        if (input.wasPressed('left') || input.wasPressed('up')) btns[(i + btns.length - 1) % btns.length].focus();
        if (ok) btns[i].click();
      } else if (ok) {
        this.advance();
      }
    } else if (this.screens.length) {
      const list = this.focusables();
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (input.wasPressed('down')) list[(i + 1) % list.length]?.focus();
      if (input.wasPressed('up')) list[(i + list.length - 1) % list.length]?.focus();
      if (ok) {
        if (this.waitKey) this.waitKey();
        else if (i >= 0 && list[i].tagName === 'BUTTON') list[i].click();
      }
    }
    if (this.promptPos && this.game) {
      const s = this.game.view.toScreen(this.promptPos.x, this.promptPos.y);
      this.promptEl.style.left = s.x + 'px';
      this.promptEl.style.top = s.y + 'px';
    }
  }
}
