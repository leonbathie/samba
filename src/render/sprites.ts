/**
 * Outils pour afficher des images sur des plans dans la scène 3D, et effets de particules.
 */
import * as THREE from 'three';
import type { Assets } from '../core/Assets';

/** Plan unité centré. */
export const QUAD = new THREE.PlaneGeometry(1, 1);
/** Plan unité dont l'origine est en bas au centre (pieds d'un personnage, base d'un décor). */
export const QUAD_BOTTOM = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
// Géométries partagées par tous les plans : elles ne doivent jamais être libérées avec un niveau.
QUAD.userData.shared = true;
QUAD_BOTTOM.userData.shared = true;

export interface SpriteOpts {
  opacity?: number;
  color?: number;
  additive?: boolean;
  /** Conservé pour compatibilité : l'ordre de dessin suit uniquement la profondeur (z). */
  order?: number;
  bottom?: boolean;
  flip?: boolean;
  depthTest?: boolean;
}

export function spriteMaterial(tex: THREE.Texture, o: SpriteOpts = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: o.opacity ?? 1,
    color: o.color ?? 0xffffff,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    side: THREE.DoubleSide,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
}

/** Crée un plan texturé de largeur w et de hauteur h (unités du monde). */
export function makeSprite(tex: THREE.Texture, w: number, h: number, o: SpriteOpts = {}): THREE.Mesh {
  const mesh = new THREE.Mesh(o.bottom ? QUAD_BOTTOM : QUAD, spriteMaterial(tex, o));
  mesh.scale.set(o.flip ? -w : w, h, 1);
  return mesh;
}

/** Plan texturé dimensionné par sa hauteur ; la largeur suit les proportions de l'image. */
export function imageSprite(assets: Assets, id: string, h: number, o: SpriteOpts = {}): THREE.Mesh {
  return makeSprite(assets.tex(id), h * assets.aspect(id), h, o);
}

let glowTex: THREE.Texture | null = null;
/** Halo doux (lanternes, soleil, lucioles), dessiné une fois sur un canevas. */
export function softGlowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

let starTex: THREE.Texture | null = null;
export function starTexture(): THREE.Texture {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.translate(32, 32);
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 11 : 28;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  starTex = new THREE.CanvasTexture(c);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}

export function glowSprite(size: number, color: number, opacity = 0.8): THREE.Mesh {
  return makeSprite(softGlowTexture(), size, size, { additive: true, color, opacity, order: 5 });
}

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number;
  life: number; max: number;
  size: number; grow: number;
  g: number; drag: number;
  r: number; gr: number; b: number;
  spin: number; rot: number;
}

export interface Burst {
  x: number; y: number; z?: number;
  count?: number;
  speed?: number;
  /** Angle moyen (radians) et ouverture de la gerbe. */
  angle?: number; spread?: number;
  life?: number;
  size?: number; grow?: number;
  gravity?: number; drag?: number;
  color?: number;
}

/**
 * Système de particules à instances : un seul appel de dessin par système.
 * `soft` = poussière, écume, brume ; `spark` = éclats lumineux et étoiles (fusion additive).
 */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private list: Particle[] = [];
  private max: number;
  private dummy = new THREE.Object3D();
  private col = new THREE.Color();

  constructor(kind: 'soft' | 'spark' | 'star', max = 260) {
    this.max = max;
    const tex = kind === 'star' ? starTexture() : softGlowTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: kind === 'soft' ? THREE.NormalBlending : THREE.AdditiveBlending,
      opacity: kind === 'soft' ? 0.75 : 1,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(QUAD, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.mesh.setColorAt(0, this.col.set(0xffffff));
  }

  burst(b: Burst): void {
    const n = b.count ?? 8;
    const c = this.col.set(b.color ?? 0xffffff);
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = (b.angle ?? Math.PI / 2) + (Math.random() - 0.5) * (b.spread ?? Math.PI * 2);
      const sp = (b.speed ?? 2) * (0.4 + Math.random() * 0.8);
      const life = (b.life ?? 0.6) * (0.6 + Math.random() * 0.7);
      this.list.push({
        x: b.x + (Math.random() - 0.5) * 0.15,
        y: b.y + (Math.random() - 0.5) * 0.15,
        z: b.z ?? 0.4,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        max: life,
        size: (b.size ?? 0.3) * (0.7 + Math.random() * 0.6),
        grow: b.grow ?? 0,
        g: b.gravity ?? 0,
        drag: b.drag ?? 1.5,
        r: c.r, gr: c.g, b: c.b,
        spin: (Math.random() - 0.5) * 6,
        rot: Math.random() * 6.28,
      });
    }
  }

  update(dt: number): void {
    const list = this.list;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= p.g * dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      list[n++] = p;
    }
    list.length = n;
    const d = this.dummy;
    for (let i = 0; i < n; i++) {
      const p = list[i];
      const t = p.life / p.max;
      const s = Math.max(0.001, (p.size + p.grow * (1 - t)) * Math.min(1, t * 2.2));
      d.position.set(p.x, p.y, p.z);
      d.rotation.z = p.rot;
      d.scale.set(s, s, 1);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      this.mesh.setColorAt(i, this.col.setRGB(p.r, p.gr, p.b));
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    this.list.length = 0;
    this.mesh.count = 0;
  }
}

/** Nuage doux dessiné sur un canevas (ciel des niveaux en hauteur). */
export function cloudTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 192;
  const g = c.getContext('2d')!;
  const puffs: [number, number, number][] = [
    [90, 120, 62], [150, 92, 78], [215, 104, 84], [285, 122, 60], [190, 132, 70], [120, 138, 50], [250, 140, 52],
  ];
  for (const [x, y, r] of puffs) {
    const grad = g.createRadialGradient(x, y - r * 0.2, r * 0.15, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.6, 'rgba(255,246,238,0.7)');
    grad.addColorStop(1, 'rgba(255,236,226,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Écorce de baobab dessinée sur un canevas : plaques d'écorce décalées, répétable dans les deux sens. */
export function barkTexture(): THREE.Texture {
  const W = 256;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5e3415';
  g.fillRect(0, 0, W, H);
  let seed = 77;
  const r = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const cols = 6;
  const cw = W / cols;
  for (let i = 0; i < cols; i++) {
    let y = -r() * 120;
    while (y < H) {
      const h = 70 + r() * 90;
      const x = i * cw + 3 + r() * 3;
      const w = cw - 6 - r() * 4;
      for (const oy of [0, -H, H]) {
        const grad = g.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, '#d08a3e');
        grad.addColorStop(0.45, '#a9662b');
        grad.addColorStop(1, '#7a4419');
        g.fillStyle = grad;
        g.strokeStyle = '#3d1f0b';
        g.lineWidth = 3;
        g.beginPath();
        g.roundRect(x, y + oy, w, h, 12);
        g.fill();
        g.stroke();
        g.strokeStyle = 'rgba(255,196,110,0.5)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + 7, y + oy + h - 14);
        g.lineTo(x + 7, y + oy + 12);
        g.quadraticCurveTo(x + 8, y + oy + 6, x + 16, y + oy + 6);
        g.stroke();
        g.strokeStyle = 'rgba(60,30,10,0.35)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x + w * 0.55, y + oy + h * 0.2);
        g.lineTo(x + w * 0.5, y + oy + h * 0.8);
        g.stroke();
      }
      y += h + 5;
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
