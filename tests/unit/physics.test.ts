import { describe, expect, it } from 'vitest';
import { type Solid, groundBelow, makeBody, moveBody, wallAhead } from '../../src/game/physics';

const DT = 1 / 60;
const floor: Solid = { x0: -10, x1: 10, y0: -1, y1: 0 };

function fall(b: ReturnType<typeof makeBody>, solids: Solid[], frames = 120): void {
  for (let i = 0; i < frames; i++) {
    b.vy = Math.max(b.vy - 32 * DT, -21);
    moveBody(b, solids, DT);
  }
}

describe('physique des plateformes', () => {
  it('un corps qui tombe se pose sur le sol', () => {
    const b = makeBody(0, 3, 0.6, 1.5);
    fall(b, [floor]);
    expect(b.onGround).toBe(true);
    expect(b.y).toBeCloseTo(0, 5);
    expect(b.ground).toBe(floor);
  });

  it('un mur arrête le déplacement horizontal', () => {
    const wall: Solid = { x0: 2, x1: 3, y0: 0, y1: 4 };
    const b = makeBody(0, 0, 0.6, 1.5);
    for (let i = 0; i < 120; i++) {
      b.vx = 5;
      b.vy = Math.max(b.vy - 32 * DT, -21);
      moveBody(b, [floor, wall], DT);
    }
    expect(b.x).toBeLessThanOrEqual(2 - 0.3);
    expect(b.hitWall).toBe(1);
  });

  it('une plateforme à sens unique se traverse par le dessous mais porte par le dessus', () => {
    const branch: Solid = { x0: -2, x1: 2, y0: 1.6, y1: 2, oneWay: true };
    const b = makeBody(0, 0, 0.6, 1.5);
    b.vy = 12;
    let maxY = 0;
    for (let i = 0; i < 120; i++) {
      b.vy = Math.max(b.vy - 32 * DT, -21);
      moveBody(b, [floor, branch], DT);
      maxY = Math.max(maxY, b.y);
    }
    expect(maxY).toBeGreaterThan(2);
    expect(b.onGround).toBe(true);
    expect(b.ground).toBe(branch);
  });

  it('bas + saut : on se laisse tomber à travers une branche', () => {
    const branch: Solid = { x0: -2, x1: 2, y0: 1.6, y1: 2, oneWay: true };
    const b = makeBody(0, 2, 0.6, 1.5);
    fall(b, [floor, branch], 10);
    expect(b.ground).toBe(branch);
    b.dropTimer = 0.24;
    fall(b, [floor, branch]);
    expect(b.ground).toBe(floor);
  });

  it('une plateforme mobile transporte le corps posé dessus', () => {
    const boat: Solid = { x0: 0, x1: 3, y0: -0.4, y1: 0, oneWay: true, dx: 0, dy: 0 };
    const b = makeBody(1.5, 0.2, 0.6, 1.5);
    fall(b, [boat], 20);
    expect(b.ground).toBe(boat);
    for (let i = 0; i < 60; i++) {
      boat.dx = 0.05;
      boat.x0 += 0.05;
      boat.x1 += 0.05;
      b.vy = Math.max(b.vy - 32 * DT, -21);
      moveBody(b, [boat], DT);
    }
    expect(b.x).toBeCloseTo(4.5, 1);
    expect(b.ground).toBe(boat);
  });

  it('détection du vide et des murs pour les animaux', () => {
    expect(groundBelow([floor], 0, 0)).toBe(true);
    expect(groundBelow([floor], 12, 0)).toBe(false);
    const wall: Solid = { x0: 2, x1: 3, y0: 0, y1: 4 };
    expect(wallAhead([wall], 1, 0.5, 1.5)).toBe(true);
    expect(wallAhead([wall], 1, 0.5, -1.5)).toBe(false);
  });
});
