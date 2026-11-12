/**
 * Objets du monde : projectiles, objets à ramasser, coffres, points de sauvegarde, habitants,
 * portes, cibles et la jeune amie qui accompagne le héros.
 */
import * as THREE from 'three';
import type { Game } from './Game';
import type { Stage } from './Stage';
import type { ChestDef, DoorDef, ItemDef, ItemKind, NpcDef, TargetDef } from './types';
import { type Body, makeBody, moveBody, groundBelow, wallAhead } from './physics';
import { CharacterView } from '../render/characters';
import { AMIE, CHARACTERS } from './characterDefs';
import { glowSprite, imageSprite, makeSprite } from '../render/sprites';
import { approach, clamp } from '../core/math';
import { t } from '../i18n';

/** Élément avec lequel le joueur peut interagir (touche « interagir »). */
export interface Interactable {
  x: number;
  y: number;
  reach: number;
  /** Hauteur de l'invite au-dessus de y. */
  promptY: number;
  label(): string;
  available(): boolean;
  interact(): void;
}

// ----------------------------------------------------------------------------- projectiles

export interface ProjectileSpec {
  kind: 'banana' | 'stone' | 'sling';
  owner: 'player' | 'enemy';
  x: number;
  y: number;
  vx: number;
  vy: number;
  grav: number;
}

export class Projectile {
  alive = true;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: ProjectileSpec['kind'];
  owner: ProjectileSpec['owner'];
  readonly radius: number;
  private grav: number;
  private life = 4;
  private mesh: THREE.Mesh;
  private spin: number;

  constructor(private stage: Stage, s: ProjectileSpec) {
    this.x = s.x;
    this.y = s.y;
    this.vx = s.vx;
    this.vy = s.vy;
    this.grav = s.grav;
    this.kind = s.kind;
    this.owner = s.owner;
    const banana = s.kind === 'banana';
    const size = banana ? 0.5 : s.kind === 'sling' ? 0.26 : 0.34;
    this.radius = size * 0.42;
    this.mesh = imageSprite(stage.game.assets, banana ? 'items/banane' : 'items/pierre', size, { order: 12 });
    this.mesh.position.set(this.x, this.y, 0.25);
    this.spin = (banana ? 9 : 14) * (s.vx >= 0 ? -1 : 1);
    stage.root.add(this.mesh);
  }

  /** Renvoi par la défense du héros : le projectile repart vers les ennemis. */
  deflect(dir: number): void {
    this.owner = 'player';
    this.vx = Math.abs(this.vx) * 1.15 * dir + dir * 3;
    this.vy = Math.abs(this.vy) * 0.4 + 3;
    this.life = 3;
  }

  update(dt: number): void {
    const st = this.stage;
    this.vy -= this.grav * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.mesh.rotation.z += this.spin * dt;
    this.mesh.position.set(this.x, this.y, 0.25);
    if (this.life <= 0 || this.y < st.def.bounds.minY - 6) return this.remove();
    const w = st.waterAt(this.x);
    if (w && this.y < w.y) {
      st.splash(this.x, w.y, 0.5);
      return this.remove();
    }
    for (const s of st.solids) {
      if (s.off || s.oneWay) continue;
      if (this.x > s.x0 && this.x < s.x1 && this.y > s.y0 && this.y < s.y1) {
        st.fx.soft.burst({ x: this.x, y: this.y, count: 4, speed: 1.5, life: 0.35, size: 0.3, color: 0xd9c4a0 });
        // Ce que lancent les singes retombe au sol et peut être ramassé.
        if (this.owner === 'enemy' && this.vy < 0 && this.y > s.y1 - 0.5) {
          st.spawnPickup({ kind: this.kind === 'banana' ? 'banana' : 'stone', x: this.x, y: s.y1 + 0.3 }, { ttl: 9 });
        } else if (this.owner === 'player') {
          st.game.audio.sfx('bonk', 0.5);
        }
        return this.remove();
      }
    }
  }

