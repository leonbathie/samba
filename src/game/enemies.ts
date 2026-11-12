/**
 * Animaux qui font obstacle. Chaque attaque est annoncée (point d'exclamation, pose, son) pour
 * laisser au joueur le temps de réagir. Les animaux ne sont jamais blessés : ils sont repoussés,
 * étourdis, apprivoisés (singes) ou mis en fuite.
 *
 *  - Singe      : reste sur sa branche et lance une banane ou une pierre.
 *  - Serpent    : garde une zone, se dresse puis frappe quand on s'approche.
 *  - Crocodile  : nage dans l'eau et bondit quand on passe au-dessus de lui.
 *  - Hyène      : poursuit le héros sur une certaine distance.
 *  - Phacochère : gratte le sol puis charge en ligne droite.
 */
import * as THREE from 'three';
import type { Game } from './Game';
import type { Stage } from './Stage';
import type { EnemyDef, EnemyKind } from './types';
import { type Body, groundBelow, makeBody, moveBody, wallAhead } from './physics';
import { CharacterView } from '../render/characters';
import { ENEMIES } from './characterDefs';
import { makeSprite } from '../render/sprites';
import { approach, clamp } from '../core/math';

let alertTex: THREE.Texture | null = null;
function alertTexture(): THREE.Texture {
  if (alertTex) return alertTex;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e8352b';
  g.strokeStyle = '#fff4d0';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(48, 48, 38, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff';
  g.font = 'bold 62px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('!', 48, 52);
  alertTex = new THREE.CanvasTexture(c);
  alertTex.colorSpace = THREE.SRGBColorSpace;
  return alertTex;
}

export type HitKind = 'banana' | 'stone' | 'sling';

export abstract class Enemy {
  readonly body: Body;
  readonly view: CharacterView;
  alive = true;
  /** Vrai tant que l'animal peut blesser le héros au contact. */
  contact = true;
  /** En fuite ou apprivoisé : n'est plus une menace ni une cible. */
  gone = false;
  facing: 1 | -1 = -1;
  protected state = 'idle';
  protected t = 0;
  protected stunT = 0;
  protected hp = 1;
  protected home: { x: number; y: number };
  protected x0: number;
  protected x1: number;
  protected gravity = true;
  private alert: THREE.Mesh;
  private alertOn = false;
  private fleeT = 0;
  private fleeDir = 1;
  private opacity = 1;
  protected yOff = 0;
  protected tilt = 0;

  constructor(protected game: Game, protected stage: Stage, readonly def: EnemyDef, w: number, h: number) {
    this.body = makeBody(def.x, def.y, w, h);
    this.home = { x: def.x, y: def.y };
    this.x0 = def.x0 ?? def.x - 6;
    this.x1 = def.x1 ?? def.x + 6;
    this.facing = def.facing ?? -1;
    this.view = new CharacterView(game.assets, ENEMIES[def.kind], game.models);
    this.view.setPose('idle');
    this.view.root.position.set(def.x, def.y, 0.06);
    const c = new THREE.Color(stage.lightColor);
    this.view.setTint(c.r, c.g, c.b);
    stage.root.add(this.view.root);
    this.alert = makeSprite(alertTexture(), 0.55, 0.55, { order: 30 });
    this.alert.visible = false;
    stage.root.add(this.alert);
  }

  get kind(): EnemyKind {
    return this.def.kind;
  }

  get x(): number {
    return this.body.x;
  }

  /** Vrai si l'animal menace le héros (sert à l'amie et à l'aide à la visée). */
  get threatening(): boolean {
    return this.alive && !this.gone;
  }

  protected setState(s: string): void {
    this.state = s;
    this.t = 0;
  }

  protected showAlert(on: boolean): void {
    if (on && !this.alertOn) this.game.audio.sfx('alert', 0.7);
    this.alertOn = on;
  }

  protected playerDX(): number {
    return this.stage.player.x - this.body.x;
  }

  protected playerDY(): number {
    return this.stage.player.y - this.body.y;
  }

  protected facePlayer(): void {
    this.facing = this.playerDX() >= 0 ? 1 : -1;
  }

  /** Étourdit l'animal un instant et le fait reculer. */
  protected stun(time: number, dir: number, push = 4): void {
    this.stunT = time;
    this.showAlert(false);
    this.body.vx = dir * push;
    if (this.gravity) this.body.vy = 4;
    this.view.flash(0.12);
    this.stage.fx.star.burst({ x: this.body.x, y: this.body.y + this.body.h + 0.2, count: 4, speed: 2, life: 0.6, size: 0.28, color: 0xfff1a8 });
  }

  /** L'animal s'enfuit : il laisse quelques pièces et disparaît. */
  protected flee(dir: number, coins: number, score: number): void {
    if (this.gone) return;
    this.gone = true;
    this.contact = false;
    this.fleeT = 1.3;
    this.fleeDir = dir >= 0 ? 1 : -1;
    this.showAlert(false);
    this.game.addScore(score);
    this.game.audio.sfx('hit');
    this.stage.fx.soft.burst({ x: this.body.x, y: this.body.y + 0.4, count: 10, speed: 3, life: 0.6, size: 0.5, grow: 0.5, color: 0xe6d3b0 });
    for (let i = 0; i < coins; i++) {
      this.stage.spawnPickup({ kind: 'coin', x: this.body.x, y: Math.max(this.body.y, this.home.y) + 0.5 }, { pop: true });
    }
  }

  /** Touché par un projectile du héros. Renvoie vrai si le projectile est arrêté. */
  abstract hitBy(kind: HitKind, dir: number): boolean;

  /** Repoussé par la défense du héros. */
  repel(dir: number): void {
    if (this.gone) return;
    this.stun(1.0, dir, 6);
    this.game.audio.sfx('hit', 0.8);
  }

  protected abstract think(dt: number): void;

  update(dt: number): void {
    const b = this.body;
    this.t += dt;
    if (this.gone && this.fleeT > 0) {
      this.fleeT -= dt;
      this.facing = this.fleeDir;
      b.x += this.fleeDir * 8 * dt;
      if (this.kind === 'singe') b.y += 6 * dt;
      this.opacity = clamp(this.fleeT / 0.6, 0, 1);
      this.view.setPose(this.kind === 'singe' ? 'move' : 'move');
      if (this.fleeT <= 0) this.alive = false;
    } else if (this.stunT > 0) {
      this.stunT -= dt;
      this.view.setPose('stun');
      if (this.gravity) {
        b.vx = approach(b.vx, 0, 14 * dt);
        b.vy = Math.max(b.vy - 32 * dt, -20);
        moveBody(b, this.stage.solids, dt);
      } else {
        b.vx = 0;
      }
    } else {
      this.think(dt);
    }
    this.view.setFacing(this.facing);
    this.view.setOpacity(this.opacity);
    this.view.update(dt, { vx: b.vx, vy: b.vy, moving: Math.abs(b.vx) > 0.3 });
    this.view.root.position.x = b.x;
    this.view.root.position.y = b.y + this.yOff;
    this.view.root.rotation.z = this.tilt * this.facing;
    this.alert.visible = this.alertOn && !this.gone;
    if (this.alert.visible) {
      const s = 0.55 + Math.sin(this.t * 18) * 0.06;
      this.alert.scale.set(s, s, 1);
      this.alert.position.set(b.x, b.y + this.yOff + this.view.height + 0.45, 0.3);
    }
  }

  /** Zone qui blesse le héros au contact. */
  hurtRect(): { x0: number; y0: number; x1: number; y1: number } {
    const b = this.body;
    return { x0: b.x - b.w / 2, y0: b.y + this.yOff, x1: b.x + b.w / 2, y1: b.y + this.yOff + b.h };
  }

  dispose(): void {
    this.view.dispose();
    this.alert.removeFromParent();
    (this.alert.material as THREE.Material).dispose();
  }
}

// ----------------------------------------------------------------------------- singe

class Monkey extends Enemy {
  private cd = 1.2 + Math.random() * 1.5;
  private dir: 1 | -1 = 1;
  private shots = 0;
  private friend = false;

  constructor(game: Game, stage: Stage, def: EnemyDef) {
    super(game, stage, def, 0.8, 0.9);
    this.contact = false;
    this.gravity = false;
    this.hp = 1;
    if (def.x0 === undefined) {
      this.x0 = this.x1 = def.x;
    }
  }

  protected think(dt: number): void {
    const b = this.body;
    const p = this.stage.player;
    if (this.friend) {
      this.view.setPose('happy');
      return;
    }
    const dx = this.playerDX();
    const dy = this.playerDY();
    if (this.state === 'idle') {
      this.facePlayer();
      b.vx = 0;
      if (this.x1 > this.x0) {
        // Va-et-vient le long de la branche.
        b.vx = this.dir * 1.4;
        b.x += b.vx * dt;
        if (b.x > this.x1) this.dir = -1;
        if (b.x < this.x0) this.dir = 1;
        this.view.setPose('move');
      } else {
        this.view.setPose('idle');
      }
      this.cd -= dt;
      const inRange = Math.abs(dx) < 12 && dy > -9 && dy < 5 && this.stage.onScreen(b.x, b.y, 1.5);
      if (this.cd <= 0 && inRange && p.state !== 'gone') {
        this.setState('warn');
        this.showAlert(true);
        this.game.audio.sfx('monkey', 0.7);
      }
    } else if (this.state === 'warn') {
      b.vx = 0;
      this.facePlayer();
      this.view.setPose('warn');
      if (this.t >= 0.75) {
        this.throwAtPlayer();
        this.setState('attack');
        this.showAlert(false);
      }
    } else if (this.state === 'attack') {
      this.view.setPose('attack');
      if (this.t >= 0.35) {
        this.setState('idle');
        this.cd = 2.3 + Math.random() * 1.8;
      }
    }
  }

  private throwAtPlayer(): void {
    const b = this.body;
    const p = this.stage.player;
    const ammo = this.def.ammo ?? 'banana';
    const kind = ammo === 'mix' ? (this.shots++ % 2 ? 'stone' : 'banana') : ammo;
    const ox = b.x + this.facing * 0.5;
    const oy = b.y + 0.8;
    const tx = p.x + p.body.vx * 0.35;
    const ty = p.cy;
    const grav = 15;
    const time = clamp(Math.hypot(tx - ox, ty - oy) / 8.5, 0.75, 1.35);
    this.stage.spawnProjectile({
      kind, owner: 'enemy', x: ox, y: oy,
      vx: (tx - ox) / time,
      vy: (ty - oy + 0.5 * grav * time * time) / time,
      grav,
    });
    this.game.audio.sfx('throw', 0.6);
  }

  hitBy(kind: HitKind, dir: number): boolean {
    if (this.friend) return false;
    if (kind === 'banana') {
      // Une banane offerte : le singe se régale et devient un ami.
      this.friend = true;
      this.gone = true;
      this.showAlert(false);
      this.game.addScore(80);
      this.game.audio.sfx('monkey');
      this.game.audio.sfx('heart');
      this.stage.fx.star.burst({ x: this.body.x, y: this.body.y + 1.1, count: 8, speed: 2.5, life: 0.9, size: 0.3, color: 0xff8fb0, gravity: -1 });
      this.stage.spawnPickup({ kind: 'coin', x: this.body.x, y: this.home.y + 0.5 }, { pop: true });
      this.game.onMonkeyFriend();
      return true;
    }
    this.flee(dir, 3, 50);
    this.game.audio.sfx('monkey');
    return true;
  }

  repel(dir: number): void {
    if (!this.friend) super.repel(dir);
  }
}

// ----------------------------------------------------------------------------- serpent

class Snake extends Enemy {
  constructor(game: Game, stage: Stage, def: EnemyDef) {
    super(game, stage, def, 0.95, 0.8);
    this.hp = 2;
  }

  protected think(dt: number): void {
    const b = this.body;
    const dx = this.playerDX();
    const dy = this.playerDY();
    const near = Math.abs(dx) < 3.5 && dy > -1.4 && dy < 1.9;
    if (this.state === 'idle') {
      this.facePlayer();
      b.vx = approach(b.vx, 0, 30 * dt);
      this.view.setPose('idle');
      if (near && this.t > 0.5) {
        this.setState('warn');
        this.showAlert(true);
        this.game.audio.sfx('hiss');
      }
    } else if (this.state === 'warn') {
      b.vx = 0;
      this.facePlayer();
      this.view.setPose('warn');
      if (this.t >= 0.7) {
        this.setState('attack');
        this.showAlert(false);
      }
    } else if (this.state === 'attack') {
      this.view.setPose('attack');
      const ahead = groundBelow(this.stage.solids, b.x + this.facing * 0.7, b.y);
      b.vx = ahead ? this.facing * 9.5 : 0;
      if (this.t >= 0.24) this.setState('recoil');
    } else {
      // Retour à sa place, le temps de reprendre son souffle.
      this.view.setPose('idle');
      const back = this.home.x - b.x;
      b.vx = Math.abs(back) > 0.15 ? Math.sign(back) * 2.6 : 0;
      if (this.t >= 1.1) this.setState('idle');
    }
    b.vy = Math.max(b.vy - 32 * dt, -20);
    moveBody(b, this.stage.solids, dt);
  }

  hitBy(kind: HitKind, dir: number): boolean {
    if (kind === 'banana') {
      this.game.audio.sfx('bonk');
      return true;
    }
    this.hp -= kind === 'sling' ? 2 : 1;
    if (this.hp <= 0) this.flee(dir, 2, 60);
    else {
      this.stun(0.8, dir);
      this.game.audio.sfx('hit');
      this.setState('recoil');
    }
    return true;
  }
}

// ----------------------------------------------------------------------------- crocodile

class Croc extends Enemy {
  private cd = 0.5;
  private dir: 1 | -1 = 1;
  private diveT = 0;
  private surface: number;

  constructor(game: Game, stage: Stage, def: EnemyDef) {
    super(game, stage, def, 2.0, 0.55);
    this.gravity = false;
    this.surface = def.y;
    this.body.y = def.y - 0.28;
    this.view.root.position.z = 0.34;
    this.dir = def.facing ?? 1;
  }

  protected think(dt: number): void {
    const b = this.body;
    const p = this.stage.player;
    const dx = this.playerDX();
    const above = p.y - this.surface;
    this.cd = Math.max(0, this.cd - dt);
    if (this.state === 'dive') {
      // Plongé après avoir reçu une pierre : inoffensif quelques secondes.
      this.diveT -= dt;
      this.contact = false;
      this.yOff = approach(this.yOff, -1.3, 3 * dt);
      this.view.setPose('idle');
      if (this.diveT <= 0) {
        this.setState('idle');
        this.contact = true;
      }
      return;
    }
    if (this.state === 'idle') {
      this.yOff = approach(this.yOff, Math.sin(this.t * 1.6) * 0.05, 2 * dt);
      this.tilt = approach(this.tilt, 0, 3 * dt);
      b.vx = this.dir * 1.3;
      b.x += b.vx * dt;
      if (b.x > this.x1 - 1) this.dir = -1;
      if (b.x < this.x0 + 1) this.dir = 1;
      this.facing = this.dir;
      this.view.setPose('move');
      if (this.cd <= 0 && Math.abs(dx) < 2.6 && above > -0.6 && above < 4.4 && p.state !== 'gone') {
        this.setState('warn');
        this.showAlert(true);
        this.game.audio.sfx('splash', 0.35);
      }
    } else if (this.state === 'warn') {
      b.vx = 0;
      this.facePlayer();
      this.view.setPose('warn');
      if (Math.random() < dt * 14) {
        this.stage.fx.soft.burst({ x: b.x + (Math.random() - 0.5) * 1.6, y: this.surface, count: 1, speed: 1, life: 0.5, size: 0.22, color: 0xffffff, z: 0.36 });
      }
      if (this.t >= 0.8) {
        this.setState('attack');
        this.showAlert(false);
        this.game.audio.sfx('snap');
        this.stage.splash(b.x, this.surface, 1);
      }
    } else if (this.state === 'attack') {
      // Bond hors de l'eau, gueule ouverte.
      const k = clamp(this.t / 0.75, 0, 1);
      this.yOff = Math.sin(k * Math.PI) * 2.2;
      this.tilt = Math.sin(k * Math.PI) * 0.75;
      this.view.setPose('attack');
      if (this.t >= 0.75) {
        this.setState('idle');
        this.cd = 2.2;
        this.yOff = 0;
        this.stage.splash(b.x, this.surface, 0.8);
      }
    }
  }

  hurtRect(): { x0: number; y0: number; x1: number; y1: number } {
    const b = this.body;
    if (this.state === 'attack') {
      // Pendant le bond, seule la gueule dressée est dangereuse.
      const hx = b.x + this.facing * 0.5;
      return { x0: hx - 0.6, y0: b.y + this.yOff * 0.5, x1: hx + 0.6, y1: b.y + this.yOff + 1.0 };
    }
    return { x0: b.x - b.w / 2, y0: b.y + this.yOff, x1: b.x + b.w / 2, y1: b.y + this.yOff + b.h };
  }

  hitBy(kind: HitKind): boolean {
    if (kind === 'banana') {
      this.game.audio.sfx('bonk');
      return true;
    }
    if (this.state !== 'dive') {
      this.game.addScore(20);
      this.game.audio.sfx('hit');
      this.stage.splash(this.body.x, this.surface, 0.8);
    }
    this.setState('dive');
    this.diveT = kind === 'sling' ? 7 : 5;
    this.tilt = 0;
    this.showAlert(false);
    this.view.flash(0.12);
    return true;
  }

  repel(): void {
    this.hitBy('stone');
  }
}

// ----------------------------------------------------------------------------- hyène

class Hyena extends Enemy {
  private cd = 0;
  private dir: 1 | -1 = 1;

  constructor(game: Game, stage: Stage, def: EnemyDef) {
    super(game, stage, def, 1.3, 1.0);
    this.hp = 3;
  }

  protected think(dt: number): void {
    const b = this.body;
    const p = this.stage.player;
    const dx = this.playerDX();
    const dy = this.playerDY();
    const solids = this.stage.solids;
    this.cd = Math.max(0, this.cd - dt);
    const inZone = p.x > this.x0 - 1 && p.x < this.x1 + 1;
    if (this.state === 'idle') {
      // Rôde autour de sa place.
      this.view.setPose(Math.abs(b.vx) > 0.3 ? 'move' : 'idle');
      if (b.x > this.home.x + 1.5) this.dir = -1;
      if (b.x < this.home.x - 1.5) this.dir = 1;
      if (!groundBelow(solids, b.x + this.dir * 0.9, b.y) || wallAhead(solids, b.x, b.y + 0.5, this.dir * 0.9)) this.dir = (-this.dir) as 1 | -1;
      b.vx = approach(b.vx, this.dir * 1.2, 8 * dt);
      this.facing = this.dir;
      if (this.cd <= 0 && Math.abs(dx) < 7.5 && Math.abs(dy) < 2.4 && inZone && p.state !== 'gone') {
        this.setState('warn');
        this.showAlert(true);
        this.game.audio.sfx('laugh');
      }
    } else if (this.state === 'warn') {
      b.vx = approach(b.vx, 0, 30 * dt);
      this.facePlayer();
      this.view.setPose('warn');
      if (this.t >= 0.65) {
        this.setState('chase');
        this.showAlert(false);
      }
    } else if (this.state === 'chase') {
      this.facePlayer();
      this.view.setPose('attack');
      const edge = !groundBelow(solids, b.x + this.facing * 0.9, b.y, 1.0);
      const wall = wallAhead(solids, b.x, b.y + 0.5, this.facing * 0.9);
      const want = edge || wall || Math.abs(dx) < 0.3 ? 0 : this.facing * 5.3;
      b.vx = approach(b.vx, want, 26 * dt);
      if (!inZone || this.t > 6.5 || p.state === 'gone') this.setState('return');
    } else {
      // Elle abandonne et retourne à sa place.
      const back = this.home.x - b.x;
      this.facing = back >= 0 ? 1 : -1;
      this.view.setPose('move');
      b.vx = approach(b.vx, Math.abs(back) > 0.3 ? this.facing * 2.6 : 0, 12 * dt);
      if (Math.abs(back) <= 0.3 || this.t > 6) {
        this.setState('idle');
        this.cd = 1.6;
      }
    }
    b.vy = Math.max(b.vy - 32 * dt, -20);
    moveBody(b, solids, dt);
  }

  hitBy(kind: HitKind, dir: number): boolean {
    if (kind === 'banana') {
      this.game.audio.sfx('bonk');
      return true;
    }
    this.hp -= kind === 'sling' ? 2 : 1;
    if (this.hp <= 0) this.flee(dir, 4, 90);
    else {
      this.stun(0.9, dir, 5);
      this.game.audio.sfx('hit');
      if (this.state === 'idle') this.setState('warn');
    }
    return true;
  }
}

// ----------------------------------------------------------------------------- phacochère

class Warthog extends Enemy {
  private cd = 0.6;
  private run = 0;

  constructor(game: Game, stage: Stage, def: EnemyDef) {
    super(game, stage, def, 1.35, 0.95);
  }

  protected think(dt: number): void {
    const b = this.body;
    const p = this.stage.player;
    const dx = this.playerDX();
    const dy = this.playerDY();
    const solids = this.stage.solids;
    this.cd = Math.max(0, this.cd - dt);
    if (this.state === 'idle') {
      b.vx = approach(b.vx, 0, 30 * dt);
      this.view.setPose('idle');
      const inZone = p.x > this.x0 - 0.5 && p.x < this.x1 + 0.5;
      if (this.cd <= 0 && Math.abs(dx) < 8.5 && Math.abs(dy) < 1.9 && inZone && p.state !== 'gone') {
        this.facePlayer();
        this.setState('warn');
        this.showAlert(true);
        this.game.audio.sfx('snort');
      }
    } else if (this.state === 'warn') {
      // Il gratte le sol : c'est le signal de la charge.
      b.vx = 0;
      this.view.setPose('warn');
      if (Math.random() < dt * 16) this.stage.dust(b.x - this.facing * 0.5, b.y, 1);
      if (this.t >= 0.9) {
        this.setState('attack');
        this.showAlert(false);
        this.run = 0;
      }
    } else if (this.state === 'attack') {
      this.view.setPose('attack');
      b.vx = this.facing * 9.6;
      this.run += Math.abs(b.vx) * dt;
      if (Math.random() < dt * 20) this.stage.dust(b.x - this.facing * 0.6, b.y, 1);
      const edge = !groundBelow(solids, b.x + this.facing * 1.0, b.y, 1.0);
      const out = b.x < this.x0 || b.x > this.x1;
      if (edge || out || this.run > 11) {
        b.vx = 0;
        this.setState('tired');
      }
    } else {
      // Étourdi ou essoufflé : c'est le moment de le faire fuir.
      b.vx = approach(b.vx, 0, 30 * dt);
      this.view.setPose('stun');
      if (this.state === 'dizzy' && Math.random() < dt * 6) {
        this.stage.fx.star.burst({ x: b.x, y: b.y + 1.5, count: 1, speed: 1.2, life: 0.6, size: 0.26, color: 0xfff1a8 });
      }
      if (this.t >= (this.state === 'dizzy' ? 2.5 : 1.3)) {
        this.setState('idle');
        this.cd = 0.9;
      }
    }
    b.vy = Math.max(b.vy - 32 * dt, -20);
    moveBody(b, solids, dt);
    if (this.state === 'attack' && b.hitWall !== 0) {
      // Il s'est cogné : étourdi, des étoiles tournent autour de sa tête.
      this.setState('dizzy');
      this.game.audio.sfx('bonk');
      this.game.view.shake(0.08, 0.2);
      b.vx = -this.facing * 2.5;
      b.vy = 4;
    }
  }

  hitBy(kind: HitKind, dir: number): boolean {
    if (kind !== 'banana' && (this.state === 'dizzy' || this.state === 'tired')) {
      this.flee(dir, 4, 90);
      return true;
    }
    this.game.audio.sfx('bonk');
    return true;
  }

  repel(dir: number): void {
    if (this.gone) return;
    if (this.state === 'attack') {
      // Une défense au bon moment arrête la charge.
      this.setState('dizzy');
      this.body.vx = dir * 3;
      this.body.vy = 4;
      this.game.audio.sfx('deflect');
      this.view.flash(0.12);
    } else if (this.state === 'dizzy' || this.state === 'tired') {
      this.flee(dir, 4, 90);
    }
  }
}

export function createEnemy(game: Game, stage: Stage, def: EnemyDef): Enemy {
  switch (def.kind) {
    case 'singe': return new Monkey(game, stage, def);
    case 'serpent': return new Snake(game, stage, def);
    case 'croc': return new Croc(game, stage, def);
    case 'hyene': return new Hyena(game, stage, def);
    case 'phaco': return new Warthog(game, stage, def);
  }
}
