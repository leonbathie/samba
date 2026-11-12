/**
 * Scène de jeu : construit un niveau (ou un intérieur) à partir de sa description, puis fait vivre
 * le héros, les ennemis, les objets et la caméra à chaque pas de simulation.
 */
import * as THREE from 'three';
import type { Game } from './Game';
import type { ClimbDef, DecorDef, HangDef, ItemDef, LevelDef, MoverDef, SolidDef, WaterDef } from './types';
import type { Solid } from './physics';
import { Player } from './Player';
import { Checkpoint, Chest, Companion, Door, type Interactable, Npc, Pickup, Projectile, type ProjectileSpec, Target } from './entities';
import { createEnemy, type Enemy } from './enemies';
import { Backdrop, makeEarth, makeWater, makeWaterfall } from '../render/scenery';
import { glowSprite, imageSprite, makeSprite, Particles, QUAD } from '../render/sprites';
import { clamp, damp, rng } from '../core/math';
import { t } from '../i18n';
import type { Action } from '../core/Input';

/** Façon de dessiner chaque type de plateforme : image, ligne de marche et partie pleine de l'image. */
const LOOK: Record<string, { img: string; top: number; x0: number; x1: number; tile?: number; maxH?: number }> = {
  stone: { img: 'props/sol_pierre', top: 0.17, x0: 0.03, x1: 0.99, tile: 4.6 },
  branch: { img: 'props/branche', top: 0.44, x0: 0.03, x1: 1.0, maxH: 1.9 },
  motif: { img: 'props/plateforme_motif', top: 0.207, x0: 0.03, x1: 0.98, maxH: 1.7 },
  bridge: { img: 'props/pont_corde', top: 0.6, x0: 0.02, x1: 0.98, tile: 4.2 },
  pilotis: { img: 'props/pilotis', top: 0.03, x0: 0.1, x1: 0.9 },
  gue: { img: 'props/pierre_gue', top: 0.045, x0: 0.1, x1: 0.88 },
  pirogue: { img: 'props/pirogue', top: 0.53, x0: 0.04, x1: 0.94 },
  ile: { img: 'props/ile_flottante', top: 0.06, x0: 0.02, x1: 0.98 },
};

export function solidImage(style: string): string | null {
  return LOOK[style]?.img ?? null;
}

interface MoverRt {
  def: MoverDef;
  solid: Solid;
  group: THREE.Group;
}

interface SignRt {
  x: number;
  y: number;
  text: string;
  keys?: string[];
  mesh: THREE.Mesh;
}

let ladderTex: THREE.Texture | null = null;
function ladderTexture(): THREE.Texture {
  if (ladderTex) return ladderTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8a5a2b';
  g.fillRect(6, 0, 9, 48);
  g.fillRect(49, 0, 9, 48);
  g.fillStyle = '#b57a3c';
  g.fillRect(8, 0, 3, 48);
  g.fillRect(51, 0, 3, 48);
  g.fillStyle = '#a06a30';
  g.fillRect(4, 18, 56, 10);
  g.fillStyle = '#c9924e';
  g.fillRect(4, 18, 56, 3);
  g.fillStyle = '#d8b46a';
  g.fillRect(4, 16, 12, 14);
  g.fillRect(48, 16, 12, 14);
  ladderTex = new THREE.CanvasTexture(c);
  ladderTex.wrapT = THREE.RepeatWrapping;
  ladderTex.colorSpace = THREE.SRGBColorSpace;
  return ladderTex;
}

let arrowTex: THREE.Texture | null = null;
function arrowTexture(): THREE.Texture {
  if (arrowTex) return arrowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.lineJoin = 'round';
  g.fillStyle = '#ffd35a';
  g.strokeStyle = '#6b3410';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(14, 46);
  g.lineTo(66, 46);
  g.lineTo(66, 20);
  g.lineTo(116, 64);
  g.lineTo(66, 108);
  g.lineTo(66, 82);
  g.lineTo(14, 82);
  g.closePath();
  g.stroke();
  g.fill();
  arrowTex = new THREE.CanvasTexture(c);
  arrowTex.colorSpace = THREE.SRGBColorSpace;
  return arrowTex;
}