  remove(): void {
    this.alive = false;
    this.mesh.removeFromParent();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// ----------------------------------------------------------------------------- objets à ramasser

const ITEM_LOOK: Record<ItemKind, { img: string; size: number }> = {
  coin: { img: 'items/piece', size: 0.5 },
  banana: { img: 'items/banane', size: 0.55 },
  bunch: { img: 'items/banane', size: 0.8 },
  stone: { img: 'items/pierre', size: 0.42 },
  pile: { img: 'items/pierre', size: 0.62 },
  heart: { img: 'items/coeur', size: 0.58 },
  gem: { img: 'items/gemme', size: 0.62 },
  feather: { img: 'items/plume', size: 0.7 },
  key: { img: 'items/cle', size: 0.7 },
  shield: { img: 'items/bouclier', size: 0.75 },
  gourd: { img: 'items/gourde', size: 0.62 },
  quest: { img: 'items/parchemin', size: 0.6 },
};

export function itemImage(def: ItemDef): string {
  return def.kind === 'quest' && def.img ? def.img : ITEM_LOOK[def.kind].img;
}

export class Pickup {
  alive = true;
  x: number;
  y: number;
  private baseY: number;
  private vy = 0;
  private vx = 0;
  private ttl: number;
  private t = Math.random() * 6;
  private mesh: THREE.Mesh;
  private glow: THREE.Mesh | null = null;
  private delay: number;

  constructor(private stage: Stage, readonly def: ItemDef, o: { ttl?: number; pop?: boolean } = {}) {
    this.x = def.x;
    this.y = this.baseY = def.y;
    this.ttl = o.ttl ?? Infinity;
    this.delay = o.pop ? 0.35 : 0;
    if (o.pop) {
      this.vx = (Math.random() - 0.5) * 5;
      this.vy = 6 + Math.random() * 3;
    }
    const look = ITEM_LOOK[def.kind];
    this.mesh = imageSprite(stage.game.assets, itemImage(def), look.size, { order: 10, color: def.tint });
    this.mesh.position.set(this.x, this.y, 0.15);
    stage.root.add(this.mesh);
    if (def.kind === 'gem' || def.kind === 'key' || def.kind === 'feather' || def.kind === 'quest' || def.kind === 'shield') {
      this.glow = glowSprite(look.size * 2.6, def.tint ?? 0xffe08a, 0.5);
      this.glow.position.set(this.x, this.y, 0.12);
      stage.root.add(this.glow);
    }
  }

  update(dt: number): void {
    const st = this.stage;
    this.t += dt;
    this.delay = Math.max(0, this.delay - dt);
    if (this.ttl !== Infinity) {
      this.ttl -= dt;
      if (this.ttl <= 0) return this.remove();
      this.mesh.visible = this.ttl > 2 || Math.floor(this.ttl * 8) % 2 === 0;
    }
    if (this.vy !== 0 || this.vx !== 0) {
      // Objet éjecté d'un coffre ou lâché par un ennemi : il retombe puis se pose.
      this.vy -= 22 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.vy < 0 && this.y <= this.baseY) {
        this.y = this.baseY;
        this.vy = this.vx = 0;
      }
    }
    const p = st.player;
    const dx = p.x - this.x;
    const dy = p.y + 0.8 - this.y;
    const d2 = dx * dx + dy * dy;
    if (this.delay <= 0 && p.state !== 'gone') {
      if (d2 < 2.2 && this.def.kind === 'coin') {
        // Les pièces sont attirées par le héros.
        this.x += dx * dt * 7;
        this.y += dy * dt * 7;
        this.baseY = this.y;
      }
      if (Math.abs(dx) < 0.62 && dy > -1.15 && dy < 1.0) {
        if (st.game.collect(this.def, this.x, this.y)) return this.remove();
      }
    }
    const bob = this.vy === 0 ? Math.sin(this.t * 3) * 0.08 : 0;
    this.mesh.position.set(this.x, this.y + bob, 0.15);
    if (this.def.kind === 'coin') this.mesh.scale.x = Math.abs(Math.cos(this.t * 3.2)) * 0.5 * (245 / 256) + 0.02;
    if (this.glow) {
      this.glow.position.set(this.x, this.y + bob, 0.12);
      this.glow.scale.setScalar(ITEM_LOOK[this.def.kind].size * (2.4 + Math.sin(this.t * 4) * 0.4));
    }
  }

  remove(): void {
    this.alive = false;
    this.mesh.removeFromParent();
    (this.mesh.material as THREE.Material).dispose();
    if (this.glow) {
      this.glow.removeFromParent();
      (this.glow.material as THREE.Material).dispose();
    }
  }
}

// ----------------------------------------------------------------------------- coffre

export class Chest implements Interactable {
  x: number;
  y: number;
  reach = 1.3;
  promptY = 1.5;
  opened = false;
  private mesh: THREE.Mesh;
  private glow: THREE.Mesh;
  private t = 0;

