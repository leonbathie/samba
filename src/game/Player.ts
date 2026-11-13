/**
 * Ousmane, le héros : déplacement, saut, accroupissement, escalade, suspension aux branches,
 * lancers (banane, pierre, lance-pierre), défense, blessure et protection temporaire.
 */
import type { Game } from './Game';
import type { Stage } from './Stage';
import type { ClimbDef, HangDef } from './types';
import { type Body, makeBody, moveBody, overlaps } from './physics';
import { CharacterView } from '../render/characters';
import { HERO } from './characterDefs';
import { ContactShadow } from '../render/sprites';
import { approach, clamp, damp, lerp, smooth } from '../core/math';
import type { Weapon } from '../core/Save';

import { CROUCH_H, GRAV, HANG_PULL, HANG_SPEED, MAX_FALL, MOVE, PLAYER_W, STAND_H, VINE_JUMP, VINE_RUN } from './tuning';

export type PlayerState = 'normal' | 'climb' | 'hang' | 'hurt' | 'locked' | 'gone';

export class Player {
  readonly body: Body = makeBody(0, 0, PLAYER_W, STAND_H);
  readonly view: CharacterView;
  facing: 1 | -1 = 1;
  state: PlayerState = 'normal';
  crouch = false;
  invuln = 0;
  /** Dernière position sûre au sol : sert au retour après une chute rattrapée par une plume. */
  lastSafe = { x: 0, y: 0 };
  guardT = 0;
  /** Pose imposée par un script (dialogue, fête). */
  forcedPose: string | null = null;

  private coyote = 0;
  private jumpBuf = 0;
  private throwCd = 0;
  private windT = 0;
  private postT = 0;
  private throwKind: Weapon = 'banana';
  private guardCd = 0;
  private guardHit = new Set<object>();
  private landT = 0;
  private hurtT = 0;
  private runT = 0;
  private stepT = 0;
  private grabLock = 0;
  /** Saut « complet » (se hisser sur une branche) : la hauteur ne dépend pas de la durée d'appui. */
  private fullJump = 0;
  private climb: ClimbDef | null = null;
  private hang: HangDef | null = null;
  private climbing = false;
  private noAmmoHint = 0;
  private pendingBoost = 0;
  private visOff = 0;
  private shadow = new ContactShadow(0.9);

  constructor(private game: Game, private stage: Stage) {
    this.view = new CharacterView(game.assets, HERO, game.models);
    this.view.setPose('idle');
    this.view.root.position.z = 0.1;
    stage.root.add(this.view.root);
  }

  get x(): number {
    return this.body.x;
  }

  get y(): number {
    return this.body.y;
  }

  /** Centre du corps (visée des ennemis). */
  get cy(): number {
    return this.body.y + this.body.h * 0.55;
  }

  place(x: number, y: number): void {
    const b = this.body;
    b.x = x;
    b.y = y;
    b.vx = b.vy = 0;
    b.ground = null;
    this.state = 'normal';
    this.setCrouch(false);
    this.climb = null;
    this.hang = null;
    this.lastSafe = { x, y };
    this.sync();
  }

  /** Propulsion vers le haut (courte échelle) : appliquée dès que le héros est de nouveau libre. */
  boost(speed: number): void {
    this.pendingBoost = speed;
  }

  lock(on: boolean): void {
    if (on) {
      if (this.state !== 'gone') this.state = 'locked';
      this.body.vx = 0;
    } else if (this.state === 'locked') {
      this.state = 'normal';
    }
  }

  private setCrouch(on: boolean): void {
    if (on === this.crouch) return;
    if (!on) {
      // On ne se relève que s'il y a la place.
      this.body.h = STAND_H;
      for (const s of this.stage.solids) {
        if (!s.off && !s.oneWay && overlaps(this.body, s)) {
          this.body.h = CROUCH_H;
          return;
        }
      }
    } else {
      this.body.h = CROUCH_H;
    }
    this.crouch = on;
  }

