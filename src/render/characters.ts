/**
 * Affichage des personnages.
 *
 * Deux représentations partagent la même interface (`CharacterView`) :
 *  - `SpriteRig` : représentation PROVISOIRE, faite des images découpées dans les planches de
 *    référence et animée par le code (respiration, balancement, étirement). Ce n'est pas un modèle 3D.
 *  - `ModelRig` : vrai modèle 3D au format GLB avec ses animations, utilisé automatiquement dès
 *    qu'un fichier est déclaré dans public/assets/models/models.json (voir docs/MODELES_3D.md).
 *
 * Le reste du jeu ne connaît que des noms de poses (« idle », « run », « jump »…) : remplacer une
 * image provisoire par un modèle 3D ne demande aucune modification du code du jeu.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Assets } from '../core/Assets';
import { QUAD_BOTTOM } from './sprites';
import { clamp, damp } from '../core/math';

export type AnimKind = 'none' | 'breathe' | 'run' | 'air' | 'climb' | 'sway' | 'shake' | 'bounce' | 'hop' | 'float';

export interface PoseDef {
  img: string;
  /** Hauteur de l'image en unités du monde (sinon hauteur en pixels / ppu). */
  h?: number;
  ppu?: number;
  /** Point d'ancrage horizontal dans l'image (0 = bord gauche, 1 = bord droit). */
  ax?: number;
  /** Décalage vertical en unités (négatif = l'image descend sous les pieds). */
  dy?: number;
  anim?: AnimKind;
  /** Pivot des rotations en haut de l'image (personnage suspendu). */
  pivotTop?: boolean;
}

export interface CharacterDef {
  /** Identifiant utilisé dans models.json pour brancher un modèle 3D. */
  id: string;
  ppu?: number;
  poses: Record<string, PoseDef>;
}

export interface Motion {
  vx: number;
  vy: number;
  moving: boolean;
}

const NO_MOTION: Motion = { vx: 0, vy: 0, moving: false };

/** Représentation provisoire : image découpée, animée par déformation. */
class SpriteRig {
  readonly group = new THREE.Group();
  private pivot = new THREE.Group();
  private mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private current: PoseDef | null = null;
  private poseName = '';
  private w = 1;
  private h = 1;
  private t = Math.random() * 10;
  private phase = 0;
  private squashV = 0;
  private flashT = 0;
  private tint = new THREE.Color(1, 1, 1);

  constructor(private assets: Assets, private def: CharacterDef) {
    this.mat = new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(QUAD_BOTTOM, this.mat);
    this.pivot.add(this.mesh);
    this.group.add(this.pivot);
  }

  get pose(): string {
    return this.poseName;
  }

  setPose(name: string): void {
    if (name === this.poseName) return;
    const p = this.def.poses[name] ?? this.def.poses.idle ?? Object.values(this.def.poses)[0];
    this.poseName = name;
    if (p === this.current) return;
    this.current = p;
    const info = this.assets.info(p.img);
    this.h = p.h ?? info.h / (p.ppu ?? this.def.ppu ?? 256);
    this.w = this.h * (info.w / info.h);
    this.mat.map = this.assets.tex(p.img);
    this.mat.needsUpdate = true;
    const ax = p.ax ?? info.fx ?? 0.5;
    const py = p.pivotTop ? this.h : 0;
    this.pivot.position.set(0, py + (p.dy ?? 0), 0);
    this.mesh.position.set((0.5 - ax) * this.w, -py, 0);
    this.mesh.scale.set(this.w, this.h, 1);
    this.pivot.rotation.z = 0;
    this.pivot.scale.set(1, 1, 1);
  }

  get height(): number {
    return this.h;
  }

  squash(amount: number): void {
    this.squashV = amount;
  }

  flash(time = 0.12): void {
    this.flashT = time;
  }

  setTint(r: number, g: number, b: number): void {
    this.tint.setRGB(r, g, b);
  }

  setOpacity(a: number): void {
    this.mat.opacity = a;
  }

  setVisible(v: boolean): void {
    this.mesh.visible = v;
  }