  constructor(private stage: Stage, readonly def: ChestDef) {
    this.x = def.x;
    this.y = def.y;
    const g = stage.game;
    this.mesh = imageSprite(g.assets, 'items/coffre', 1.05, { bottom: true, order: 3 });
    this.mesh.position.set(this.x, this.y - 0.04, -0.05);
    stage.root.add(this.mesh);
    this.glow = glowSprite(2.6, 0xffd36b, 0.35);
    this.glow.position.set(this.x, this.y + 0.55, -0.08);
    stage.root.add(this.glow);
    if (g.isCollected(stage.def.id, def.id)) this.setOpened();
  }

  private setOpened(): void {
    this.opened = true;
    (this.mesh.material as THREE.MeshBasicMaterial).color.setScalar(0.55);
    this.glow.visible = false;
  }

  label(): string {
    return t('prompt.open');
  }

  available(): boolean {
    return !this.opened;
  }

  interact(): void {
    const g = this.stage.game;
    if (this.opened) return;
    if (this.def.locked && g.flag('smallKey') <= 0) {
      g.audio.sfx('wrong');
      g.toast('toast.chestLocked');
      return;
    }
    if (this.def.locked) g.addFlag('smallKey', -1);
    this.setOpened();
    g.markCollected(this.stage.def.id, this.def.id);
    g.audio.sfx('chest');
    g.addScore(100);
    this.stage.fx.spark.burst({ x: this.x, y: this.y + 0.7, count: 22, speed: 5, life: 0.9, size: 0.3, color: 0xffe28a, gravity: 3 });
    this.stage.fx.star.burst({ x: this.x, y: this.y + 0.7, count: 8, speed: 4, life: 0.8, size: 0.35, color: 0xfff6c8, gravity: 4 });
    const loot = this.def.loot;
    const drop = (kind: ItemKind, n: number): void => {
      for (let i = 0; i < n; i++) this.stage.spawnPickup({ kind, x: this.x, y: this.y + 0.5 }, { pop: true });
    };
    drop('coin', loot.coins ?? 0);
    drop('heart', loot.heart ?? 0);
    drop('banana', loot.bananas ?? 0);
    drop('stone', loot.stones ?? 0);
    if (loot.gem) this.stage.spawnPickup({ kind: 'gem', x: this.x, y: this.y + 0.5, id: this.def.id + '.gem' }, { pop: true });
    if (loot.feather) this.stage.spawnPickup({ kind: 'feather', x: this.x, y: this.y + 0.5, id: this.def.id + '.plume' }, { pop: true });
    if (loot.key) this.stage.spawnPickup({ kind: 'key', x: this.x, y: this.y + 0.5, id: this.def.id + '.cle' }, { pop: true });
    if (this.def.onOpen) void this.def.onOpen(g);
  }

  update(dt: number): void {
    this.t += dt;
    if (!this.opened) (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(this.t * 3) * 0.1;
  }
}

// ----------------------------------------------------------------------------- point de sauvegarde

export class Checkpoint {
  lit = false;
  private lantern: THREE.Mesh;
  private glow: THREE.Mesh;
  private t = 0;

  constructor(private stage: Stage, readonly index: number, readonly x: number, readonly y: number) {
    const g = stage.game;
    // Un piquet (liane) et une lanterne : éteinte tant que le point n'est pas activé.
    const post = imageSprite(g.assets, 'props/liane', 1.9, { bottom: true, color: stage.lightColor });
    post.position.set(x, y - 0.05, -0.12);
    stage.root.add(post);
    this.lantern = imageSprite(g.assets, 'items/lanterne', 0.95, { order: 4 });
    this.lantern.position.set(x + 0.32, y + 1.25, -0.1);
    (this.lantern.material as THREE.MeshBasicMaterial).color.setScalar(0.42);
    stage.root.add(this.lantern);
    this.glow = glowSprite(3.2, 0xffc45e, 0);
    this.glow.position.set(x + 0.32, y + 1.2, -0.11);
    stage.root.add(this.glow);
  }

