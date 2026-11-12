/**
 * Physique de plateformes : boîtes alignées sur les axes, plateformes traversables par le dessous
 * et plateformes mobiles. Ce module ne dépend pas du rendu : il est testé seul (tests/unit).
 */
export interface Solid {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Traversable par le dessous et les côtés ; on ne s'y pose qu'en tombant dessus. */
  oneWay?: boolean;
  /** Désactivé : ignoré par les collisions (portes ouvertes, plateformes qui apparaissent). */
  off?: boolean;
  /** Déplacement appliqué pendant l'image en cours (plateformes mobiles). */
  dx?: number;
  dy?: number;
  tag?: string;
}

export interface Body {
  /** Centre horizontal. */
  x: number;
  /** Bas du corps. */
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  ground: Solid | null;
  hitWall: -1 | 0 | 1;
  hitCeil: boolean;
  /** Durée restante pendant laquelle le corps traverse les plateformes à sens unique. */
  dropTimer: number;
}

export function makeBody(x: number, y: number, w: number, h: number): Body {
  return { x, y, w, h, vx: 0, vy: 0, onGround: false, ground: null, hitWall: 0, hitCeil: false, dropTimer: 0 };
}

const EPS = 0.0005;

export function overlaps(b: Body, s: Solid): boolean {
  return b.x + b.w / 2 > s.x0 && b.x - b.w / 2 < s.x1 && b.y + b.h > s.y0 && b.y < s.y1;
}

export function rectsOverlap(
  ax0: number, ay0: number, ax1: number, ay1: number,
  bx0: number, by0: number, bx1: number, by1: number,
): boolean {
  return ax1 > bx0 && ax0 < bx1 && ay1 > by0 && ay0 < by1;
}

/** Déplace un corps pendant dt en résolvant les collisions, d'abord en X puis en Y. */
export function moveBody(b: Body, solids: readonly Solid[], dt: number): void {
  b.hitWall = 0;
  b.hitCeil = false;
  if (b.dropTimer > 0) b.dropTimer = Math.max(0, b.dropTimer - dt);

  // Le corps posé sur une plateforme mobile est d'abord transporté par elle.
  const carrier = b.ground;
  if (carrier && !carrier.off && (carrier.dx || carrier.dy)) {
    b.x += carrier.dx ?? 0;
    b.y += carrier.dy ?? 0;
  }

  // --- axe horizontal
  b.x += b.vx * dt;
  for (const s of solids) {
    if (s.off || s.oneWay || !overlaps(b, s)) continue;
    const fromLeft = b.x < (s.x0 + s.x1) / 2;
    if (b.vx > 0 || (b.vx === 0 && fromLeft)) {
      b.x = s.x0 - b.w / 2 - EPS;
      if (b.vx > 0) b.hitWall = 1;
    } else {
      b.x = s.x1 + b.w / 2 + EPS;
      if (b.vx < 0) b.hitWall = -1;
    }
    b.vx = 0;
  }

  // --- axe vertical
  const prevBottom = b.y;
  const prevTop = b.y + b.h;
  b.y += b.vy * dt;
  b.onGround = false;
  b.ground = null;
  for (const s of solids) {
    if (s.off) continue;
    if (b.x + b.w / 2 <= s.x0 || b.x - b.w / 2 >= s.x1) continue;
    const lift = Math.max(0, s.dy ?? 0);
    if (s.oneWay) {
      if (b.dropTimer > 0) continue;
      if (b.vy <= 0 && prevBottom >= s.y1 - lift - 0.02 && b.y <= s.y1) {
        b.y = s.y1;
        b.vy = 0;
        b.onGround = true;
        b.ground = s;
      }
      continue;
    }
    if (b.y + b.h <= s.y0 || b.y >= s.y1) continue;
    if (b.vy <= 0 && prevBottom >= s.y1 - lift - 0.35) {
      b.y = s.y1;
      b.vy = 0;
      b.onGround = true;
      b.ground = s;
    } else if (b.vy > 0 && prevTop <= s.y0 + 0.35) {
      b.y = s.y0 - b.h - EPS;
      b.vy = 0;
      b.hitCeil = true;
    } else {
      // Corps coincé dans un solide (plateforme mobile, apparition) : on sort par le plus court chemin.
      const up = s.y1 - b.y;
      const down = b.y + b.h - s.y0;
      const left = b.x + b.w / 2 - s.x0;
      const right = s.x1 - (b.x - b.w / 2);
      const m = Math.min(up, down, left, right);
      if (m === up) {
        b.y = s.y1;
        b.vy = Math.max(0, b.vy);
        b.onGround = true;
        b.ground = s;
      } else if (m === down) {
        b.y = s.y0 - b.h - EPS;
        b.vy = Math.min(0, b.vy);
      } else if (m === left) {
        b.x = s.x0 - b.w / 2 - EPS;
      } else {
        b.x = s.x1 + b.w / 2 + EPS;
      }
    }
  }
}

/** Vrai si un sol solide se trouve juste sous le point (x, y) : sert aux ennemis pour ne pas tomber d'un bord. */
export function groundBelow(solids: readonly Solid[], x: number, y: number, depth = 0.6): boolean {
  for (const s of solids) {
    if (s.off) continue;
    if (x > s.x0 && x < s.x1 && s.y1 <= y + 0.05 && s.y1 >= y - depth) return true;
  }
  return false;
}

/** Vrai si le segment horizontal allant de x à x+dx à la hauteur y rencontre un mur plein. */
export function wallAhead(solids: readonly Solid[], x: number, y: number, dx: number): boolean {
  const x0 = Math.min(x, x + dx);
  const x1 = Math.max(x, x + dx);
  for (const s of solids) {
    if (s.off || s.oneWay) continue;
    if (x1 > s.x0 && x0 < s.x1 && y > s.y0 && y < s.y1) return true;
  }
  return false;
}