export class Stage {
  readonly root = new THREE.Group();
  readonly solids: Solid[] = [];
  readonly fx: { soft: Particles; spark: Particles; star: Particles };
  player!: Player;
  companion: Companion | null = null;
  readonly enemies: Enemy[] = [];
  readonly projectiles: Projectile[] = [];
  readonly pickups: Pickup[] = [];
  readonly interactables: Interactable[] = [];
  readonly chests: Chest[] = [];
  readonly checkpoints: Checkpoint[] = [];
  readonly npcs: Npc[] = [];
  readonly targets: Target[] = [];
  interactTarget: Interactable | null = null;
  time = 0;
  /** Teinte des éléments proches (blanc le jour, bleuté la nuit). */
  readonly lightColor: number;

  private backdrop: Backdrop | null = null;
  private movers: MoverRt[] = [];
  private animated: THREE.ShaderMaterial[] = [];
  private swayers: { mesh: THREE.Object3D; amp: number; seed: number }[] = [];
  private flyers: { mesh: THREE.Object3D; def: DecorDef; x0: number }[] = [];
  private signs: SignRt[] = [];
  private activeSign: SignRt | null = null;
  private triggersDone = new Set<string>();
  private byId = new Map<string, { solid: Solid; objects: THREE.Object3D[] }>();
  private exitMesh: THREE.Mesh | null = null;
  private exitWarn = 0;
  private camX = 0;
  private camY = 0;
  private look = 0;
  private fireflyT = 0;
  private fallLock = false;
  private rand = rng(1234);

  constructor(readonly game: Game, readonly def: LevelDef) {
    this.lightColor = def.theme.light ?? 0xffffff;
    this.fx = { soft: new Particles('soft'), spark: new Particles('spark', 320), star: new Particles('star', 120) };
    this.root.add(this.fx.soft.mesh, this.fx.spark.mesh, this.fx.star.mesh);
    this.build();
  }

  // ------------------------------------------------------------------ construction

  private build(): void {
    const g = this.game;
    const def = this.def;
    const a = g.assets;
    const b = def.bounds;

    if (def.painting) {
      // Intérieur : le tableau peint occupe exactement les limites de la pièce.
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      const mesh = makeSprite(a.tex(def.painting), w, h, { order: -50 });
      (mesh.material as THREE.MeshBasicMaterial).transparent = false;
      mesh.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, -0.6);
      this.root.add(mesh);
    } else {
      this.backdrop = new Backdrop(a.tex(def.theme.backdrop), a.aspect(def.theme.backdrop), def.theme.tint ?? 0xffffff);
      if (def.theme.alignLow !== undefined) this.backdrop.alignLow = def.theme.alignLow;
      if (def.theme.alignHigh !== undefined) this.backdrop.alignHigh = def.theme.alignHigh;
      this.root.add(this.backdrop.mesh);
    }

    for (const s of def.solids) this.addSolid(s);
    for (const m of def.movers) this.addMover(m);
    for (const c of def.climbs) this.addClimbVisual(c);
    for (const w of def.waters) {
      const mesh = makeWater(w.x0, w.x1, w.y, b.minY - 10, def.theme.water);
      mesh.position.z = 0.3;
      mesh.renderOrder = 8;
      this.root.add(mesh);
      this.animated.push(mesh.material as THREE.ShaderMaterial);
    }
    for (const f of def.falls) {
      const mesh = makeWaterfall(f.w, f.h, 0x8fdcf2, f.opacity ?? 1);
      mesh.position.set(f.x, f.y - f.h / 2, f.z ?? -1.5);
      this.root.add(mesh);
      this.animated.push(mesh.material as THREE.ShaderMaterial);
    }
    for (const d of def.decor) this.addDecor(d);