  light(silent = false): void {
    if (this.lit) return;
    this.lit = true;
    (this.lantern.material as THREE.MeshBasicMaterial).color.setScalar(1);
    if (!silent) {
      this.stage.fx.spark.burst({ x: this.x + 0.32, y: this.y + 1.2, count: 14, speed: 3, life: 0.7, size: 0.25, color: 0xffd98a });
      this.stage.game.audio.sfx('checkpoint');
    }
  }

  update(dt: number): void {
    this.t += dt;
    this.lantern.rotation.z = Math.sin(this.t * 1.7) * 0.06;
    const m = this.glow.material as THREE.MeshBasicMaterial;
    m.opacity = approach(m.opacity, this.lit ? 0.55 + Math.sin(this.t * 5) * 0.06 : 0, dt * 2);
    const p = this.stage.player;
    if (!this.lit && Math.abs(p.x - this.x) < 0.9 && Math.abs(p.y - this.y) < 1.6 && p.state !== 'gone') {
      this.light();
      this.stage.game.onCheckpoint(this.index);
    }
  }
}

// ----------------------------------------------------------------------------- habitants

export class Npc implements Interactable {
  x: number;
  y: number;
  reach: number;
  promptY: number;
  readonly view: CharacterView | null = null;
  private busy = false;

  constructor(private stage: Stage, readonly def: NpcDef) {
    this.x = def.x;
    this.y = def.y;
    this.reach = def.reach ?? 1.5;
    this.promptY = def.promptY ?? 2.2;
    if (!def.ghost) {
      const cd = CHARACTERS[def.char];
      this.view = new CharacterView(stage.game.assets, cd, stage.game.models);
      this.view.setPose(def.pose ?? 'idle');
      this.view.setFacing(def.facing ?? 1);
      this.view.root.position.set(this.x, this.y, def.z ?? -0.2);
      const c = new THREE.Color(stage.lightColor);
      this.view.setTint(c.r, c.g, c.b);
      stage.root.add(this.view.root);
      if (def.promptY === undefined) this.promptY = this.view.height + 0.25;
    }
  }

  label(): string {
    return t('prompt.talk');
  }

  available(): boolean {
    return !!this.def.talk && !this.busy;
  }

  interact(): void {
    if (!this.def.talk || this.busy) return;
    this.busy = true;
    const g = this.stage.game;
    void g.runScript(async () => {
      await this.def.talk!(g);
    }).finally(() => (this.busy = false));
  }

  setPose(pose: string): void {
    this.view?.setPose(pose);
  }

  update(dt: number): void {
    this.view?.update(dt);
  }

  dispose(): void {
    this.view?.dispose();
  }
}

// ----------------------------------------------------------------------------- portes

export class Door implements Interactable {
  x: number;
  y: number;
  reach = 1.0;
  promptY = 2.3;

  constructor(private stage: Stage, readonly def: DoorDef) {
    this.x = def.x;
    this.y = def.y;
    if (def.hut) {
      const g = stage.game;
      const h = 4.3;
      const w = h * g.assets.aspect('props/case');
      const hut = makeSprite(g.assets.tex('props/case'), w, h, { bottom: true, flip: def.flip, color: stage.lightColor, order: -2 });
      // La porte peinte se trouve aux deux tiers de la largeur de la case.
      const off = (0.672 - 0.5) * w * (def.flip ? -1 : 1);
      hut.position.set(def.x - off, def.y - 0.28, -0.45);
      stage.root.add(hut);
      if (stage.def.theme.night) {
        const glow = glowSprite(2.4, 0xffb45e, 0.5);
        glow.position.set(def.x, def.y + 1.0, -0.44);
        stage.root.add(glow);
      }
    }
  }

  label(): string {
    return t(this.def.label);
  }

