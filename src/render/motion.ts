/**
 * Mouvements des personnages provisoires (images découpées).
 *
 * L'image n'est plus déplacée d'un bloc (ce qui faisait décoller les pieds) : elle est posée sur une
 * grille souple que le processeur graphique déforme par zones. Les pieds restent plantés au sol ;
 * les jambes ou la robe se balancent en ciseaux, le corps rebondit au-dessus des genoux, les hanches
 * et les épaules se balancent, la tête hoche, les mains gesticulent (bavardage, djembé, applaudissements).
 *
 * Tous les réglages sont des fractions de la hauteur du personnage, ce qui les rend indépendants de
 * sa taille. Ils sont partagés par le jeu et par le studio des mouvements (tools/studio).
 */
import * as THREE from 'three';

export type MotionAction =
  | 'idle' | 'walk' | 'run' | 'talk' | 'listen' | 'dance' | 'drum' | 'clap' | 'stir' | 'carve';

export const MOTION_ACTIONS: readonly MotionAction[] = [
  'idle', 'walk', 'run', 'talk', 'listen', 'dance', 'drum', 'clap', 'stir', 'carve',
];

/** Réglages d'un mouvement (fractions de la hauteur du personnage, fréquences en cycles par seconde). */
export interface MotionParams {
  /** Cycles de pas par seconde (un cycle = deux pas). */
  cadence: number;
  /** Vitesse de déplacement pour laquelle la cadence est réglée (le pas s'adapte à la vitesse réelle). */
  refSpeed: number;
  /** Balancement des jambes ou de la robe, en ciseaux. */
  stride: number;
  /** Levée du pied qui avance. */
  lift: number;
  /** Rebond du corps au-dessus des genoux (négatif : flexion des genoux, pour danser). */
  bob: number;
  /** Inclinaison du corps vers l'avant. */
  lean: number;
  /** Balancement des hanches. */
  hips: number;
  /** Balancement des épaules (en sens inverse des jambes). */
  twist: number;
  /** Hochement de tête. */
  nod: number;
  /** Respiration (la poitrine s'élargit et se soulève). */
  breathe: number;
  /** Lent balancement de tout le corps. */
  sway: number;
  /** Amplitude du geste des mains. */
  gesture: number;
  /** Rapidité du geste des mains (cycles par seconde). */
  gestureSpeed: number;
}

/** Zones du corps dans l'image (u de 0 à 1 depuis la gauche, v de 0 à 1 depuis le bas). */
export interface BodyProfile {
  /** Hauteur des genoux : tout ce qui est plus bas balance avec les pas. */
  knee: number;
  /** Abscisse qui sépare la jambe arrière de la jambe avant (ou les deux côtés de la robe). */
  split: number;
  /** Main qui gesticule : centre et rayon (fraction de la hauteur). */
  hand?: { u: number; v: number; r: number };
  /** Seconde main, en léger décalage avec la première. */
  hand2?: { u: number; v: number; r: number };
}

export const DEFAULT_BODY: BodyProfile = { knee: 0.27, split: 0.5 };

const P = (o: Partial<MotionParams>): MotionParams => ({
  cadence: 0.5, refSpeed: 1, stride: 0, lift: 0, bob: 0, lean: 0, hips: 0, twist: 0, nod: 0,
  breathe: 0.012, sway: 0.006, gesture: 0, gestureSpeed: 2, ...o,
});

/** Mouvements de base ; chaque personnage peut en modifier une partie (characterDefs.ts). */
export const MOTION_PRESETS: Record<MotionAction, MotionParams> = {
  idle: P({ cadence: 0.45, hips: 0.008, twist: 0.006, nod: 0.008, breathe: 0.014, sway: 0.008 }),
  walk: P({ cadence: 0.95, refSpeed: 1.05, stride: 0.075, lift: 0.035, bob: 0.018, lean: 0.03, hips: 0.022, twist: 0.02, nod: 0.012, breathe: 0.006, sway: 0 }),
  run: P({ cadence: 1.55, refSpeed: 2.4, stride: 0.12, lift: 0.07, bob: 0.03, lean: 0.075, hips: 0.015, twist: 0.035, nod: 0.016, breathe: 0, sway: 0 }),
  talk: P({ cadence: 0.9, bob: 0.006, lean: 0.012, hips: 0.012, twist: 0.016, nod: 0.024, breathe: 0.01, sway: 0.01, gesture: 0.05, gestureSpeed: 3.2 }),
  listen: P({ cadence: 0.55, hips: 0.008, twist: 0.006, nod: 0.016, breathe: 0.012, sway: 0.008, gesture: 0.008, gestureSpeed: 1.2 }),
  dance: P({ cadence: 1.15, stride: 0.035, lift: 0.025, bob: -0.035, hips: 0.055, twist: 0.04, nod: 0.024, breathe: 0, sway: 0.016, gesture: 0.06, gestureSpeed: 2.3 }),
  drum: P({ cadence: 1.3, bob: 0.008, twist: 0.014, nod: 0.028, breathe: 0, sway: 0.006, gesture: 0.04, gestureSpeed: 4.6 }),
  clap: P({ cadence: 1.1, bob: 0.006, twist: 0.01, nod: 0.024, breathe: 0, sway: 0.008, gesture: 0.035, gestureSpeed: 3.4 }),
  stir: P({ cadence: 0.7, twist: 0.012, nod: 0.012, sway: 0.006, gesture: 0.035, gestureSpeed: 1.4 }),
  carve: P({ cadence: 0.8, twist: 0.008, nod: 0.016, sway: 0.004, gesture: 0.03, gestureSpeed: 2.6 }),
};