    for (const d of def.doors) this.interactables.push(new Door(this, d));
    for (const n of def.npcs) {
      if (n.when && !n.when(g)) continue;
      const npc = new Npc(this, n);
      this.npcs.push(npc);
      this.interactables.push(npc);
    }
    for (const c of def.chests) {
      const chest = new Chest(this, c);
      this.chests.push(chest);
      this.interactables.push(chest);
    }
    for (const it of def.items) {
      if (it.id && g.isCollected(def.id, it.id)) continue;
      this.pickups.push(new Pickup(this, it));
    }
    def.checkpoints.forEach((c, i) => this.checkpoints.push(new Checkpoint(this, i, c.x, c.y)));
    for (const e of def.enemies) this.enemies.push(createEnemy(g, this, e));
    for (const tg of def.targets) this.targets.push(new Target(this, tg));
    for (const s of def.signs) {
      const mesh = imageSprite(a, 'items/parchemin', 0.7, { order: 2 });
      mesh.position.set(s.x, s.y + 1.5, -0.3);
      this.root.add(mesh);
      this.signs.push({ ...s, mesh });
    }
    if (def.exit) {
      this.exitMesh = makeSprite(arrowTexture(), 1.1, 1.1, { order: 6 });
      this.exitMesh.position.set(def.exit.x, def.exit.y + 2.1, -0.2);
      this.root.add(this.exitMesh);
      const glow = glowSprite(4.5, 0xffe08a, 0.45);
      glow.position.set(def.exit.x, def.exit.y + 1.4, -0.4);
      this.root.add(glow);
    }

