/**
 * Outil de construction des niveaux : quelques fonctions courtes (sol, plateforme, liane, pièces…)
 * qui remplissent une description de niveau. Un nouveau chapitre se crée en écrivant un fichier
 * comme niveau1.ts, puis en l'ajoutant à la liste de levels/index.ts.
 */
import type {
  ChestDef, DecorDef, DoorDef, EnemyDef, EnemyKind, ItemDef, ItemKind, LevelDef, MoverDef, NpcDef, SignDef,
  SolidDef, SolidStyle, TargetDef, ThemeDef, TriggerDef,
} from '../types';
import type { Game } from '../Game';
import { rng } from '../../core/math';

const TURQUOISE = { shallow: 0x35d0c8, deep: 0x0b5f86, glint: 0xf4fff0 };

export const THEMES: Record<string, ThemeDef> = {
  village: {
    backdrop: 'bg/village', sky: 0x6bb6ff, earth: 0xb86b3d, water: TURQUOISE,
    music: 'village', ambience: ['oiseaux', 'village', 'vent'], alignLow: 0.5, alignHigh: 0.75,
  },
  arbres: {
    backdrop: 'bg/village', sky: 0x7cc4ff, earth: 0x9a6238, water: TURQUOISE,
    music: 'arbres', ambience: ['oiseaux', 'vent'], alignLow: 0.3, alignHigh: 1, skyAt: 46,
  },
  riviere: {
    backdrop: 'bg/riviere', sky: 0x62b4f5, earth: 0xa86a42, water: TURQUOISE,
    music: 'riviere', ambience: ['eau', 'oiseaux'], alignLow: 0.62, alignHigh: 0.85,
  },
  savane: {
    backdrop: 'bg/savane', sky: 0x76bdf8, earth: 0xc0703c, water: TURQUOISE,
    music: 'savane', ambience: ['vent', 'oiseaux'], alignLow: 0.6, alignHigh: 0.85,
  },
  mangrove: {
    backdrop: 'bg/mangrove', sky: 0xf2a56c, earth: 0x8a6240, water: { shallow: 0x3cc9b4, deep: 0x0c5a68, glint: 0xffe9b8 },
    music: 'mangrove', ambience: ['eau', 'oiseaux'], alignLow: 0.62, alignHigh: 0.85,
  },
  grotte: {
    backdrop: 'bg/grotte', sky: 0x1c1445, earth: 0x7a5a78, water: { shallow: 0x3a7fd8, deep: 0x10184a, glint: 0xd8e4ff },
    music: 'grotte', ambience: ['nuit', 'cascade'], night: true, light: 0xcfc4ff, alignLow: 0.55, alignHigh: 0.8,
  },
  fete: {
    backdrop: 'bg/village', tint: 0x8f7fd0, sky: 0x2a1c55, earth: 0x9a5c48, water: { shallow: 0x4a8fd8, deep: 0x14205a, glint: 0xffe0a8 },
    music: 'village', ambience: ['nuit', 'village'], night: true, light: 0xe6d2ff, alignLow: 0.5, alignHigh: 0.75,
  },
};

/** Ambiance d'un intérieur : musique du lieu d'où l'on vient, murmure du village. */
export function roomTheme(base: ThemeDef, ambience: ThemeDef['ambience']): ThemeDef {
  return { ...base, sky: 0x2a1408, ambience, night: false, light: undefined, tint: undefined };
}

export interface BuildOpts {
  width: number;
  top?: number;
  bottom?: number;
  viewH?: number;
  spawn?: { x: number; y: number };
}

export class LevelBuilder {
  readonly def: LevelDef;
  /** Profondeur jusqu'à laquelle descend la terre sous les sols. */
  readonly deep: number;
  private rand: () => number;

  constructor(id: string, number: number, name: string, theme: ThemeDef, o: BuildOpts) {
    const bottom = o.bottom ?? -2.7;
    this.deep = bottom - 9;
    this.rand = rng(number * 977 + id.length * 31 + 5);
    this.def = {
      id, number, name, kind: 'level', theme,
      bounds: { minX: 0, maxX: o.width, minY: bottom, maxY: o.top ?? 13 },
      spawn: o.spawn ?? { x: 3, y: 0.05 },
      viewH: o.viewH ?? 9.5,
      solids: [], movers: [], climbs: [], hangs: [], waters: [], decor: [], items: [], chests: [], enemies: [],
      npcs: [], doors: [], checkpoints: [], triggers: [], targets: [], signs: [], falls: [], trunks: [],
    };
    // Murs invisibles aux deux bouts du niveau.
    this.solid(-3, 60, 3, 80, 'none');
    this.solid(o.width, 60, 3, 80, 'none');
  }