/** Noms affichés dans le studio. */
export const MOTION_LABELS: Record<MotionAction, string> = {
  idle: 'Attendre', walk: 'Marcher', run: 'Courir', talk: 'Parler', listen: 'Écouter', dance: 'Danser',
  drum: 'Jouer du djembé', clap: 'Applaudir', stir: 'Cuisiner', carve: 'Sculpter',
};

export const PARAM_KEYS: readonly (keyof MotionParams)[] = [
  'cadence', 'refSpeed', 'stride', 'lift', 'bob', 'lean', 'hips', 'twist', 'nod', 'breathe', 'sway', 'gesture', 'gestureSpeed',
];

const WARP_DECL = /* glsl */ `
uniform float uPhase;
uniform float uTime;
uniform float uAspect;
uniform vec4 uLegs;
uniform vec4 uBody;
uniform vec4 uHead;
uniform vec4 uHandA;
uniform vec4 uHandB;
uniform float uHandSpeed;
`;

const WARP_BODY = /* glsl */ `
{
  // Coordonnées dans l'image : u de 0 (gauche) à 1, v de 0 (pieds) à 1 (tête).
  float wu = transformed.x + 0.5;
  float wv = transformed.y;
  vec2 wd = vec2(0.0);   // déplacement en fractions de la hauteur
  float du = 0.0;        // déplacement horizontal relatif à la largeur de l'image
  float knee = max(uLegs.z, 0.05);
  float sp = sin(uPhase);
  float cp = cos(uPhase);
  // Jambes ou robe : ciseaux sous les genoux, pieds qui se lèvent tour à tour.
  float legW = clamp(1.0 - wv / knee, 0.0, 1.0);
  float side = smoothstep(uLegs.w - 0.07, uLegs.w + 0.07, wu) * 2.0 - 1.0;
  wd.x += uLegs.x * sp * side * legW;
  wd.y += uLegs.y * max(0.0, cp * side) * legW * legW;
  // Corps : rebond au-dessus des genoux (les pieds restent au sol), inclinaison, hanches, épaules.
  float upper = smoothstep(knee * 0.5, knee + 0.2, wv);
  wd.y += uBody.x * (0.5 + 0.5 * cos(2.0 * uPhase)) * upper;
  wd.x += uBody.y * max(0.0, wv - knee * 0.8);
  float hipsB = exp(-pow((wv - (knee + 0.1)) / 0.16, 2.0));
  wd.x += uBody.z * sp * hipsB;
  float chest = exp(-pow((wv - 0.66) / 0.15, 2.0));
  wd.x -= uBody.w * sp * chest;
  // Tête : hochement.
  float head = smoothstep(0.7, 0.96, wv);
  wd.y += uHead.x * sin(2.0 * uPhase + 0.7) * head;
  wd.x += uHead.x * 0.6 * cp * head;
  // Respiration et lent balancement.
  float br = sin(uTime * 2.3);
  du += uHead.y * (wu - 0.5) * chest * br * 1.4;
  wd.y += uHead.y * 0.35 * smoothstep(0.3, 0.75, wv) * br;
  wd.x += uHead.z * sin(uTime * 1.25) * wv;
  // Mains : la zone autour de chaque main décrit un petit cercle.
  if (uHandA.z > 0.0) {
    float d = length(vec2((wu - uHandA.x) / uAspect, wv - uHandA.y));
    float w = 1.0 - smoothstep(uHandA.z * 0.3, uHandA.z, d);
    float a = uTime * uHandSpeed * 6.2832;
    wd.y += uHead.w * sin(a) * w;
    wd.x += uHead.w * 0.5 * cos(a) * w;
  }
  if (uHandB.z > 0.0) {
    float d = length(vec2((wu - uHandB.x) / uAspect, wv - uHandB.y));
    float w = 1.0 - smoothstep(uHandB.z * 0.3, uHandB.z, d);
    float a = uTime * uHandSpeed * 6.2832 + uHandB.w;
    wd.y += uHead.w * sin(a) * w;
    wd.x += uHead.w * 0.5 * cos(a) * w;
  }
  transformed.x += wd.x * uAspect + du;
  transformed.y += wd.y;
}
`;