  update(dt: number, m: Motion): void {
    // La texture peut arriver après la création du personnage (chargement progressif).
    if (this.current && this.mat.map !== this.assets.tex(this.current.img)) {
      this.mat.map = this.assets.tex(this.current.img);
      this.mat.needsUpdate = true;
    }
    this.t += dt;
    const anim = this.current?.anim ?? 'none';
    let rot = 0;
    let sx = 1;
    let sy = 1;
    let oy = 0;
    let ox = 0;
    const t = this.t;
    switch (anim) {
      case 'breathe':
        sy = 1 + 0.012 * Math.sin(t * 2.4);
        sx = 1 - 0.006 * Math.sin(t * 2.4);
        break;
      case 'run': {
        const sp = clamp(Math.abs(m.vx) / 6, 0.35, 1.3);
        this.phase += dt * sp * 13;
        oy = Math.abs(Math.sin(this.phase)) * 0.075 * sp;
        rot = Math.sin(this.phase) * 0.04 - 0.035 * sp;
        sy = 1 + 0.025 * Math.sin(this.phase * 2);
        sx = 1 - 0.02 * Math.sin(this.phase * 2);
        break;
      }
      case 'air':
        rot = clamp(m.vy * 0.012, -0.22, 0.16);
        sy = 1 + clamp(Math.abs(m.vy) * 0.005, 0, 0.07);
        sx = 1 / sy;
        break;
      case 'climb':
        if (m.moving) this.phase += dt * 9;
        oy = Math.sin(this.phase) * 0.04;
        rot = Math.sin(this.phase) * 0.05;
        break;
      case 'sway':
        if (m.moving) this.phase += dt * 8;
        rot = Math.sin(t * 2.1) * 0.035 + Math.sin(this.phase) * 0.09;
        break;
      case 'shake':
        ox = Math.sin(t * 60) * 0.03;
        break;
      case 'bounce':
        oy = Math.abs(Math.sin(t * 6.2)) * 0.14;
        rot = Math.sin(t * 6.2) * 0.07;
        sy = 1 + 0.03 * Math.sin(t * 12.4);
        break;
      case 'hop':
        oy = Math.abs(Math.sin(t * 9)) * 0.1;
        sy = 1 + 0.04 * Math.sin(t * 18);
        break;
      case 'float':
        oy = Math.sin(t * 2.2) * 0.08;
        rot = Math.sin(t * 1.3) * 0.04;
        break;
      case 'none':
        break;
    }
    // Écrasement à l'atterrissage : s'amortit tout seul.
    this.squashV = damp(this.squashV, 0, 12, dt);
    sy *= 1 - this.squashV;
    sx *= 1 + this.squashV * 0.6;
    this.pivot.rotation.z = rot;
    this.pivot.scale.set(sx, sy, 1);
    const p = this.current;
    const py = p?.pivotTop ? this.h : 0;
    this.pivot.position.set(ox, py + (p?.dy ?? 0) + oy, 0);
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.mat.color.setRGB(2.6, 2.6, 2.6);
    } else {
      this.mat.color.copy(this.tint);
    }
  }

  dispose(): void {
    this.mat.dispose();
  }
}

export interface ModelEntry {
  file: string;
  /** Hauteur voulue en unités du monde : le modèle est mis à l'échelle automatiquement. */
  height?: number;
  /** Rotation (degrés) à appliquer pour que le modèle regarde vers la droite. */
  yaw?: number;
  offsetY?: number;
  /** Correspondance pose du jeu -> nom de l'animation dans le fichier GLB. */
  animations?: Record<string, string>;
}

/** Catalogue des modèles 3D disponibles (public/assets/models/models.json). */
export class ModelRegistry {
  entries: Record<string, ModelEntry> = {};
  readonly errors: string[] = [];
  private cache = new Map<string, Promise<{ scene: THREE.Object3D; clips: THREE.AnimationClip[] } | null>>();
  private loader = new GLTFLoader();
  base = './assets/models/';

  async load(file = 'models.json'): Promise<void> {
    try {
      const res = await fetch(this.base + file, { cache: 'no-cache' });
      if (!res.ok) return;
      const data = (await res.json()) as { characters?: Record<string, ModelEntry> };
      this.entries = data.characters ?? {};
    } catch {
      this.entries = {};
    }
  }

  has(id: string): boolean {
    return !!this.entries[id]?.file;
  }

  fetchModel(id: string): Promise<{ scene: THREE.Object3D; clips: THREE.AnimationClip[] } | null> {
    const entry = this.entries[id];
    if (!entry?.file) return Promise.resolve(null);
    let p = this.cache.get(id);
    if (!p) {
      p = new Promise((resolve) => {
        this.loader.load(
          this.base + entry.file,
          (gltf) => resolve({ scene: gltf.scene, clips: gltf.animations }),
          undefined,
          () => {
            this.errors.push(entry.file);
            console.warn('[modèles] fichier GLB illisible : ' + entry.file + ' — la représentation provisoire est conservée.');
            resolve(null);
          },
        );
      });
      this.cache.set(id, p);
    }
    return p;
  }
}