  solid(x: number, y: number, w: number, h: number, style: SolidStyle, extra: Partial<SolidDef> = {}): SolidDef {
    const s: SolidDef = { x, y, w, h, style, ...extra };
    this.def.solids.push(s);
    return s;
  }

  /** Sol principal : muret de pierre et terre jusqu'en bas de l'écran. */
  ground(x0: number, x1: number, y = 0): this {
    this.solid(x0, y, x1 - x0, y - this.deep, 'stone', { fillTo: this.deep });
    return this;
  }

  /** Rebord de pierre dont la terre s'arrête à `bottom` (au-dessus de l'eau ou du vide). */
  ledge(x0: number, x1: number, y: number, bottom: number): this {
    this.solid(x0, y, x1 - x0, y - bottom, 'stone', { fillTo: bottom });
    return this;
  }

  /** Plateforme traversable par le dessous : dalle à motifs, pilotis, pierre de gué… */
  plat(x: number, y: number, w = 2.8, style: SolidStyle = 'motif', extra: Partial<SolidDef> = {}): this {
    this.solid(x, y, w, 0.4, style, { oneWay: true, ...extra });
    return this;
  }

  /** Branche d'arbre ; `trunk` indique de quel côté se trouve le tronc ; `hang` permet de s'y suspendre. */
  branch(x: number, y: number, w: number, trunk: 'left' | 'right' = 'left', hang = false): this {
    this.solid(x, y, w, 0.4, 'branch', { oneWay: true, flip: trunk === 'right' });
    if (hang) this.def.hangs.push({ x0: x + 0.5, x1: x + w - 0.5, y: y - 0.5 });
    // Quelques touffes de feuilles au bout et sous la branche.
    const tip = trunk === 'left' ? x + w - 0.5 : x + 0.5;
    const dir = trunk === 'left' ? 1 : -1;
    this.leaves(tip + dir * 0.5, y + 0.25, 1.2 + this.rand() * 0.5, -0.5, trunk === 'right', 'b');
    this.leaves(tip - dir * (1.2 + this.rand() * 1.5), y - 0.55, 1.0 + this.rand() * 0.4, -0.6, this.rand() > 0.5, 'a');
    if (w > 7) this.leaves(tip - dir * (w * 0.5), y + 0.7, 1.1, -0.7, this.rand() > 0.5, 'a');
    return this;
  }

  bridge(x0: number, x1: number, y = 0): this {
    this.solid(x0, y, x1 - x0, 0.4, 'bridge', { oneWay: true });
    return this;
  }

  /** Plateforme mobile (pirogue, dalle) : aller-retour de (dx, dy) en `period` secondes. */
  mover(x: number, y: number, w: number, style: SolidStyle, dx: number, dy: number, period: number, phase = 0): this {
    const m: MoverDef = { x, y, w, h: 0.4, style, oneWay: true, dx, dy, period, phase };
    this.def.movers.push(m);
    return this;
  }

  liane(x: number, y0: number, y1: number): this {
    this.def.climbs.push({ x, y0, y1, style: 'liane' });
    return this;
  }

  ladder(x: number, y0: number, y1: number): this {
    this.def.climbs.push({ x, y0, y1, style: 'echelle' });
    return this;
  }

  water(x0: number, x1: number, y = -1.2): this {
    this.def.waters.push({ x0, x1, y });
    return this;
  }

  fall(x: number, y: number, w: number, h: number, z = -1.5, opacity = 1): this {
    this.def.falls.push({ x, y, w, h, z, opacity });
    return this;
  }

  trunk(x: number, w: number, y0: number, y1: number): this {
    this.def.trunks.push({ x, w, y0, y1 });
    return this;
  }

  // ------------------------------------------------------------------ objets

  item(kind: ItemKind, x: number, y: number, extra: Partial<ItemDef> = {}): this {
    this.def.items.push({ kind, x, y, ...extra });
    return this;
  }

  /** Rangée de pièces. */
  coins(x: number, y: number, n: number, dx = 0.85, dy = 0): this {
    for (let i = 0; i < n; i++) this.item('coin', x + i * dx, y + i * dy);
    return this;
  }

