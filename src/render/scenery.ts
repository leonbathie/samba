/**
 * Éléments de décor générés par le code : arrière-plan peint à défilement lent, eau animée,
 * cascade, terre des sols et rayons de lumière.
 */
import * as THREE from 'three';
import type { View } from './View';
import { QUAD } from './sprites';
import { clamp, lerp, rng } from '../core/math';

export interface CamBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Arrière-plan peint, placé loin derrière le plan de jeu. Il est plus grand que l'écran et glisse
 * lentement pendant que la caméra traverse le niveau : on découvre le tableau au fil de la marche.
 */
export class Backdrop {
  static readonly Z = -60;
  readonly mesh: THREE.Mesh;
  private aspect: number;
  /** Partie du tableau montrée quand la caméra est en bas (0 = bas de l'image, 1 = haut). */
  alignLow = 0.5;
  /** Partie montrée quand la caméra est tout en haut du niveau. */
  alignHigh = 0.65;

  constructor(tex: THREE.Texture, aspect: number, tint = 0xffffff) {
    this.aspect = aspect;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: tint, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.Mesh(QUAD, mat);
    this.mesh.position.z = Backdrop.Z;
    this.mesh.renderOrder = -100;
    this.mesh.frustumCulled = false;
  }

  update(view: View, b: CamBounds): void {
    const vis = view.sizeAt(Backdrop.Z);
    const k = vis.h / view.viewH;
    const rangeX = Math.max(0, b.maxX - b.minX - view.halfW * 2);
    const rangeY = Math.max(0, b.maxY - b.minY - view.halfH * 2);
    const slackX = Math.min(rangeX * 0.035 * k, vis.w * 0.6);
    const slackY = Math.min(rangeY * 0.06 * k, vis.h * 1.6);
    const w = Math.max(vis.w + slackX, (vis.h + slackY) * this.aspect) * 1.02;
    const h = w / this.aspect;
    const sx = w - vis.w;
    const sy = h - vis.h;
    const tx = rangeX > 0 ? clamp((view.camX - (b.minX + view.halfW)) / rangeX, 0, 1) : 0.5;
    const ty = rangeY > 0 ? clamp((view.camY - (b.minY + view.halfH)) / rangeY, 0, 1) : 0;
    const a = lerp(this.alignLow, this.alignHigh, ty);
    this.mesh.scale.set(w, h, 1);
    this.mesh.position.x = view.camX + (0.5 - tx) * sx;
    this.mesh.position.y = view.camY + (0.5 - a) * sy;
  }
}