/** Vrai modèle 3D animé (GLB). */
class ModelRig {
  readonly group = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private active: THREE.AnimationAction | null = null;
  private yaw: number;

  constructor(scene: THREE.Object3D, clips: THREE.AnimationClip[], private entry: ModelEntry) {
    // Chaque personnage reçoit sa propre copie du modèle (squelette compris).
    const model = cloneSkinned(scene);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = (entry.height ?? 1.7) / Math.max(0.001, size.y);
    model.scale.setScalar(scale);
    model.position.y = -box.min.y * scale + (entry.offsetY ?? 0);
    model.position.x = -((box.min.x + box.max.x) / 2) * scale;
    this.yaw = THREE.MathUtils.degToRad(entry.yaw ?? 90);
    this.group.add(model);
    this.group.rotation.y = this.yaw;
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
  }

  setPose(name: string): void {
    const map = this.entry.animations ?? {};
    const clipName = map[name] ?? map.idle ?? name;
    const next = this.actions.get(clipName) ?? this.actions.get(map.idle ?? '') ?? null;
    if (!next || next === this.active) return;
    next.reset().fadeIn(0.12).play();
    this.active?.fadeOut(0.12);
    this.active = next;
  }

  setFacing(dir: number): void {
    this.group.rotation.y = dir >= 0 ? this.yaw : this.yaw + Math.PI;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }
}

/** Copie d'un modèle articulé : les os de la copie sont reliés à ses propres maillages. */
function cloneSkinned(source: THREE.Object3D): THREE.Object3D {
  const clone = source.clone(true);
  const srcNodes: THREE.Object3D[] = [];
  const dstNodes: THREE.Object3D[] = [];
  source.traverse((n) => srcNodes.push(n));
  clone.traverse((n) => dstNodes.push(n));
  const map = new Map<THREE.Object3D, THREE.Object3D>();
  srcNodes.forEach((n, i) => map.set(n, dstNodes[i]));
  srcNodes.forEach((n, i) => {
    const s = n as THREE.SkinnedMesh;
    if (!s.isSkinnedMesh) return;
    const d = dstNodes[i] as THREE.SkinnedMesh;
    const bones = s.skeleton.bones.map((b) => map.get(b) as THREE.Bone);
    d.bind(new THREE.Skeleton(bones, s.skeleton.boneInverses), s.bindMatrix);
  });
  return clone;
}

/** Personnage affiché : image provisoire, remplacée par le modèle 3D dès qu'il est disponible. */
export class CharacterView {
  readonly root = new THREE.Group();
  private sprite: SpriteRig;
  private model: ModelRig | null = null;
  private facing = 1;
  private poseName = '';

  constructor(assets: Assets, readonly def: CharacterDef, models?: ModelRegistry) {
    this.sprite = new SpriteRig(assets, def);
    this.root.add(this.sprite.group);
    if (models?.has(def.id)) {
      void models.fetchModel(def.id).then((res) => {
        if (!res) return;
        this.model = new ModelRig(res.scene, res.clips, models.entries[def.id]);
        this.model.setPose(this.poseName || 'idle');
        this.model.setFacing(this.facing);
        this.sprite.setVisible(false);
        this.root.add(this.model.group);
      });
    }
  }

  /** Vrai tant que le personnage est représenté par une image provisoire. */
  get isPlaceholder(): boolean {
    return !this.model;
  }

  get pose(): string {
    return this.poseName;
  }

  get height(): number {
    return this.sprite.height;
  }

  setPose(name: string): void {
    this.poseName = name;
    this.sprite.setPose(name);
    this.model?.setPose(name);
  }

  setFacing(dir: number): void {
    this.facing = dir >= 0 ? 1 : -1;
    this.sprite.group.scale.x = this.facing;
    this.model?.setFacing(this.facing);
  }

  squash(amount: number): void {
    this.sprite.squash(amount);
  }

  flash(time?: number): void {
    this.sprite.flash(time);
  }

  setTint(r: number, g: number, b: number): void {
    this.sprite.setTint(r, g, b);
  }

  setOpacity(a: number): void {
    this.sprite.setOpacity(a);
    if (this.model) this.model.group.visible = a > 0.3;
  }

  update(dt: number, motion: Motion = NO_MOTION): void {
    this.sprite.update(dt, motion);
    this.model?.update(dt);
  }

  dispose(): void {
    this.sprite.dispose();
    this.root.removeFromParent();
  }
}