  /** Pièces en arc, pour guider un saut. */
  arc(x0: number, x1: number, y: number, height: number, n: number): this {
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0.5 : i / (n - 1);
      this.item('coin', x0 + (x1 - x0) * k, y + Math.sin(k * Math.PI) * height);
    }
    return this;
  }

  chest(id: string, x: number, y: number, loot: ChestDef['loot'], extra: Partial<ChestDef> = {}): this {
    this.def.chests.push({ id, x, y, loot, ...extra });
    return this;
  }

  enemy(kind: EnemyKind, x: number, y: number, extra: Partial<EnemyDef> = {}): this {
    this.def.enemies.push({ kind, x, y, ...extra });
    return this;
  }

  npc(def: NpcDef): this {
    this.def.npcs.push(def);
    return this;
  }

  door(def: DoorDef): this {
    this.def.doors.push(def);
    return this;
  }

  checkpoint(x: number, y = 0): this {
    this.def.checkpoints.push({ x, y });
    return this;
  }

  sign(x: number, y: number, text: string, keys: string[] = []): this {
    const s: SignDef = { x, y, text, keys };
    this.def.signs.push(s);
    return this;
  }

  trigger(id: string, x0: number, x1: number, run: TriggerDef['run'], extra: Partial<TriggerDef> = {}): this {
    this.def.triggers.push({ id, x0, x1, run, ...extra });
    return this;
  }

  target(def: TargetDef): this {
    this.def.targets.push(def);
    return this;
  }

  exit(x: number, y = 0, canLeave?: (g: Game) => boolean, lockedText?: string): this {
    this.def.exit = { x, y, canLeave, lockedText };
    return this;
  }

  // ------------------------------------------------------------------ décors

  decor(img: string, x: number, y: number, h: number, extra: Partial<DecorDef> = {}): this {
    this.def.decor.push({ img, x, y, h, ...extra });
    return this;
  }

  baobab(x: number, y = 0, h = 9, z = -5): this {
    return this.decor('props/baobab', x, y - 0.4, h, { z });
  }

  acacia(x: number, y = 0, h = 5.5, z = -6): this {
    return this.decor('props/acacia', x, y - 0.3, h, { z });
  }

  hut(x: number, y = 0, h = 4, z = -3, flip = false): this {
    return this.decor('props/case', x, y - 0.3, h, { z, flip });
  }

  bush(x: number, y = 0, h = 1.2, z = -0.5, flip = false): this {
    return this.decor('props/buisson_fleurs', x, y - 0.12, h, { z, flip });
  }

  rock(x: number, y = 0, h = 1.0, z = -0.6, flip = false): this {
    return this.decor('props/rocher', x, y - 0.1, h, { z, flip });
  }

  pot(x: number, y = 0, h = 0.9, z = -0.4): this {
    return this.decor('props/pot', x, y - 0.03, h, { z });
  }

  /** Lanterne suspendue, avec son halo. */
  lantern(x: number, y: number, z = -0.6, h = 0.95): this {
    return this.decor('items/lanterne', x, y, h, { z, center: true, sway: 0.05, glow: { color: 0xffb84d, size: h * 3.6 } });
  }

  /** Masse de feuillage : grappes de feuilles réparties dans un ovale de hauteur h. */
  foliage(x: number, y: number, h = 3, z = -2, flip = false, opacity = 1): this {
    const w = h * 2.4;
    const n = Math.round(6 + h * 1.5);
    const tint = z < -1.5 ? 0xb9d8a8 : 0xffffff;
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const k = Math.sqrt(this.rand());
      this.def.decor.push({
        img: this.rand() > 0.5 ? 'props/feuilles_a' : 'props/feuilles_b',
        x: x + Math.cos(a) * k * w * 0.5,
        y: y + h * 0.5 + Math.sin(a) * k * h * 0.5,
        h: 1.2 + this.rand() * 1.1,
        z: z - this.rand() * 0.3,
        flip: flip !== this.rand() > 0.5,
        center: true,
        opacity,
        tint,
        sway: 0.02 + this.rand() * 0.02,
      });
    }
    return this;
  }

  /** Touffe de feuilles (deux variantes), pour habiller les branches. */
  leaves(x: number, y: number, h = 1.3, z = -0.4, flip = false, variant: 'a' | 'b' = 'a'): this {
    return this.decor('props/feuilles_' + variant, x, y, h, { z, flip, center: true, sway: 0.03 });
  }

  /** Nuage doux, dessiné par le code. */
  cloud(x: number, y: number, h = 2.4, z = -30): this {
    return this.decor('fx/nuage', x, y, h, { z, center: true, opacity: 0.9, fly: { speed: 0.35, range: 40, bob: 0.2 } });
  }

  lily(x: number, y: number, h = 0.32): this {
    return this.decor('props/nenuphar', x, y - 0.1, h, { z: 0.33 });
  }

  /** Oiseau qui traverse le ciel en boucle. */
  bird(x: number, y: number, img = 'props/grue_vol', h = 1.2, z = -9, speed = 2.2, range = 30): this {
    return this.decor(img, x, y, h, { z, center: true, fly: { speed, range, bob: 0.5 } });
  }

  /** Sème des buissons, rochers et pots le long d'un sol pour l'habiller. */
  dress(x0: number, x1: number, y = 0, density = 0.22): this {
    for (let x = x0 + 1; x < x1 - 1; x += 1 + this.rand() * 2.2) {
      if (this.rand() > density) continue;
      const k = this.rand();
      const front = this.rand() > 0.6;
      const z = front ? 0.7 + this.rand() * 0.8 : -0.5 - this.rand() * 0.8;
      const yy = front ? y - 0.95 : y;
      if (k < 0.45) this.bush(x, yy, 0.9 + this.rand() * 0.6, z, this.rand() > 0.5);
      else if (k < 0.8) this.rock(x, yy, 0.6 + this.rand() * 0.7, z, this.rand() > 0.5);
      else this.pot(x, yy, 0.7 + this.rand() * 0.4, z);
    }
    return this;
  }

  build(): LevelDef {
    return this.def;
  }
}

