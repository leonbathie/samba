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

/** Écorce de baobab dessinée sur un canevas : fibres verticales ondulées, répétable dans les deux sens. */
export function barkTexture(): THREE.Texture {
  const W = 256;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a4219';
  g.fillRect(0, 0, W, H);
  let seed = 77;
  const r = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Une fibre : courbe verticale ondulée, dessinée trois fois pour se raccorder horizontalement.
  const fibre = (x0: number, width: number, color: string, amp: number, k: number, phase: number): void => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    for (const ox of [-W, 0, W]) {
      g.beginPath();
      for (let y = -4; y <= H + 4; y += 8) {
        const x = x0 + ox + Math.sin((y / H) * Math.PI * 2 * k + phase) * amp;
        if (y < 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  };
  const tones = ['#8f4f20', '#a55f28', '#b86e31', '#c7803c', '#9a5524', '#d39150'];
  for (let i = 0; i < 52; i++) {
    fibre(r() * W, 5 + r() * 16, tones[Math.floor(r() * tones.length)], 3 + r() * 7, 1 + Math.floor(r() * 2), r() * 6.3);
  }
  g.globalAlpha = 0.75;
  for (let i = 0; i < 30; i++) fibre(r() * W, 1.2 + r() * 2.6, '#3e1d08', 3 + r() * 7, 1 + Math.floor(r() * 2), r() * 6.3);
  g.globalAlpha = 0.45;
  for (let i = 0; i < 24; i++) fibre(r() * W, 1 + r() * 2, '#f2b36a', 2 + r() * 5, 1, r() * 6.3);
  g.globalAlpha = 1;
  // Nœuds et fissures horizontales.
  for (let i = 0; i < 9; i++) {
    const x = r() * W;
    const y = r() * H;
    const rx = 8 + r() * 14;
    const ry = 4 + r() * 6;
    for (const ox of [-W, 0, W]) {
      const grad = g.createRadialGradient(x + ox, y, 1, x + ox, y, rx);
      grad.addColorStop(0, 'rgba(40,18,5,0.85)');
      grad.addColorStop(0.6, 'rgba(90,45,15,0.5)');
      grad.addColorStop(1, 'rgba(90,45,15,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(x + ox, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Ombre douce posée au sol sous un personnage : elle l'ancre visuellement sur sa surface. */
export class ContactShadow {
  readonly mesh: THREE.Mesh;
  private base: number;

  constructor(width: number, opacity = 0.38) {
    this.base = opacity;
    this.mesh = makeSprite(softGlowTexture(), width, width * 0.24, { color: 0x000000, opacity });
    this.mesh.renderOrder = 1;
  }

  /** Place l'ombre ; `strength` (0 à 1) l'atténue quand le personnage s'élève. */
  set(x: number, y: number, z: number, strength = 1): void {
    this.mesh.position.set(x, y + 0.02, z);
    const k = Math.max(0, Math.min(1, strength));
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = this.base * k;
    this.mesh.visible = k > 0.02;
    this.mesh.scale.y = Math.abs(this.mesh.scale.x) * 0.24 * (0.6 + 0.4 * k);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    (this.mesh.material as THREE.Material).dispose();
  }
}

let stoolTex: THREE.Texture | null = null;
/** Tabouret de bois sculpté (assise incurvée, pied central gravé, socle), dessiné une fois. */
export function stoolTexture(): THREE.Texture {
  if (stoolTex) return stoolTex;
  const W = 128;
  const H = 160;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const wood = (x0: number, x1: number): CanvasGradient => {
    const grad = g.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, '#5a2f12');
    grad.addColorStop(0.35, '#a8642c');
    grad.addColorStop(0.6, '#c27a3a');
    grad.addColorStop(1, '#6b3a17');
    return grad;
  };
  g.lineJoin = 'round';
  g.strokeStyle = '#3a1a07';
  g.lineWidth = 3;
  // Socle.
  g.fillStyle = wood(14, 114);
  g.beginPath();
  g.roundRect(14, H - 26, 100, 22, 6);
  g.fill();
  g.stroke();
  // Pied central, légèrement cintré.
  g.fillStyle = wood(38, 90);
  g.beginPath();
  g.moveTo(40, H - 26);
  g.quadraticCurveTo(52, 90, 40, 42);
  g.lineTo(88, 42);
  g.quadraticCurveTo(76, 90, 88, H - 26);
  g.closePath();
  g.fill();
  g.stroke();
  // Gravures en zigzag.
  g.strokeStyle = 'rgba(255,214,150,0.75)';
  g.lineWidth = 2.5;
  for (const y of [62, 84, 106]) {
    g.beginPath();
    for (let i = 0; i <= 6; i++) g.lineTo(48 + i * 5.4, y + (i % 2 ? 6 : 0));
    g.stroke();
  }
  // Assise incurvée.
  g.strokeStyle = '#3a1a07';
  g.lineWidth = 3;
  g.fillStyle = wood(4, 124);
  g.beginPath();
  g.moveTo(4, 14);
  g.quadraticCurveTo(64, 40, 124, 14);
  g.lineTo(122, 34);
  g.quadraticCurveTo(64, 58, 6, 34);
  g.closePath();
  g.fill();
  g.stroke();
  g.strokeStyle = 'rgba(255,220,160,0.6)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(14, 22);
  g.quadraticCurveTo(64, 44, 114, 22);
  g.stroke();
  stoolTex = new THREE.CanvasTexture(c);
  stoolTex.colorSpace = THREE.SRGBColorSpace;
  return stoolTex;
}