  available(): boolean {
    return true;
  }

  interact(): void {
    const g = this.stage.game;
    if (this.def.canOpen && !this.def.canOpen(g)) {
      g.audio.sfx('wrong');
      if (this.def.lockedText) g.toast(this.def.lockedText);
      return;
    }
    g.audio.sfx('door');
    void g.useDoor(this.def);
  }
}

// ----------------------------------------------------------------------------- cibles du lance-pierre

function symbolTexture(symbol: NonNullable<TargetDef['symbol']>): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.translate(64, 64);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.fillStyle = '#fff8e0';
  g.strokeStyle = '#5a2c0c';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, 54, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (symbol === 'soleil') {
    g.fillStyle = '#f2a516';
    g.beginPath();
    g.arc(0, 0, 20, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#f2a516';
    g.lineWidth = 7;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 28, Math.sin(a) * 28);
      g.lineTo(Math.cos(a) * 42, Math.sin(a) * 42);
      g.stroke();
    }
  } else if (symbol === 'eau') {
    g.strokeStyle = '#1b8fc4';
    g.lineWidth = 8;
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      for (let x = -36; x <= 36; x += 4) {
        const y = k * 20 + Math.sin((x / 36) * Math.PI * 2) * 7;
        if (x === -36) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  } else {
    g.fillStyle = '#7a4a22';
    g.beginPath();
    g.moveTo(-9, 40);
    g.lineTo(-7, -6);
    g.lineTo(7, -6);
    g.lineTo(9, 40);
    g.closePath();
    g.fill();
    g.fillStyle = '#3f9a3a';
    for (const [x, y, r] of [[-22, -12, 16], [0, -24, 20], [22, -12, 16]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Target {
  x: number;
  y: number;
  lit = false;
  readonly radius: number;
  onHit: ((target: Target) => void) | null = null;
  private mesh: THREE.Mesh;
  private icon: THREE.Mesh | null = null;
  private glow: THREE.Mesh;
  private wobble = 0;

  constructor(private stage: Stage, readonly def: TargetDef) {
    this.x = def.x;
    this.y = def.y;
    const size = def.size ?? 1.1;
    this.radius = size * 0.48;
    this.mesh = imageSprite(stage.game.assets, 'props/cible', size, { order: 2 });
    this.mesh.position.set(this.x, this.y, -0.15);
    stage.root.add(this.mesh);
    if (def.symbol) {
      this.icon = makeSprite(symbolTexture(def.symbol), size * 0.5, size * 0.5, { order: 3 });
      this.icon.position.set(this.x, this.y, -0.14);
      stage.root.add(this.icon);
    }
    this.glow = glowSprite(size * 2.6, 0x8dff9a, 0);
    this.glow.position.set(this.x, this.y, -0.16);
    stage.root.add(this.glow);
  }

  hit(): void {
    this.wobble = 0.5;
    this.stage.fx.spark.burst({ x: this.x, y: this.y, count: 10, speed: 4, life: 0.5, size: 0.25, color: 0xfff0a0 });
    this.onHit?.(this);
  }

  setLit(on: boolean): void {
    this.lit = on;
  }

  update(dt: number): void {
    this.wobble = Math.max(0, this.wobble - dt);
    const r = Math.sin(this.wobble * 30) * this.wobble * 0.5;
    this.mesh.rotation.z = r;
    if (this.icon) this.icon.rotation.z = r;
    const m = this.glow.material as THREE.MeshBasicMaterial;
    m.opacity = approach(m.opacity, this.lit ? 0.7 : 0, dt * 3);
  }
}

// ----------------------------------------------------------------------------- la jeune amie

/** Coumba suit Ousmane, saute les obstacles, et lance parfois une pierre sur un ennemi proche. */
export class Companion {
  readonly body: Body = makeBody(0, 0, 0.55, 1.4);
  readonly view: CharacterView;
  private facing: 1 | -1 = 1;
  private stuck = 0;
  private throwCd = 3;
  private cheer = 0;

  constructor(private game: Game, private stage: Stage, x: number, y: number) {
    this.view = new CharacterView(game.assets, AMIE, game.models);
    this.view.setPose('idle');
    this.view.root.position.z = 0.05;
    const c = new THREE.Color(stage.lightColor);
    this.view.setTint(c.r, c.g, c.b);
    stage.root.add(this.view.root);
    this.body.x = x;
    this.body.y = y;
  }

  get x(): number {
    return this.body.x;
  }

  get y(): number {
    return this.body.y;
  }

  celebrate(time = 1.2): void {
    this.cheer = time;
  }

  private warp(): void {
    const p = this.stage.player;
    const b = this.body;
    this.stage.fx.spark.burst({ x: b.x, y: b.y + 0.8, count: 8, speed: 2, life: 0.4, size: 0.25, color: 0xfff0b0 });
    b.x = p.lastSafe.x - p.facing * 0.9;
    b.y = p.lastSafe.y + 0.05;
    b.vx = b.vy = 0;
    this.stuck = 0;
    this.stage.fx.spark.burst({ x: b.x, y: b.y + 0.8, count: 8, speed: 2, life: 0.4, size: 0.25, color: 0xfff0b0 });
  }

  update(dt: number, simulate: boolean): void {
    const b = this.body;
    const p = this.stage.player;
    const solids = this.stage.solids;
    this.cheer = Math.max(0, this.cheer - dt);
    if (simulate && p.state !== 'gone') {
      const target = p.x - p.facing * 1.25;
      const dx = target - b.x;
      const far = Math.abs(dx) > 0.45;
      let want = 0;
      if (far) want = clamp(dx * 3, -6.6, 6.6);
      if (want !== 0) this.facing = want > 0 ? 1 : -1;
      b.vx = approach(b.vx, want, 40 * dt);
      if (b.onGround && far) {
        const dir = this.facing;
        const gap = !groundBelow(solids, b.x + dir * 0.7, b.y, 1.2);
        const wall = wallAhead(solids, b.x, b.y + 0.4, dir * 0.75);
        const higher = p.y > b.y + 1.0 && Math.abs(p.x - b.x) < 3.5;
        if (gap || wall || higher) b.vy = 13.4;
      }
      b.vy = Math.max(b.vy - 32 * dt, -21);
      moveBody(b, solids, dt);
      // Trop loin, tombée ou bloquée : elle rejoint le héros.
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      if (dist > 5 && Math.abs(b.vx) < 0.4) this.stuck += dt;
      else this.stuck = Math.max(0, this.stuck - dt);
      const w = this.stage.waterAt(b.x);
      const drowned = (w && b.y < w.y - 0.3) || b.y < this.stage.def.bounds.minY - 2;
      if (dist > 15 || this.stuck > 1.6 || drowned) this.warp();

      // Coup de main : une pierre sur l'ennemi le plus menaçant.
      this.throwCd -= dt;
      if (this.throwCd <= 0) {
        const e = this.stage.nearestThreat(b.x, b.y, 7.5);
        if (e) {
          this.throwCd = 3.4;
          const ex = e.body.x;
          const ey = e.body.y + e.body.h * 0.5;
          const time = clamp(Math.abs(ex - b.x) / 12, 0.35, 0.8);
          this.facing = ex > b.x ? 1 : -1;
          this.stage.spawnProjectile({
            kind: 'stone', owner: 'player', x: b.x + this.facing * 0.4, y: b.y + 1.0,
            vx: (ex - b.x) / time, vy: (ey - (b.y + 1.0) + 0.5 * 20 * time * time) / time, grav: 20,
          });
          this.game.audio.sfx('throw', 0.7);
        } else {
          this.throwCd = 0.6;
        }
      }
    }
    const pose = this.cheer > 0 ? 'cheer' : !b.onGround ? 'jump' : Math.abs(b.vx) > 0.6 ? 'run' : 'idle';
    this.view.setPose(pose);
    this.view.setFacing(pose === 'idle' ? (p.x >= b.x ? 1 : -1) : this.facing);
    this.view.update(dt, { vx: b.vx, vy: b.vy, moving: Math.abs(b.vx) > 0.6 });
    this.view.root.position.x = b.x;
    this.view.root.position.y = b.y;
  }

  dispose(): void {
    this.view.dispose();
  }
}