/** Description d'un intérieur peint. Les positions sont données en pixels de l'image d'origine. */
export interface RoomSpec {
  id: string;
  name: string;
  painting: string;
  /** Pixels de l'image par unité du monde : règle la taille du héros dans la pièce. */
  ppu: number;
  theme: ThemeDef;
  spawnPx: { x: number; y: number };
}

/** Constructeur d'intérieur : convertit les pixels du tableau en unités du monde. */
export class RoomBuilder extends LevelBuilder {
  private ppu: number;
  private imgH = 941;

  constructor(spec: RoomSpec) {
    const w = 1672 / spec.ppu;
    const h = 941 / spec.ppu;
    super(spec.id, 0, spec.name, spec.theme, { width: w, top: h, bottom: 0 });
    this.ppu = spec.ppu;
    const d = this.def;
    d.kind = 'room';
    d.indoor = true;
    d.painting = spec.painting;
    d.viewH = h;
    d.spawn = { x: this.px(spec.spawnPx.x), y: this.py(spec.spawnPx.y) + 0.02 };
  }

  /** Abscisse en unités à partir d'un pixel de l'image. */
  px(x: number): number {
    return x / this.ppu;
  }

  /** Ordonnée en unités à partir d'un pixel de l'image (l'axe vertical est inversé). */
  py(y: number): number {
    return (this.imgH - y) / this.ppu;
  }

  /** Plancher invisible posé sur le sol peint, entre deux pixels. */
  floor(x0: number, x1: number, y: number, thick = 60, oneWay = false): this {
    this.solid(this.px(x0), this.py(y), this.px(x1 - x0), thick / this.ppu, 'none', { oneWay });
    return this;
  }

  /** Échelle ou liane peinte dans le tableau : zone d'escalade sans image. */
  climbPx(x: number, yTop: number, yBottom: number): this {
    this.def.climbs.push({ x: this.px(x), y0: this.py(yBottom), y1: this.py(yTop), style: 'none' });
    return this;
  }

  /** Bassin peint dans le tableau : y tomber fait perdre un cœur. */
  poolPx(x0: number, x1: number, y: number): this {
    this.def.waters.push({ x0: this.px(x0), x1: this.px(x1), y: this.py(y), hidden: true });
    return this;
  }

  /** Mur invisible. */
  wallPx(x0: number, x1: number, yTop: number, yBottom: number): this {
    this.solid(this.px(x0), this.py(yTop), this.px(x1 - x0), (yBottom - yTop) / this.ppu, 'none');
    return this;
  }
}
