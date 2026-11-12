/**
 * Entrées du joueur : clavier (touches réaffectables, repérées par leur position physique pour que
 * AZERTY et QWERTY se comportent de la même façon), boutons tactiles et manette.
 */
export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'interact' | 'defend' | 'throw' | 'switch' | 'pause';

export const ACTIONS: readonly Action[] = [
  'left', 'right', 'up', 'down', 'jump', 'interact', 'defend', 'throw', 'switch', 'pause',
];

export type Bindings = Record<Action, string[]>;
export type Layout = 'azerty' | 'qwerty';

export const DEFAULT_BINDINGS: Bindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space'],
  interact: ['KeyE', 'Enter'],
  defend: ['KeyK', 'KeyC'],
  throw: ['KeyJ', 'KeyX'],
  switch: ['KeyL', 'KeyR'],
  pause: ['Escape', 'KeyP'],
};

export function cloneBindings(b: Bindings): Bindings {
  const out = {} as Bindings;
  for (const a of ACTIONS) out[a] = [...(b[a] ?? DEFAULT_BINDINGS[a])];
  return out;
}

/** Lettres qui changent de place entre un clavier QWERTY (référence des codes) et un clavier AZERTY. */
const AZERTY: Record<string, string> = {
  KeyA: 'Q', KeyQ: 'A', KeyW: 'Z', KeyZ: 'W', KeyM: ',', Semicolon: 'M', Comma: ';', Period: ':', Slash: '!',
};

const NAMED: Record<string, string> = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  ShiftLeft: 'Maj', ShiftRight: 'Maj', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt',
  Tab: 'Tab', Backspace: '⌫', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Backquote: '`', Backslash: '\\',
};

/** Nom affiché d'une touche. `words` fournit les libellés traduits des touches nommées. */
export function keyLabel(code: string, layout: Layout, words: { space: string; enter: string; escape: string }): string {
  if (code === 'Space') return words.space;
  if (code === 'Enter' || code === 'NumpadEnter') return words.enter;
  if (code === 'Escape') return words.escape;
  if (layout === 'azerty' && AZERTY[code]) return AZERTY[code];
  if (NAMED[code]) return NAMED[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

/** Devine la disposition du clavier : API du navigateur si elle existe, sinon langue du système. */
export async function detectLayout(): Promise<Layout> {
  try {
    const kb = (navigator as unknown as { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard;
    if (kb?.getLayoutMap) {
      const map = await kb.getLayoutMap();
      const a = map.get('KeyA');
      if (a) return a.toLowerCase() === 'q' ? 'azerty' : 'qwerty';
    }
  } catch {
    /* API indisponible : on se rabat sur la langue. */
  }
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'fr';
  return /^fr/i.test(lang) && !/^fr-CA/i.test(lang) ? 'azerty' : 'qwerty';
}

export class Input {
  bindings: Bindings = cloneBindings(DEFAULT_BINDINGS);
  /** Mis à vrai dès qu'un écran tactile est utilisé : sert à afficher les bonnes aides. */
  touchUsed = false;
  gamepadUsed = false;

  private keys = new Set<string>();
  private virtual = new Set<Action>();
  private pad = new Set<Action>();
  private state = {} as Record<Action, boolean>;
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private capture: ((code: string) => void) | null = null;
  private enabled = true;

  constructor(target: Window | null = typeof window !== 'undefined' ? window : null) {
    for (const a of ACTIONS) this.state[a] = false;
    if (!target) return;
    target.addEventListener('keydown', (e) => this.onKey(e as KeyboardEvent, true));
    target.addEventListener('keyup', (e) => this.onKey(e as KeyboardEvent, false));
    target.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (this.capture) {
      if (down) {
        e.preventDefault();
        const cb = this.capture;
        this.capture = null;
        cb(e.code);
      }
      return;
    }
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
    let used = false;
    for (const a of ACTIONS) if (this.bindings[a].includes(e.code)) used = true;
    if (used || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') {
      if (!(e.ctrlKey || e.metaKey || e.altKey)) e.preventDefault();
    }
    if (down) {
      if (e.repeat) return;
      this.keys.add(e.code);
    } else {
      this.keys.delete(e.code);
    }
    this.refresh();
  }

  /** Attend la prochaine touche (écran de réaffectation des commandes). */
  captureNextKey(cb: (code: string) => void): void {
    this.capture = cb;
  }

  cancelCapture(): void {
    this.capture = null;
  }

  setVirtual(action: Action, down: boolean): void {
    this.touchUsed = true;
    if (down) this.virtual.add(action);
    else this.virtual.delete(action);
    this.refresh();
  }

  /** Appui bref simulé (boutons de l'interface, tests). */
  tap(action: Action): void {
    this.pressed.add(action);
  }

  releaseAll(): void {
    this.keys.clear();
    this.virtual.clear();
    this.pad.clear();
    this.refresh();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.pressed.clear();
      this.released.clear();
    }
  }

  private refresh(): void {
    for (const a of ACTIONS) {
      let down = this.virtual.has(a) || this.pad.has(a);
      if (!down) for (const code of this.bindings[a]) if (this.keys.has(code)) down = true;
      if (down !== this.state[a]) {
        this.state[a] = down;
        (down ? this.pressed : this.released).add(a);
      }
    }
  }

  /** Lecture de la manette (disposition standard). À appeler une fois par image. */
  pollGamepad(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    let gp: Gamepad | null = null;
    for (const g of navigator.getGamepads()) if (g && g.connected && g.mapping === 'standard') gp = g;
    const next = new Set<Action>();
    if (gp) {
      const b = (i: number): boolean => !!gp!.buttons[i]?.pressed;
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      if (ax < -0.4 || b(14)) next.add('left');
      if (ax > 0.4 || b(15)) next.add('right');
      if (ay < -0.5 || b(12)) next.add('up');
      if (ay > 0.5 || b(13)) next.add('down');
      if (b(0)) next.add('jump');
      if (b(2)) next.add('throw');
      if (b(1)) next.add('defend');
      if (b(3)) next.add('interact');
      if (b(4) || b(5)) next.add('switch');
      if (b(9)) next.add('pause');
      if (next.size) this.gamepadUsed = true;
    }
    let changed = next.size !== this.pad.size;
    if (!changed) for (const a of next) if (!this.pad.has(a)) changed = true;
    if (changed) {
      this.pad = next;
      this.refresh();
    }
  }

  isDown(a: Action): boolean {
    return this.enabled && this.state[a];
  }

  wasPressed(a: Action): boolean {
    return this.enabled && this.pressed.has(a);
  }

  wasReleased(a: Action): boolean {
    return this.enabled && this.released.has(a);
  }

  /** Retire un appui déjà traité, pour qu'il ne déclenche pas deux actions. */
  consume(a: Action): void {
    this.pressed.delete(a);
  }

  /** À appeler après chaque pas de simulation : les fronts ne sont vus qu'une fois. */
  endStep(): void {
    this.pressed.clear();
    this.released.clear();
  }

  axisX(): number {
    return (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
  }

  axisY(): number {
    return (this.isDown('up') ? 1 : 0) - (this.isDown('down') ? 1 : 0);
  }
}
