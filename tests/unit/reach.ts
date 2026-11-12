/**
 * Explorateur d'accessibilité des niveaux.
 *
 * Il rejoue la physique réelle du jeu (src/game/physics.ts et src/game/tuning.ts) pour trouver
 * tous les endroits qu'un joueur peut atteindre depuis le point de départ : marche, sauts
 * (debout, en marchant, en courant), chute à travers les branches, escalade des lianes,
 * suspension aux branches, plateformes mobiles et courte échelle. Les animaux sont ignorés :
 * on peut toujours les éviter ou les repousser.
 *
 * Il sert à vérifier que chaque niveau peut réellement être terminé et que les objets importants
 * ne sont pas placés hors d'atteinte.
 */
import type { LevelDef } from '../../src/game/types';
import { type Body, type Solid, makeBody, moveBody } from '../../src/game/physics';
import { GRAV, HANG_PULL, HANG_REACH, HANG_SPEED, MAX_FALL, MOVE, PLAYER_W, STAND_H, VINE_JUMP, VINE_RUN } from '../../src/game/tuning';

const DT = 1 / 60;
const BUCKET = 0.4;

export interface Goal {
  kind: string;
  label: string;
  /** Faux pour les objets facultatifs (pièces, munitions) : signalés mais pas bloquants. */
  required: boolean;
  x0: number;
  x1: number;
  test: (x: number, y: number) => boolean;
  reached: boolean;
}

export interface ReachReport {
  goals: Goal[];
  unreached: Goal[];
  nodes: number;
  spawnOk: boolean;
}

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

export function goalsFor(def: LevelDef): Goal[] {
  const goals: Goal[] = [];
  const add = (kind: string, label: string, required: boolean, x0: number, x1: number, test: Goal['test']): void => {
    goals.push({ kind, label, required, x0, x1, test, reached: false });
  };
  for (const it of def.items) {
    const unique = !['coin', 'banana', 'bunch', 'stone', 'pile', 'heart'].includes(it.kind);
    add('item', `${it.kind}${it.id ? ' ' + it.id : ''} (${it.x.toFixed(1)}, ${it.y.toFixed(1)})`, unique, it.x - 0.7, it.x + 0.7,
      (x, y) => Math.abs(x - it.x) < 0.62 && y + 0.8 - it.y > -1.15 && y + 0.8 - it.y < 1.0);
  }
  const near = (kind: string, label: string, ix: number, iy: number, reach: number): void =>
    add(kind, `${label} (${ix.toFixed(1)}, ${iy.toFixed(1)})`, true, ix - reach, ix + reach,
      (x, y) => Math.abs(x - ix) < reach && y - iy > -1.2 && y - iy < 1.6);
  for (const d of def.doors) near('porte', d.id, d.x, d.y, 1.0);
  for (const n of def.npcs) if (n.talk) near('habitant', n.id, n.x, n.y, n.reach ?? 1.5);
  for (const c of def.chests) near('coffre', c.id, c.x, c.y, 1.3);
  def.checkpoints.forEach((c, i) =>
    add('sauvegarde', `point ${i} (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`, true, c.x - 0.9, c.x + 0.9,
      (x, y) => Math.abs(x - c.x) < 0.9 && Math.abs(y - c.y) < 1.6));
  for (const tr of def.triggers) {
    add('déclencheur', tr.id, true, tr.x0, tr.x1, (x, y) => x >= tr.x0 && x <= tr.x1 && y >= (tr.y0 ?? -1e9) && y <= (tr.y1 ?? 1e9));
  }
  if (def.exit) {
    const ex = def.exit;
    add('sortie', `sortie (${ex.x.toFixed(1)}, ${ex.y.toFixed(1)})`, true, ex.x - 1, ex.x + 1,
      (x, y) => Math.abs(x - ex.x) < 1.0 && Math.abs(y - ex.y) < 2.2);
  }
  return goals;
}