/** Grille unité (origine en bas au centre) assez fine pour plier les jambes, le buste et les mains. */
export const WARP_QUAD = new THREE.PlaneGeometry(1, 1, 10, 22).translate(0, 0.5, 0);
WARP_QUAD.userData.shared = true;

export interface WarpUniforms {
  [name: string]: THREE.IUniform;
  uPhase: { value: number };
  uTime: { value: number };
  uAspect: { value: number };
  uLegs: { value: THREE.Vector4 };
  uBody: { value: THREE.Vector4 };
  uHead: { value: THREE.Vector4 };
  uHandA: { value: THREE.Vector4 };
  uHandB: { value: THREE.Vector4 };
  uHandSpeed: { value: number };
}

/** Matériau d'image transparente dont la grille est déformée par les mouvements. */
export function warpMaterial(): { material: THREE.MeshBasicMaterial; uniforms: WarpUniforms } {
  const uniforms: WarpUniforms = {
    uPhase: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 2 },
    uLegs: { value: new THREE.Vector4(0, 0, 0.27, 0.5) },
    uBody: { value: new THREE.Vector4() },
    uHead: { value: new THREE.Vector4() },
    uHandA: { value: new THREE.Vector4() },
    uHandB: { value: new THREE.Vector4() },
    uHandSpeed: { value: 2 },
  };
  const material = new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + WARP_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WARP_BODY);
  };
  material.customProgramCacheKey = () => 'ousmane-warp-1';
  return { material, uniforms };
}

/**
 * Anime les réglages d'un personnage : passe en douceur d'un mouvement à l'autre et fait avancer
 * le cycle des pas au rythme de la vitesse réelle.
 */
export class MotionDriver {
  phase = Math.random() * Math.PI * 2;
  time = Math.random() * 20;
  private cur: MotionParams = { ...MOTION_PRESETS.idle };
  private target: MotionParams = { ...MOTION_PRESETS.idle };
  private body: BodyProfile = DEFAULT_BODY;
  /** Faux pour les poses animées à l'ancienne (saut, escalade…) : la grille reste droite. */
  active = false;

  constructor(readonly uniforms: WarpUniforms) {}

  setBody(body: BodyProfile, aspect: number): void {
    this.body = body;
    const u = this.uniforms;
    u.uAspect.value = aspect;
    u.uLegs.value.z = body.knee;
    u.uLegs.value.w = body.split;
    const a = body.hand;
    const b = body.hand2;
    u.uHandA.value.set(a?.u ?? 0, a?.v ?? 0, a?.r ?? 0, 0);
    u.uHandB.value.set(b?.u ?? 0, b?.v ?? 0, b?.r ?? 0, 2.4);
  }

  get profile(): BodyProfile {
    return this.body;
  }

  /** Nouveau mouvement visé ; `snap` l'applique sans transition (changement d'image). */
  setParams(p: MotionParams, snap = false): void {
    this.target = { ...p };
    if (snap) this.cur = { ...p };
    this.active = true;
  }

  get params(): MotionParams {
    return this.target;
  }

  stop(): void {
    this.active = false;
    const u = this.uniforms;
    u.uLegs.value.x = u.uLegs.value.y = 0;
    u.uBody.value.set(0, 0, 0, 0);
    u.uHead.value.set(0, 0, 0, 0);
  }

  /** Avance d'un pas de temps ; `speed` est la vitesse horizontale réelle du personnage. */
  update(dt: number, speed = 0): void {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    if (!this.active) return;
    const k = 1 - Math.exp(-dt * 7);
    const c = this.cur;
    const t = this.target;
    for (const key of PARAM_KEYS) c[key] += (t[key] - c[key]) * k;
    // Le pas suit la vitesse réelle : un personnage qui ralentit fait des pas plus lents.
    const moving = Math.abs(speed) > 0.05;
    const scale = moving ? Math.min(1.7, Math.max(0.45, Math.abs(speed) / Math.max(0.1, c.refSpeed))) : 1;
    this.phase += dt * c.cadence * scale * Math.PI * 2;
    if (this.phase > 1e4) this.phase -= Math.PI * 2 * 1000;
    const u = this.uniforms;
    u.uPhase.value = this.phase;
    u.uLegs.value.x = c.stride;
    u.uLegs.value.y = c.lift;
    u.uBody.value.set(c.bob, c.lean, c.hips, c.twist);
    u.uHead.value.set(c.nod, c.breathe, c.sway, c.gesture);
    u.uHandSpeed.value = c.gestureSpeed;
  }
}

/** Réglages d'un mouvement pour un personnage : base + ajustements propres au personnage. */
export function resolveMotion(action: MotionAction, overrides?: Partial<Record<MotionAction, Partial<MotionParams>>>): MotionParams {
  return { ...MOTION_PRESETS[action], ...(overrides?.[action] ?? {}) };
}