  update(dt: number): void {
    const g = this.game;
    const input = g.input;
    const b = this.body;
    const mv = this.stage.def.indoor ? MOVE.in : MOVE.out;
    this.invuln = Math.max(0, this.invuln - dt);
    this.throwCd = Math.max(0, this.throwCd - dt);
    this.guardCd = Math.max(0, this.guardCd - dt);
    this.landT = Math.max(0, this.landT - dt);
    this.grabLock = Math.max(0, this.grabLock - dt);
    this.fullJump = Math.max(0, this.fullJump - dt);
    this.noAmmoHint = Math.max(0, this.noAmmoHint - dt);
    this.postT = Math.max(0, this.postT - dt);

    if (this.state === 'gone') return;

    if (this.state === 'locked') {
      b.vx = approach(b.vx, 0, mv.dec * dt);
      b.vy = Math.max(b.vy - GRAV * dt, -MAX_FALL);
      moveBody(b, this.stage.solids, dt);
      this.finish(dt, false);
      return;
    }

    if (this.state === 'hurt') {
      this.hurtT -= dt;
      b.vy = Math.max(b.vy - GRAV * dt, -MAX_FALL);
      moveBody(b, this.stage.solids, dt);
      if (this.hurtT <= 0) this.state = 'normal';
      this.finish(dt, false);
      return;
    }

    if (this.pendingBoost > 0 && this.state === 'normal') {
      b.vy = this.pendingBoost;
      b.onGround = false;
      this.pendingBoost = 0;
      this.fullJump = 0.7;
      this.coyote = 0;
      g.audio.sfx('jump');
      this.stage.dust(b.x, b.y, 8);
    }
    const ax = input.axisX();
    const ay = input.axisY();
    if (ax !== 0) this.facing = ax > 0 ? 1 : -1;
    if (input.wasPressed('jump')) this.jumpBuf = 0.13;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);

    if (this.state === 'climb' && this.climb) this.updateClimb(dt, ax, ay, mv);
    else if (this.state === 'hang' && this.hang) this.updateHang(dt, ax, ay, mv);
    else this.updateNormal(dt, ax, ay, mv);