export function explore(def: LevelDef, opts: { activateHidden?: boolean } = {}): ReachReport {
  const mv = def.indoor ? MOVE.in : MOVE.out;
  const solids: Solid[] = [];
  const mover = new Map<Solid, { m: number; k: number }>();
  for (const s of def.solids) {
    if (s.hidden && !opts.activateHidden) continue;
    solids.push({ x0: s.x, x1: s.x + s.w, y0: s.y - s.h, y1: s.y, oneWay: !!s.oneWay });
  }
  const phases = [0, 0.25, 0.5, 0.75, 1];
  const moverSolids: Solid[][] = [];
  def.movers.forEach((m, i) => {
    moverSolids[i] = [];
    for (const k of phases) {
      const x = m.x + m.dx * k;
      const y = m.y + m.dy * k;
      const s: Solid = { x0: x, x1: x + m.w, y0: y - m.h, y1: y, oneWay: true };
      solids.push(s);
      mover.set(s, { m: i, k });
      moverSolids[i].push(s);
    }
  });

  const goals = goalsFor(def);
  // Index des objectifs par tranche horizontale d'une unité, pour ne tester que les plus proches.
  const bins = new Map<number, Goal[]>();
  for (const g of goals) {
    for (let b = Math.floor(g.x0); b <= Math.floor(g.x1); b++) {
      if (!bins.has(b)) bins.set(b, []);
      bins.get(b)!.push(g);
    }
  }
  const record = (x: number, y: number): void => {
    const list = bins.get(Math.floor(x));
    if (!list) return;
    for (const g of list) if (!g.reached && g.test(x, y)) g.reached = true;
  };

  const climbsDone = new Set<number>();
  const hangsDone = new Set<number>();
  const boostsDone = new Set<string>();
  const queue: { s: Solid; x: number }[] = [];
  const seen = new Set<string>();

  const dead = (b: Body): boolean => {
    if (b.y < def.bounds.minY - 2.5) return true;
    for (const w of def.waters) if (b.x >= w.x0 && b.x <= w.x1 && b.y + 0.55 < w.y) return true;
    return false;
  };

  const pending: (() => void)[] = [];

  const touch = (b: Body): void => {
    record(b.x, b.y);
    def.climbs.forEach((c, i) => {
      if (climbsDone.has(i)) return;
      if (Math.abs(b.x - c.x) < 0.5 && b.y + STAND_H > c.y0 && b.y <= c.y1 + 0.05) {
        climbsDone.add(i);
        pending.push(() => climbFrom(i));
      }
    });
    if (!b.onGround) {
      def.hangs.forEach((h, i) => {
        if (hangsDone.has(i)) return;
        if (b.x >= h.x0 && b.x <= h.x1 && Math.abs(b.y + STAND_H - h.y) < HANG_REACH) {
          hangsDone.add(i);
          pending.push(() => hangFrom(i));
        }
      });
    }
  };

  /** Simule un mouvement ; renvoie le corps posé au sol à la fin, ou null (chute mortelle, pas d'atterrissage). */
  const run = (
    x: number, y: number, vx: number, vy: number, ax: number, max: number,
    o: { ground?: boolean; walk?: number; drop?: boolean; time?: number } = {},
  ): Body | null => {
    const b = makeBody(x, y, PLAYER_W, STAND_H);
    b.vx = vx;
    b.vy = vy;
    b.onGround = !!o.ground;
    if (o.drop) b.dropTimer = 0.24;
    let airborne = !b.onGround;
    const time = o.time ?? 3;
    for (let t = 0; t < time; t += DT) {
      const acc = b.onGround ? (ax !== 0 ? mv.acc : mv.dec) : mv.air;
      b.vx = approach(b.vx, ax * max, acc * DT);
      b.vy = Math.max(b.vy - GRAV * DT, -MAX_FALL);
      moveBody(b, solids, DT);
      touch(b);
      if (dead(b)) return null;
      if (!b.onGround) airborne = true;
      else if (airborne && b.ground) return b;
      if (o.walk !== undefined && b.onGround && t >= o.walk) return b;
    }
    return b.onGround ? b : null;
  };

  const push = (b: Body | null): void => {
    if (!b || !b.ground) return;
    const s = b.ground;
    const key = solids.indexOf(s) + ':' + Math.round(b.x / BUCKET);
    if (seen.has(key)) return;
    seen.add(key);
    queue.push({ s, x: b.x });
    // Sur une plateforme mobile : on peut s'y laisser porter jusqu'à ses autres positions.
    const mm = mover.get(s);
    if (mm) {
      for (const other of moverSolids[mm.m]) {
        if (other === s) continue;
        const ox = b.x - s.x0 + other.x0;
        const k2 = solids.indexOf(other) + ':' + Math.round(ox / BUCKET);
        if (seen.has(k2)) continue;
        seen.add(k2);
        queue.push({ s: other, x: ox });
      }
    }
  };

  const climbFrom = (i: number): void => {
    const c = def.climbs[i];
    push(run(c.x, c.y1 + 0.02, 0, 0, 0, mv.walk, { time: 2 }));
    for (let y = c.y0; y <= c.y1; y += 0.5) {
      for (const dir of [-1, 0, 1]) push(run(c.x, y, dir * mv.run * VINE_RUN, mv.jump * VINE_JUMP, dir, mv.walk));
    }
  };

  const hangFrom = (i: number): void => {
    const h = def.hangs[i];
    for (let x = h.x0; x <= h.x1 + 0.01; x += 0.5) {
      for (const dir of [-1, 0, 1]) {
        push(run(x, h.y - STAND_H, dir * HANG_SPEED, mv.jump * HANG_PULL, dir, mv.walk));
        push(run(x, h.y - STAND_H, 0, -1, dir, mv.walk));
      }
    }
  };

  const boosts = def.npcs.filter((n) => n.boost);

  // Départ : le héros tombe sur le sol le plus proche sous le point de départ.
  const start = run(def.spawn.x, def.spawn.y, 0, 0, 0, mv.walk, { time: 3 });
  const spawnOk = !!start;
  push(start);

  let guard = 0;
  while ((queue.length || pending.length) && guard++ < 200000) {
    if (!queue.length) {
      pending.shift()!();
      continue;
    }
    const { s, x } = queue.shift()!;
    const y = s.y1;
    record(x, y);
    // Marche dans les deux sens (on tombe éventuellement d'un bord).
    for (const dir of [-1, 1]) push(run(x, y, 0, 0, dir, mv.run, { ground: true, walk: 0.3 }));
    // Sauts : debout, en marchant, en courant (la course demande un peu d'élan).
    const runway = s.x1 - s.x0 >= 2.0;
    for (const dir of [-1, 0, 1]) {
      push(run(x, y, 0, mv.jump, dir, mv.walk, { ground: true }));
      push(run(x, y, dir * mv.walk, mv.jump, dir, mv.walk, { ground: true }));
      if (runway && dir !== 0) push(run(x, y, dir * mv.run, mv.jump, dir, mv.run, { ground: true }));
      if (s.oneWay) push(run(x, y, 0, 0, dir, mv.walk, { drop: true }));
    }
    // Courte échelle d'un personnage.
    for (const n of boosts) {
      const key = n.id + ':' + Math.round(x / BUCKET);
      if (boostsDone.has(key)) continue;
      if (Math.abs(x - n.x) < (n.reach ?? 1.5) && y - n.y > -1.2 && y - n.y < 1.6) {
        boostsDone.add(key);
        for (const dir of [-1, 0, 1]) push(run(x, y, dir * mv.walk, n.boost!, dir, mv.walk, { ground: true }));
      }
    }
    // Saut au bord des surfaces : position extrême où l'on tient encore debout.
    for (const edge of [s.x0 - PLAYER_W / 2 + 0.02, s.x1 + PLAYER_W / 2 - 0.02]) {
      if (Math.abs(edge - x) > BUCKET * 1.2) continue;
      const dir = edge < x ? -1 : 1;
      push(run(edge, y, dir * mv.walk, mv.jump, dir, mv.walk, { ground: true }));
      if (runway) push(run(edge, y, dir * mv.run, mv.jump, dir, mv.run, { ground: true }));
    }
  }

  return { goals, unreached: goals.filter((g) => !g.reached), nodes: seen.size, spawnOk };
}