    this.player = new Player(g, this);
    this.player.place(def.spawn.x, def.spawn.y);
    const c = new THREE.Color(this.lightColor);
    this.player.view.setTint(c.r, c.g, c.b);
    if (def.companion && (!def.companion.when || def.companion.when(g))) this.addCompanion(def.companion.x, def.companion.y);
    def.setup?.(g, this);
  }

  addCompanion(x: number, y: number): void {
    if (this.companion) return;
    this.companion = new Companion(this.game, this, x, y);
  }

  private solidFromDef(s: SolidDef): Solid {
    return { x0: s.x, x1: s.x + s.w, y0: s.y - s.h, y1: s.y, oneWay: !!s.oneWay, off: !!s.hidden };
  }

  private solidVisuals(s: SolidDef, parent: THREE.Object3D): THREE.Object3D[] {
    const a = this.game.assets;
    const out: THREE.Object3D[] = [];
    const look = LOOK[s.style];
    let wallBottom = s.y;
    if (look) {
      const aspect = a.aspect(look.img);
      const n = look.tile ? Math.max(1, Math.round(s.w / look.tile)) : 1;
      const tw = s.w / n;
      let sw = tw / (look.x1 - look.x0);
      let sh = sw / aspect;
      if (look.maxH && sh > look.maxH) sh = look.maxH;
      // Un muret trop étroit garde ses proportions : il devient un petit bloc de pierre.
      if (look.tile && tw < look.tile * 0.55) sh = Math.max(sh, 0.8);
      for (let i = 0; i < n; i++) {
        const flip = s.flip ? true : look.tile ? i % 2 === 1 : false;
        const left = s.x + i * tw - (flip ? 1 - look.x1 : look.x0) * sw;
        const mesh = makeSprite(a.tex(look.img), sw, sh, { flip, color: this.lightColor, order: 1 });
        mesh.position.set(left + sw / 2, s.y + look.top * sh - sh / 2, -0.02 + i * 0.0005);
        parent.add(mesh);
        out.push(mesh);
      }
      wallBottom = s.y - sh * (1 - look.top) + 0.3;
      void sw;
    }
    if (s.style === 'earth' || s.fillTo !== undefined) {
      const bottom = s.fillTo ?? s.y - s.h;
      if (bottom < wallBottom - 0.05) {
        const tint = new THREE.Color(this.def.theme.earth).multiply(new THREE.Color(this.lightColor)).getHex();
        const earth = makeEarth(s.x + 0.12, bottom, s.x + s.w - 0.12, wallBottom, tint);
        parent.add(earth);
        out.push(earth);
      }
    }
    return out;
  }

  private addSolid(s: SolidDef): void {
    const solid = this.solidFromDef(s);
    this.solids.push(solid);
    const objects = this.solidVisuals(s, this.root);
    if (s.hidden) for (const o of objects) o.visible = false;
    if (s.id) this.byId.set(s.id, { solid, objects });
  }

  private addMover(m: MoverDef): void {
    const solid = this.solidFromDef(m);
    solid.tag = 'mover';
    this.solids.push(solid);
    const group = new THREE.Group();
    this.root.add(group);
    this.solidVisuals(m, group);
    this.movers.push({ def: m, solid, group });
    if (m.id) this.byId.set(m.id, { solid, objects: [group] });
  }

  /** Fait apparaître ou disparaître une plateforme pilotée par un script. */
  setSolidActive(id: string, on: boolean, withFx = true): void {
    const e = this.byId.get(id);
    if (!e) return;
    e.solid.off = !on;
    for (const o of e.objects) o.visible = on;
    if (on && withFx) {
      const cx = (e.solid.x0 + e.solid.x1) / 2;
      this.fx.spark.burst({ x: cx, y: e.solid.y1, count: 14, speed: 3, life: 0.7, size: 0.28, color: 0xbfe9ff });
    }
  }

  private addClimbVisual(c: ClimbDef): void {
    const a = this.game.assets;
    const h = c.y1 - c.y0;
    if (c.style === 'liane') {
      const seg = 1.9;
      const n = Math.max(1, Math.ceil(h / seg));
      for (let i = 0; i < n; i++) {
        const mesh = imageSprite(a, 'props/liane', seg, { flip: i % 2 === 1, color: this.lightColor });
        mesh.position.set(c.x, c.y1 - seg / 2 - i * (h / n), -0.08);
        this.root.add(mesh);
      }
    } else if (c.style === 'echelle') {
      const tex = ladderTexture().clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, h / 0.55);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: this.lightColor, toneMapped: false });
      const mesh = new THREE.Mesh(QUAD, mat);
      mesh.scale.set(0.8, h, 1);
      mesh.position.set(c.x, c.y0 + h / 2, -0.08);
      this.root.add(mesh);
    }
  }

  private addDecor(d: DecorDef): void {
    const a = this.game.assets;
    const z = d.z ?? -1;
    const near = z > -8;
    let color = d.tint ?? 0xffffff;
    if (near && this.lightColor !== 0xffffff) color = new THREE.Color(color).multiply(new THREE.Color(this.lightColor)).getHex();
    const mesh = imageSprite(a, d.img, d.h, { bottom: !d.center, flip: d.flip, opacity: d.opacity, color });
    mesh.position.set(d.x, d.y, z);
    this.root.add(mesh);
    if (d.glow) {
      const glow = glowSprite(d.glow.size, d.glow.color, 0.55);
      glow.position.set(d.x, d.y + (d.glow.dy ?? (d.center ? 0 : d.h * 0.4)), z + 0.01);
      this.root.add(glow);
      this.swayers.push({ mesh: glow, amp: 0, seed: this.rand() * 10 });
    }
    if (d.sway) this.swayers.push({ mesh, amp: d.sway, seed: this.rand() * 10 });
    if (d.fly) this.flyers.push({ mesh, def: d, x0: d.x });
  }

  npc(id: string): Npc | undefined {
    return this.npcs.find((n) => n.def.id === id);
  }

  // ------------------------------------------------------------------ requêtes

  climbAt(x: number, y: number, h: number): ClimbDef | null {
    for (const c of this.def.climbs) {
      if (Math.abs(x - c.x) < 0.5 && y + h > c.y0 && y <= c.y1 + 0.05) return c;
    }
    return null;
  }

  hangAt(x: number, hands: number): HangDef | null {
    for (const h of this.def.hangs) {
      if (x >= h.x0 && x <= h.x1 && Math.abs(hands - h.y) < 0.3) return h;
    }
    return null;
  }

  waterAt(x: number): WaterDef | null {
    for (const w of this.def.waters) if (x >= w.x0 && x <= w.x1) return w;
    return null;
  }

  onScreen(x: number, y: number, margin = 0): boolean {
    const v = this.game.view;
    return Math.abs(x - v.camX) < v.halfW + margin && Math.abs(y - v.camY) < v.halfH + margin;
  }

  nearestThreat(x: number, y: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = range;
    for (const e of this.enemies) {
      if (!e.threatening || e.kind === 'singe' || e.kind === 'croc') continue;
      const d = Math.hypot(e.body.x - x, e.body.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** Angle de tir qui atteint la cible la plus proche devant le héros, ou null. */
  aimAssist(ox: number, oy: number, facing: number, speed: number, grav: number, range: number, weapon: string): number | null {
    let best: { x: number; y: number } | null = null;
    let bd = range;
    const consider = (x: number, y: number): void => {
      const dx = (x - ox) * facing;
      if (dx < 0.6) return;
      const d = Math.hypot(x - ox, y - oy);
      if (d < bd) {
        bd = d;
        best = { x, y };
      }
    };
    for (const e of this.enemies) {
      if (!e.threatening) continue;
      if (weapon === 'banana' && e.kind !== 'singe') continue;
      const r = e.hurtRect();
      consider(e.body.x, (r.y0 + r.y1) / 2);
    }
    if (weapon !== 'banana') for (const tg of this.targets) consider(tg.x, tg.y);
    if (!best) return null;
    const target = best as { x: number; y: number };
    const dx = Math.abs(target.x - ox);
    const dy = target.y - oy;
    const v2 = speed * speed;
    const disc = v2 * v2 - grav * (grav * dx * dx + 2 * dy * v2);
    if (disc < 0) return null;
    const ang = Math.atan((v2 - Math.sqrt(disc)) / (grav * dx));
    return ang > -0.9 && ang < 1.25 ? ang : null;
  }

  // ------------------------------------------------------------------ effets et apparitions

  dust(x: number, y: number, n: number): void {
    this.fx.soft.burst({ x, y: y + 0.08, count: n, speed: 1.4, angle: Math.PI / 2, spread: 2.6, life: 0.45, size: 0.3, grow: 0.35, color: 0xe2cfa8 });
  }

  splash(x: number, y: number, size: number): void {
    this.fx.soft.burst({ x, y, z: 0.4, count: Math.round(12 * size), speed: 5 * size, angle: Math.PI / 2, spread: 1.5, life: 0.7, size: 0.3, gravity: 12, color: 0xdff6ff });
    this.game.audio.sfx('splash', clamp(size, 0.3, 1));
  }

  spawnProjectile(spec: ProjectileSpec): void {
    this.projectiles.push(new Projectile(this, spec));
  }

  spawnPickup(def: ItemDef, o: { ttl?: number; pop?: boolean } = {}): void {
    this.pickups.push(new Pickup(this, def, o));
  }

  /** Défense du héros : repousse les ennemis devant lui et renvoie les projectiles. */
  guardSweep(p: Player, done: Set<object>): void {
    for (const e of this.enemies) {
      if (!e.threatening || done.has(e)) continue;
      const r = e.hurtRect();
      const ex = e.body.x;
      const front = (ex - p.x) * p.facing;
      if (front > -0.4 && front < 1.7 && r.y1 > p.y - 0.3 && r.y0 < p.y + 1.8) {
        done.add(e);
        e.repel(p.facing);
      }
    }
    for (const pr of this.projectiles) {
      if (pr.owner !== 'enemy' || done.has(pr)) continue;
      if (Math.abs(pr.x - p.x) < 1.2 && pr.y > p.y - 0.4 && pr.y < p.y + 2.1) {
        done.add(pr);
        pr.deflect(pr.x >= p.x ? 1 : -1);
        this.game.audio.sfx('deflect');
        this.game.addScore(10);
        this.fx.spark.burst({ x: pr.x, y: pr.y, count: 6, speed: 3, life: 0.3, size: 0.22, color: 0xfff0a0 });
      }
    }
  }

  // ------------------------------------------------------------------ simulation

  /**
   * Avance d'un pas. `simulate` est faux pendant les dialogues et les transitions : le monde
   * continue de respirer (animations, particules) mais plus rien ne bouge ni ne blesse.
   */
  update(dt: number, simulate: boolean): void {
    const g = this.game;
    const p = this.player;
    this.time += dt;

    for (const m of this.movers) {
      const ph = (this.time / m.def.period + (m.def.phase ?? 0)) * Math.PI * 2;
      const k = 0.5 - 0.5 * Math.cos(ph);
      const nx = m.def.x + m.def.dx * k;
      const ny = m.def.y + m.def.dy * k;
      const s = m.solid;
      s.dx = simulate ? nx - s.x0 : 0;
      s.dy = simulate ? ny - s.y1 : 0;
      if (simulate) {
        s.x0 = nx;
        s.x1 = nx + m.def.w;
        s.y1 = ny;
        s.y0 = ny - m.def.h;
        m.group.position.set(nx - m.def.x, ny - m.def.y, 0);
      }
    }

    if (simulate) {
      for (const tr of this.def.triggers) {
        if (this.triggersDone.has(tr.id)) continue;
        if (p.x >= tr.x0 && p.x <= tr.x1 && p.y >= (tr.y0 ?? -1e9) && p.y <= (tr.y1 ?? 1e9)) {
          if (tr.once !== false) this.triggersDone.add(tr.id);
          void g.runScript(async () => {
            await tr.run(g, this);
          });
        }
      }
      this.def.tick?.(g, this, dt);
      p.update(dt);
    } else {
      p.view.update(dt, { vx: 0, vy: 0, moving: false });
    }
    this.companion?.update(dt, simulate);

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (simulate) e.update(dt);
      else e.view.update(dt);
      if (simulate && e.contact && !e.gone && p.invuln <= 0 && p.state !== 'gone') {
        const r = e.hurtRect();
        const b = p.body;
        if (b.x + b.w / 2 > r.x0 && b.x - b.w / 2 < r.x1 && b.y + b.h > r.y0 && b.y < r.y1 && !e.isStunned) {
          p.hurt(e.body.x);
        }
      }
    }
    this.sweep(this.enemies, (e) => e.dispose());

    if (simulate) this.updateProjectiles(dt);
    this.sweep(this.projectiles);
    for (const pk of this.pickups) if (simulate || pk.def.kind !== 'coin') pk.update(simulate ? dt : 0);
    this.sweep(this.pickups);
    for (const c of this.chests) c.update(dt);
    for (const c of this.checkpoints) if (simulate) c.update(dt);
    for (const n of this.npcs) n.update(dt);
    for (const tg of this.targets) tg.update(dt);

    if (simulate) {
      this.updateInteraction();
      this.updateSigns();
      this.updateExit(dt);
      this.checkFalls();
    } else {
      this.interactTarget = null;
      g.ui.prompt(null);
    }

    this.fx.soft.update(dt);
    this.fx.spark.update(dt);
    this.fx.star.update(dt);
    for (const m of this.animated) m.uniforms.uTime.value = this.time;
    for (const s of this.swayers) {
      if (s.amp > 0) s.mesh.rotation.z = Math.sin(this.time * 1.3 + s.seed) * s.amp;
      else (s.mesh as THREE.Mesh).scale.setScalar((s.mesh.userData.base ??= s.mesh.scale.x) * (1 + Math.sin(this.time * 4 + s.seed) * 0.06));
    }
    for (const f of this.flyers) {
      const fl = f.def.fly!;
      const span = fl.range;
      const pos = ((((this.time * fl.speed) % (span * 2)) + span * 2) % (span * 2)) - span;
      f.mesh.position.x = f.x0 + pos;
      f.mesh.position.y = f.def.y + Math.sin(this.time * 1.7 + f.x0) * (fl.bob ?? 0.4);
      f.mesh.scale.y = f.def.h * (0.82 + 0.18 * Math.sin(this.time * 9 + f.x0));
    }
    for (const sg of this.signs) sg.mesh.position.y = sg.y + 1.5 + Math.sin(this.time * 2.2 + sg.x) * 0.08;
    if (this.exitMesh) this.exitMesh.position.x = this.def.exit!.x + Math.sin(this.time * 3.5) * 0.18;
    if (this.def.theme.night) this.fireflies(dt);
    this.updateCamera(dt, false);
  }

  private sweep<T extends { alive: boolean }>(list: T[], onRemove?: (item: T) => void): void {
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (it.alive) list[n++] = it;
      else onRemove?.(it);
    }
    list.length = n;
  }

  private updateProjectiles(dt: number): void {
    const p = this.player;
    for (const pr of this.projectiles) {
      if (!pr.alive) continue;
      pr.update(dt);
      if (!pr.alive) continue;
      if (pr.owner === 'player') {
        for (const e of this.enemies) {
          if (!e.alive || (e.gone && e.kind !== 'singe')) continue;
          const r = e.hurtRect();
          if (pr.x + pr.radius > r.x0 && pr.x - pr.radius < r.x1 && pr.y + pr.radius > r.y0 && pr.y - pr.radius < r.y1) {
            if (e.gone) continue;
            if (e.hitBy(pr.kind, pr.vx >= 0 ? 1 : -1)) {
              this.fx.star.burst({ x: pr.x, y: pr.y, count: 5, speed: 3, life: 0.4, size: 0.26, color: 0xfff4b8 });
              pr.remove();
              break;
            }
          }
        }
        if (!pr.alive) continue;
        if (pr.kind !== 'banana') {
          for (const tg of this.targets) {
            if (Math.hypot(pr.x - tg.x, pr.y - tg.y) < tg.radius + pr.radius) {
              tg.hit();
              pr.remove();
              break;
            }
          }
        }
      } else if (p.state !== 'gone') {
        const b = p.body;
        if (pr.x > b.x - b.w / 2 - pr.radius && pr.x < b.x + b.w / 2 + pr.radius && pr.y > b.y && pr.y < b.y + b.h) {
          if (p.invuln <= 0) {
            p.hurt(pr.x - pr.vx * 0.1);
            pr.remove();
          }
        }
      }
    }
  }

  private updateInteraction(): void {
    const p = this.player;
    let best: Interactable | null = null;
    let bd = 1e9;
    if (p.state === 'normal' || p.state === 'climb') {
      for (const it of this.interactables) {
        if (!it.available()) continue;
        const dx = Math.abs(it.x - p.x);
        const dy = p.y - it.y;
        if (dx < it.reach && dy > -1.2 && dy < 1.6 && dx < bd) {
          bd = dx;
          best = it;
        }
      }
    }
    this.interactTarget = best;
    if (best) this.game.ui.prompt({ x: best.x, y: best.y + best.promptY }, best.label());
    else this.game.ui.prompt(null);
  }

  private updateSigns(): void {
    const p = this.player;
    let found: SignRt | null = null;
    for (const s of this.signs) {
      if (Math.abs(p.x - s.x) < 2.4 && Math.abs(p.y - s.y) < 2.5) found = s;
    }
    if (found !== this.activeSign) {
      this.activeSign = found;
      if (found) this.game.ui.hint(t(found.text), (found.keys ?? []) as Action[]);
      else this.game.ui.hint(null);
    }
  }

  private updateExit(dt: number): void {
    const ex = this.def.exit;
    if (!ex) return;
    const p = this.player;
    this.exitWarn = Math.max(0, this.exitWarn - dt);
    if (Math.abs(p.x - ex.x) < 1.0 && Math.abs(p.y - ex.y) < 2.2 && p.state === 'normal') {
      if (!ex.canLeave || ex.canLeave(this.game)) {
        this.game.completeLevel();
      } else if (this.exitWarn <= 0) {
        this.exitWarn = 3.5;
        this.game.audio.sfx('wrong');
        if (ex.lockedText) this.game.toast(ex.lockedText);
      }
    }
  }

  private checkFalls(): void {
    const p = this.player;
    if (p.state === 'gone') {
      this.fallLock = false;
      return;
    }
    if (this.fallLock) return;
    const w = this.waterAt(p.x);
    if (w && p.y + 0.55 < w.y) {
      this.fallLock = true;
      this.splash(p.x, w.y, 1);
      this.game.onFall();
    } else if (p.y < this.def.bounds.minY - 2.5) {
      this.fallLock = true;
      this.game.onFall();
    }
  }

  private fireflies(dt: number): void {
    this.fireflyT -= dt;
    if (this.fireflyT > 0) return;
    this.fireflyT = 0.16;
    const v = this.game.view;
    this.fx.spark.burst({
      x: v.camX + (Math.random() - 0.5) * v.halfW * 2.2,
      y: v.camY + (Math.random() - 0.4) * v.halfH * 1.6,
      z: -1 + Math.random() * 2.5,
      count: 1, speed: 0.5, life: 2.6, size: 0.13, drag: 0.2, color: 0xfff3a0,
    });
  }

  /** Place la caméra : elle suit le héros en regardant un peu devant lui, sans sortir du niveau. */
  updateCamera(dt: number, snap: boolean): void {
    const v = this.game.view;
    const b = this.def.bounds;
    const p = this.player;
    const indoor = this.def.kind === 'room';
    this.look = damp(this.look, p.facing * (indoor ? 0.3 : 1.7), 2.2, dt);
    const tx = p.x + this.look;
    const ty = p.y + (indoor ? 0.9 : v.viewH * 0.17);
    if (snap) {
      this.camX = tx;
      this.camY = ty;
      this.look = p.facing * (indoor ? 0.3 : 1.7);
    } else {
      this.camX = damp(this.camX, tx, 5.5, dt);
      // Zone morte verticale : la caméra ne suit pas chaque petit saut.
      const dy = ty - this.camY;
      const dead = indoor ? 0.15 : 1.0;
      if (Math.abs(dy) > dead) this.camY = damp(this.camY, ty - Math.sign(dy) * dead, p.body.onGround ? 4 : 6.5, dt);
      else if (p.body.onGround) this.camY = damp(this.camY, ty, 1.6, dt);
    }
    const minX = b.minX + v.halfW;
    const maxX = b.maxX - v.halfW;
    const minY = b.minY + v.halfH;
    const maxY = b.maxY - v.halfH;
    this.camX = minX > maxX ? (b.minX + b.maxX) / 2 : clamp(this.camX, minX, maxX);
    this.camY = minY > maxY ? (b.minY + b.maxY) / 2 : clamp(this.camY, minY, maxY);
    v.setCamera(this.camX, this.camY);
    this.backdrop?.update(v, b);
  }

  /** Réarme la détection de chute après le retour du héros. */
  resetFall(): void {
    this.fallLock = false;
  }

  dispose(): void {
    this.player.dispose();
    this.companion?.dispose();
    for (const e of this.enemies) e.dispose();
    for (const n of this.npcs) n.dispose();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.geometry !== QUAD && !m.geometry.userData.shared) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat.dispose();
    });
    this.root.removeFromParent();
  }
}