const WATER_VERT = /* glsl */ `
varying vec2 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xy;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uSurface;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uGlint;
varying vec2 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float d = max(0.0, uSurface - vWorld.y);
  float depth = clamp(d / 3.2, 0.0, 1.0);
  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, depth));
  // Rides : resserrées près de la surface (au loin), larges vers le bas de l'écran (au premier plan).
  float persp = 0.35 + d * 0.9;
  float wave = sin(vWorld.x * 2.6 / persp + sin(d * 7.0 - uTime * 1.3) * 1.1 + uTime * 0.8);
  float band = sin(d * 16.0 / persp - uTime * 1.7 + vWorld.x * 0.6);
  float glint = smoothstep(0.55, 1.0, wave * band);
  col += uGlint * glint * (0.55 - depth * 0.4);
  // Scintillements.
  vec2 cell = floor(vec2(vWorld.x * 5.0, d * 9.0));
  float tw = hash(cell);
  col += uGlint * step(0.965, tw) * (0.5 + 0.5 * sin(uTime * (3.0 + tw * 5.0) + tw * 40.0)) * 0.6 * (1.0 - depth);
  // Liseré d'écume à la surface.
  float edge = 0.045 + 0.03 * sin(vWorld.x * 4.0 + uTime * 2.1);
  float foam = 1.0 - smoothstep(0.0, edge, d);
  col = mix(col, vec3(1.0), foam * 0.75);
  float alpha = mix(0.8, 0.97, depth);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

export interface WaterColors {
  shallow: number;
  deep: number;
  glint: number;
}

/** Nappe d'eau vue de côté : du niveau de surface jusqu'en bas de l'écran. */
export function makeWater(x0: number, x1: number, surface: number, bottom: number, c: WaterColors): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSurface: { value: surface },
      uShallow: { value: new THREE.Color(c.shallow) },
      uDeep: { value: new THREE.Color(c.deep) },
      uGlint: { value: new THREE.Color(c.glint) },
    },
  });
  const mesh = new THREE.Mesh(QUAD, mat);
  mesh.scale.set(x1 - x0, surface - bottom, 1);
  mesh.position.set((x0 + x1) / 2, (surface + bottom) / 2, 0);
  mesh.userData.animated = true;
  return mesh;
}

const FALL_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uTint;
varying vec2 vUv;
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
void main() {
  float cols = 46.0;
  float id = floor(vUv.x * cols);
  float n = hash(id);
  float n2 = hash(id + 57.0);
  float fx = fract(vUv.x * cols);
  float streak = smoothstep(0.0, 0.5, fx) * smoothstep(1.0, 0.5, fx);
  float flow = fract(vUv.y * (1.5 + n * 1.5) + uTime * (0.55 + n2 * 0.6));
  float bright = streak * (0.35 + 0.65 * smoothstep(0.2, 0.9, flow));
  vec3 col = mix(uTint, vec3(1.0), bright);
  float sides = smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x);
  float top = smoothstep(1.0, 0.94, vUv.y);
  float alpha = (0.42 + 0.5 * bright) * sides * top * uOpacity;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

const UV_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Rideau de cascade animé. */
export function makeWaterfall(w: number, h: number, tint = 0x7fd6ee, opacity = 1): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: UV_VERT,
    fragmentShader: FALL_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: opacity }, uTint: { value: new THREE.Color(tint) } },
  });
  const mesh = new THREE.Mesh(QUAD, mat);
  mesh.scale.set(w, h, 1);
  mesh.userData.animated = true;
  return mesh;
}

let earthTex: THREE.Texture | null = null;
/** Texture de terre et de roche générée une fois : sert de corps aux sols sous la bordure peinte. */
export function earthTexture(): THREE.Texture {
  if (earthTex) return earthTex;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8a8a8a';
  g.fillRect(0, 0, size, size);
  const r = rng(4242);
  // Blocs de pierre irréguliers.
  for (let i = 0; i < 46; i++) {
    const x = r() * size;
    const y = r() * size;
    const w = 26 + r() * 46;
    const h = 18 + r() * 30;
    const v = 105 + Math.floor(r() * 70);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.strokeStyle = 'rgba(40,40,40,0.55)';
    g.lineWidth = 2.5;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        g.beginPath();
        g.roundRect(x + ox, y + oy, w, h, 7);
        g.fill();
        g.stroke();
      }
    }
  }
  for (let i = 0; i < 900; i++) {
    const v = 60 + Math.floor(r() * 150);
    g.fillStyle = `rgba(${v},${v},${v},0.25)`;
    g.fillRect(r() * size, r() * size, 1 + r() * 2.5, 1 + r() * 2.5);
  }
  earthTex = new THREE.CanvasTexture(c);
  earthTex.wrapS = earthTex.wrapT = THREE.RepeatWrapping;
  earthTex.colorSpace = THREE.SRGBColorSpace;
  earthTex.anisotropy = 2;
  return earthTex;
}

/** Bloc de terre : rectangle (x0..x1, y0..y1) texturé en coordonnées du monde, assombri vers le bas. */
export function makeEarth(x0: number, y0: number, x1: number, y1: number, color: number, z = -0.05): THREE.Mesh {
  const w = x1 - x0;
  const h = y1 - y0;
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  const cols = new Float32Array(4 * 3);
  const base = new THREE.Color(color);
  const tile = 3.2;
  for (let i = 0; i < 4; i++) {
    const top = uv.getY(i) > 0.5;
    const left = uv.getX(i) < 0.5;
    uv.setXY(i, (left ? x0 : x1) / tile, (top ? y1 : y0) / tile);
    const shade = top ? 1.25 : Math.max(0.3, 1.25 - h * 0.22);
    cols[i * 3] = base.r * shade;
    cols[i * 3 + 1] = base.g * shade;
    cols[i * 3 + 2] = base.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mat = new THREE.MeshBasicMaterial({ map: earthTexture(), vertexColors: true, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  mesh.renderOrder = -5;
  return mesh;
}

let rayTex: THREE.Texture | null = null;
/** Rayons de soleil obliques (feuillages, grotte). */
export function makeRays(w: number, h: number, color = 0xfff0b0, opacity = 0.22): THREE.Mesh {
  if (!rayTex) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d')!;
    const r = rng(99);
    for (let i = 0; i < 9; i++) {
      const x = r() * 256;
      const wd = 8 + r() * 30;
      const grad = g.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, `rgba(255,255,255,${0.25 + r() * 0.4})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + wd, 0);
      g.lineTo(x + wd * 2.2 - 60, 256);
      g.lineTo(x - 60, 256);
      g.closePath();
      g.fill();
    }
    rayTex = new THREE.CanvasTexture(c);
    rayTex.colorSpace = THREE.SRGBColorSpace;
  }
  const mat = new THREE.MeshBasicMaterial({
    map: rayTex, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const mesh = new THREE.Mesh(QUAD, mat);
  mesh.scale.set(w, h, 1);
  mesh.renderOrder = 6;
  return mesh;
}