    this.updateActions(dt);
    this.finish(dt, ax !== 0 || (this.climbing && ay !== 0));
  }

  private updateNormal(dt: number, ax: number, ay: number, mv: typeof MOVE.out): void {
    const input = this.game.input;
    const b = this.body;
    const wasGround = b.onGround;
    const fallSpeed = b.vy;

    // Prise d'une liane, d'une échelle ou d'un tronc.
    if (this.grabLock <= 0 && ay !== 0) {
      const c = this.stage.climbAt(b.x, b.y, b.h);
      if (c) {
        const atTop = b.y >= c.y1 - 0.08;
        if ((ay > 0 && !atTop) || (ay < 0 && atTop && c.y1 - c.y0 > 0.6) || (ay < 0 && !b.onGround)) {
          this.state = 'climb';
          this.climb = c;
          this.setCrouch(false);
          b.vx = b.vy = 0;
          if (ay < 0 && atTop) b.y = c.y1 - 0.12;
          this.game.audio.sfx('grab');
          return;
        }
      }
    }

    // Accroupissement.
    const wantCrouch = ay < 0 && b.onGround && !this.stage.def.indoor;
    if (wantCrouch !== this.crouch) this.setCrouch(wantCrouch);

    if (ax !== 0 && b.onGround) this.runT += dt;
    else if (ax === 0) this.runT = 0;
    let max = lerp(mv.walk, mv.run, smooth(this.runT / 0.4));
    if (this.crouch) max = 1.3;
    if (this.guardT > 0) max *= 0.3;
    const acc = b.onGround ? (ax !== 0 ? mv.acc : mv.dec) : mv.air;
    b.vx = approach(b.vx, ax * max, acc * dt);

    if (b.onGround) this.coyote = 0.1;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.jumpBuf = 0;
      this.coyote = 0;
      if (ay < 0 && b.ground?.oneWay) {
        // Bas + saut : on se laisse tomber à travers une branche ou une dalle.
        b.dropTimer = 0.24;
      } else {
        b.vy = mv.jump;
        this.setCrouch(false);
        this.game.audio.sfx('jump');
        this.stage.dust(b.x, b.y, 5);
      }
    }
    let grav = GRAV;
    if (b.vy > 0 && !input.isDown('jump') && this.fullJump <= 0) grav *= 2.3;
    b.vy = Math.max(b.vy - grav * dt, -MAX_FALL);
    moveBody(b, this.stage.solids, dt);

    if (!wasGround && b.onGround) {
      this.landT = fallSpeed < -9 ? 0.16 : 0.07;
      this.view.squash(clamp(-fallSpeed * 0.012, 0.05, 0.22));
      if (fallSpeed < -6) {
        this.game.audio.sfx('land', clamp(-fallSpeed / 16, 0.4, 1));
        this.stage.dust(b.x, b.y, 6);
      }
    }
    if (b.onGround && Math.abs(b.vx) > 3) {
      this.stepT -= dt * Math.abs(b.vx);
      if (this.stepT <= 0) {
        this.stepT = 2.1;
        this.game.audio.sfx('step');
        if (Math.abs(b.vx) > 5.5) this.stage.dust(b.x - this.facing * 0.2, b.y, 1);
      }
    }

    // Suspension à une branche : en l'air, mains à hauteur de la branche.
    if (!b.onGround && this.grabLock <= 0 && !this.crouch) {
      const h = this.stage.hangAt(b.x, b.y + STAND_H);
      // On attrape la branche en montant, ou en retombant si l'on tient « haut » (ou si la chute est lente).
      if (h && (b.vy > 0 || ay > 0 || b.vy > -6)) {
        this.state = 'hang';
        this.hang = h;
        b.vx = b.vy = 0;
        b.y = h.y - STAND_H;
        this.game.audio.sfx('grab');
      }
    }

    if (b.onGround && b.ground && !b.ground.dx && !b.ground.dy && !b.ground.tag) {
      // Position sûre : au sol, loin du bord, sur un sol fixe.
      const s = b.ground;
      if (b.x > s.x0 + 0.5 && b.x < s.x1 - 0.5) this.lastSafe = { x: b.x, y: b.y };
    }
  }

  private updateClimb(dt: number, ax: number, ay: number, mv: typeof MOVE.out): void {
    const b = this.body;
    const c = this.climb!;
    b.vx = b.vy = 0;
    b.onGround = false;
    b.ground = null;
    b.x = damp(b.x, c.x, 18, dt);
    this.climbing = ay !== 0;
    b.y += ay * mv.climb * dt;
    if (b.y >= c.y1) {
      // Arrivé en haut : on se retrouve debout sur la branche ou le rebord.
      b.y = c.y1 + 0.02;
      this.state = 'normal';
      this.climb = null;
      this.climbing = false;
      this.grabLock = 0.25;
      return;
    }
    if (b.y <= c.y0) {
      b.y = c.y0;
      if (ay < 0) {
        this.state = 'normal';
        this.climb = null;
        this.climbing = false;
        this.grabLock = 0.3;
        return;
      }
    }
    if (this.jumpBuf > 0) {
      this.jumpBuf = 0;
      this.state = 'normal';
      this.climb = null;
      this.climbing = false;
      this.grabLock = 0.28;
      b.vy = mv.jump * VINE_JUMP;
      b.vx = ax * mv.run * VINE_RUN;
      this.game.audio.sfx('jump');
    }
  }

  private updateHang(dt: number, ax: number, ay: number, mv: typeof MOVE.out): void {
    const b = this.body;
    const h = this.hang!;
    b.vy = 0;
    b.onGround = false;
    b.ground = null;
    b.vx = ax * HANG_SPEED;
    b.x = clamp(b.x + b.vx * dt, h.x0, h.x1);
    b.y = h.y - STAND_H;
    this.climbing = ax !== 0;
    if (this.jumpBuf > 0 || ay < 0) {
      const up = this.jumpBuf > 0 && ay >= 0;
      this.jumpBuf = 0;
      this.state = 'normal';
      this.hang = null;
      this.climbing = false;
      this.grabLock = 0.35;
      // Saut : on se hisse au-dessus de la branche ; bas : on se laisse tomber.
      b.vy = up ? mv.jump * HANG_PULL : -1;
      if (up) {
        this.fullJump = 0.5;
        this.game.audio.sfx('jump');
      }
    }
  }

  private updateActions(dt: number): void {
    const g = this.game;
    const input = g.input;
    const p = g.progress;
    const free = this.state === 'normal';

    if (input.wasPressed('switch')) g.cycleWeapon();

    // Défense : repousse les ennemis proches et renvoie les projectiles.
    if (input.wasPressed('defend') && this.guardCd <= 0 && free && this.windT <= 0) {
      this.guardT = 0.42;
      this.guardCd = 0.85;
      this.guardHit.clear();
      g.audio.sfx('guard');
      this.stage.fx.spark.burst({
        x: this.x + this.facing * 0.7, y: this.y + 0.9, count: 7, speed: 3.5,
        angle: this.facing > 0 ? 0 : Math.PI, spread: 1.6, life: 0.3, size: 0.22, color: 0xffe9a0,
      });
    }
    if (this.guardT > 0) {
      this.guardT -= dt;
      this.stage.guardSweep(this, this.guardHit);
    }

    // Lancer de l'objet équipé.
    if (input.wasPressed('throw') && this.throwCd <= 0 && this.windT <= 0 && this.guardT <= 0 && this.state !== 'locked') {
      const w = p.equipped;
      const ammo = w === 'banana' ? p.bananas : p.stones;
      if (ammo <= 0) {
        g.audio.sfx('click');
        if (this.noAmmoHint <= 0) {
          this.noAmmoHint = 3;
          g.toast(w === 'banana' ? 'toast.noBananas' : 'toast.noStones');
        }
      } else {
        this.throwKind = w;
        this.windT = w === 'sling' ? 0.17 : 0.1;
        this.throwCd = w === 'sling' ? 0.62 : 0.46;
      }
    }
    if (this.windT > 0) {
      this.windT -= dt;
      if (this.windT <= 0) {
        this.fire();
        this.postT = 0.2;
      }
    }

    // Interaction avec un habitant, une porte, un coffre.
    if (input.wasPressed('interact') && (free || this.state === 'climb')) {
      const target = this.stage.interactTarget;
      if (target) {
        input.consume('interact');
        target.interact();
      }
    }
  }

  private fire(): void {
    const g = this.game;
    const p = g.progress;
    const w = this.throwKind;
    if (w === 'banana') p.bananas = Math.max(0, p.bananas - 1);
    else p.stones = Math.max(0, p.stones - 1);
    g.ui.hud();
    const up = g.input.isDown('up');
    const down = g.input.isDown('down') && !this.body.onGround;
    const ox = this.x + this.facing * 0.45;
    const oy = this.y + (this.crouch ? 0.55 : 1.05);
    const spec = w === 'banana'
      ? { speed: 11.5, angle: up ? 62 : 26, grav: 20 }
      : w === 'stone'
        ? { speed: 13.5, angle: up ? 58 : 18, grav: 22 }
        : { speed: 23, angle: up ? 42 : down ? -32 : 5, grav: 9 };
    let ang = (spec.angle * Math.PI) / 180;
    // Aide à la visée : si une cible se trouve devant, le tir est ajusté vers elle.
    if (!up && !down) {
      const aim = this.stage.aimAssist(this.x, ox, oy, this.facing, spec.speed, spec.grav, w === 'banana' ? 9 : w === 'stone' ? 10 : 15, w);
      if (aim !== null) ang = aim;
    }
    this.stage.spawnProjectile({
      kind: w, owner: 'player', x: ox, y: oy,
      vx: Math.cos(ang) * spec.speed * this.facing, vy: Math.sin(ang) * spec.speed, grav: spec.grav,
    });
    g.audio.sfx(w === 'sling' ? 'sling' : 'throw');
  }

  /** Le héros est touché. Renvoie vrai si un cœur a été perdu. */
  hurt(fromX: number): boolean {
    if (this.invuln > 0 || this.state === 'gone' || this.state === 'locked') return false;
    const g = this.game;
    const p = g.progress;
    const dir = this.x >= fromX ? 1 : -1;
    this.invuln = 1.6;
    this.windT = 0;
    this.guardT = 0;
    this.climb = null;
    this.hang = null;
    this.climbing = false;
    this.setCrouch(false);
    this.view.flash(0.14);
    g.view.shake(0.09, 0.2);
    if (p.shield) {
      // Le bouclier absorbe le coup.
      p.shield = false;
      g.audio.sfx('deflect');
      g.toast('toast.shieldBroken');
      g.ui.hud();
      this.body.vx = dir * 4;
      this.body.vy = 5;
      return false;
    }
    p.hearts = Math.max(0, p.hearts - 1);
    g.audio.sfx('hurt');
    g.ui.hud();
    this.stage.fx.star.burst({ x: this.x, y: this.y + 1, count: 6, speed: 4, life: 0.5, size: 0.3, color: 0xfff1a8, gravity: 6 });
    this.state = 'hurt';
    this.hurtT = 0.36;
    this.body.vx = dir * 6;
    this.body.vy = 7.5;
    this.body.onGround = false;
    if (p.hearts <= 0) g.onDefeat();
    return true;
  }

  private finish(dt: number, moving: boolean): void {
    const b = this.body;
    let pose: string;
    if (this.forcedPose) pose = this.forcedPose;
    else if (this.state === 'hurt') pose = 'hurt';
    else if (this.state === 'climb') pose = 'climb';
    else if (this.state === 'hang') pose = 'hang';
    else if (this.guardT > 0) pose = 'guard';
    else if (this.windT > 0) pose = this.throwKind === 'banana' ? 'bananaWind' : this.throwKind === 'stone' ? 'stoneWind' : 'slingAim';
    else if (this.postT > 0) pose = this.throwKind === 'banana' ? 'throw' : this.throwKind === 'stone' ? 'stoneThrow' : 'slingFire';
    else if (!b.onGround) pose = b.vy > 0 ? 'jump' : 'fall';
    else if (this.landT > 0.07) pose = 'land';
    else if (this.crouch) pose = 'crouch';
    else if (Math.abs(b.vx) > 0.5) pose = 'run';
    else pose = 'idle';
    this.view.setPose(pose);
    this.view.setFacing(this.facing);
    // Clignotement pendant la protection temporaire.
    this.view.setOpacity(this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0 ? 0.35 : 1);
    this.view.update(dt, { vx: b.vx, vy: b.vy, moving });
    // Les pieds se posent sur le vrai dessus de l'image (branche courbe, muret irrégulier).
    const off = b.onGround && this.state !== 'hang' ? this.stage.surfaceOffset(b.ground, b.x) : 0;
    this.visOff += (off - this.visOff) * Math.min(1, dt * 18);
    this.sync();
    if (!this.shadow.mesh.parent) this.stage.root.add(this.shadow.mesh);
    const gy = b.onGround ? b.y + this.visOff : this.stage.groundBelow(b.x, b.y);
    const k = this.state === 'gone' || gy === null ? 0 : b.onGround ? 1 : clamp(1 - (b.y - gy) / 4.5, 0, 1);
    this.shadow.set(b.x, gy ?? b.y, 0.09, k * (this.invuln > 0 ? 0.7 : 1));
  }

  sync(): void {
    this.view.root.position.x = this.body.x;
    this.view.root.position.y = this.body.y + this.visOff;
  }

  dispose(): void {
    this.view.dispose();
    this.shadow.dispose();
  }
}
