/**
 * Studio des mouvements : une page pour régler — et montrer à Claude — la façon dont chaque
 * personnage doit bouger. Elle utilise exactement le même moteur que le jeu (render/motion.ts),
 * sur le même sol : ce qui est réglé ici est ce que le jeu affichera.
 *
 * Les réglages envoyés sont rangés dans la base de données de la page publiée (collection
 * « mouvements ») : Claude les relit et les reporte dans src/game/characterDefs.ts.
 */
import * as THREE from 'three';
import './studio.css';
import { Assets } from '../core/Assets';
import { CharacterView, type CharacterDef, type PoseDef } from '../render/characters';
import { ContactShadow } from '../render/sprites';
import {
  type BodyProfile, DEFAULT_BODY, MOTION_LABELS, type MotionAction, type MotionParams, resolveMotion,
} from '../render/motion';
import { AMIE, CHARACTERS, ENEMIES, HERO } from '../game/characterDefs';

// ------------------------------------------------------------------ catalogue

type Group = 'Habitants' | 'Enfants' | 'Ousmane et Coumba' | 'Animaux';

interface Entry {
  key: string;
  label: string;
  group: Group;
  def: CharacterDef;
  actions: MotionAction[];
  /** Pose (image) du jeu utilisée pour chaque mouvement. */
  pose: (a: MotionAction) => string;
}

const STANDING: MotionAction[] = ['idle', 'walk', 'run', 'talk', 'listen', 'dance'];
const SEATED: MotionAction[] = ['idle', 'talk', 'listen', 'drum', 'clap', 'stir', 'carve'];

const villager = (key: string, label: string, group: Group = 'Habitants'): Entry => {
  const def = CHARACTERS[key];
  return { key, label, group, def, actions: def.seat || key === 'cuisiniere' || key === 'enfants_assis' ? SEATED : STANDING, pose: () => 'idle' };
};

const ENTRIES: Entry[] = [
  villager('femme_bleue', 'Tata Dieynaba'),
  villager('femme_rose', 'Tata Salimata'),
  villager('femme_verte', 'Tata Aminata'),
  villager('femme_fruits', 'Femme au panier'),
  villager('femme_kente', 'Penda / Tante Dado'),
  villager('porteuse', 'Porteuse de fruits'),
  villager('cuisiniere', 'Tata Mariam, cuisinière'),
  villager('artisan', 'Maître Hamady, sculpteur'),
  villager('sorcier', 'Le vieux Demba'),
  villager('mamie', 'Mame Awa à la fête'),
  villager('musicien_djembe', 'Joueur de djembé'),
  villager('musicien_kora', 'Baaba Sidi, kora'),
  villager('musicienne_djembe', 'Joueuse de djembé'),
  villager('danseuse', 'Danseuse'),
  villager('danseur', 'Danseur'),
  villager('enfant_garcon', 'Malick', 'Enfants'),
  villager('enfant_fille', 'Fanta', 'Enfants'),
  villager('enfants_assis', 'Enfants assis', 'Enfants'),
  villager('fille_exploratrice', 'Aïda', 'Enfants'),
  villager('garcon_explorateur', 'Moussa', 'Enfants'),
  { key: 'hero', label: 'Ousmane', group: 'Ousmane et Coumba', def: HERO, actions: ['idle', 'run', 'talk'], pose: (a) => a },
  { key: 'amie', label: 'Coumba', group: 'Ousmane et Coumba', def: AMIE, actions: ['idle', 'run'], pose: (a) => (a === 'run' ? 'run' : 'idle') },
  villager('grue', 'Grue couronnée', 'Animaux'),
  villager('singe_ami', 'Petit singe gourmand', 'Animaux'),
  { key: 'singe', label: 'Singe', group: 'Animaux', def: ENEMIES.singe, actions: ['idle', 'walk', 'dance'], pose: (a) => (a === 'walk' ? 'move' : a === 'dance' ? 'happy' : 'idle') },
  { key: 'hyene', label: 'Hyène', group: 'Animaux', def: ENEMIES.hyene, actions: ['idle', 'walk', 'run'], pose: (a) => (a === 'walk' ? 'move' : a === 'run' ? 'attack' : 'idle') },
  { key: 'phaco', label: 'Phacochère', group: 'Animaux', def: ENEMIES.phaco, actions: ['idle', 'walk', 'run'], pose: (a) => (a === 'walk' ? 'move' : a === 'run' ? 'attack' : 'idle') },
  { key: 'serpent', label: 'Serpent', group: 'Animaux', def: ENEMIES.serpent, actions: ['idle'], pose: () => 'idle' },
];

interface ParamSpec {
  key: keyof MotionParams;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Affichage : pourcentage de la taille, fréquence ou vitesse. */
  unit: 'pct' | 'hz' | 'speed';
  help: string;
}

const PARAMS: { title: string; items: ParamSpec[] }[] = [
  {
    title: 'Jambes',
    items: [
      { key: 'cadence', label: 'Rythme des pas', min: 0, max: 3.5, step: 0.05, unit: 'hz', help: 'Nombre de cycles de pas par seconde (un cycle = deux pas).' },
      { key: 'refSpeed', label: 'Vitesse de déplacement', min: 0.2, max: 10, step: 0.1, unit: 'speed', help: 'Vitesse à laquelle le personnage avance pendant la démonstration.' },
      { key: 'stride', label: 'Balancement des jambes ou de la robe', min: 0, max: 0.25, step: 0.005, unit: 'pct', help: 'Les deux côtés du bas du corps se croisent en ciseaux.' },
      { key: 'lift', label: 'Levée des pieds', min: 0, max: 0.15, step: 0.005, unit: 'pct', help: 'Le pied qui avance se soulève.' },
    ],
  },
  {
    title: 'Corps',
    items: [
      { key: 'bob', label: 'Rebond du corps', min: -0.08, max: 0.08, step: 0.002, unit: 'pct', help: 'Le haut du corps monte à chaque pas ; en négatif, les genoux fléchissent (danse).' },
      { key: 'lean', label: 'Inclinaison vers l’avant', min: -0.05, max: 0.15, step: 0.005, unit: 'pct', help: 'Penché vers l’avant pour courir, droit pour marcher tranquillement.' },
      { key: 'hips', label: 'Balancement des hanches', min: 0, max: 0.1, step: 0.002, unit: 'pct', help: 'Les hanches roulent d’un côté à l’autre.' },
      { key: 'twist', label: 'Balancement des épaules', min: 0, max: 0.08, step: 0.002, unit: 'pct', help: 'Les épaules vont dans le sens opposé aux jambes.' },
      { key: 'breathe', label: 'Respiration', min: 0, max: 0.04, step: 0.001, unit: 'pct', help: 'La poitrine se soulève et s’élargit.' },
      { key: 'sway', label: 'Balancement lent', min: 0, max: 0.04, step: 0.001, unit: 'pct', help: 'Tout le corps oscille doucement.' },
    ],
  },
  {
    title: 'Tête et mains',
    items: [
      { key: 'nod', label: 'Hochement de tête', min: 0, max: 0.08, step: 0.002, unit: 'pct', help: 'La tête hoche au rythme du mouvement.' },
      { key: 'gesture', label: 'Gestes des mains', min: 0, max: 0.12, step: 0.002, unit: 'pct', help: 'La zone autour de chaque main (cercles orange) décrit un petit cercle.' },
      { key: 'gestureSpeed', label: 'Rapidité des gestes', min: 0, max: 10, step: 0.1, unit: 'hz', help: 'Nombre de gestes par seconde.' },
    ],
  },
];

const fmt = (spec: ParamSpec, v: number): string => {
  const n = (x: number, d: number): string => x.toFixed(d).replace('.', ',');
  if (spec.unit === 'pct') return `${n(v * 100, 1)} %`;
  if (spec.unit === 'hz') return `${n(v, 2)} /s`;
  return `${n(v, 1)} m/s`;
};

// ------------------------------------------------------------------ état

interface Saved {
  personnage: string;
  nom: string;
  action: MotionAction;
  reglages: MotionParams;
  corps: BodyProfile;
  note: string;
  trajet: [number, number][];
  envoyeLe: string;
}

const state = {
  entry: ENTRIES.find((e) => e.key === 'femme_verte')!,
  action: 'walk' as MotionAction,
  params: { ...resolveMotion('walk') },
  body: { ...DEFAULT_BODY } as BodyProfile,
  note: '',
  path: [] as [number, number][],
  guides: true,
  inPlace: false,
  zoom: 'proche' as 'proche' | 'large',
  recording: false,
  playing: false,
  dirty: false,
};

// ------------------------------------------------------------------ interface

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of kids) if (c !== null) el.append(c);
  return el;
}

const root = document.getElementById('studio')!;
const assets = new Assets('./assets/');

const ui = {
  stage: h('div', { class: 'stage' }),
  canvas: h('canvas', { class: 'gl', 'aria-label': 'Aperçu du mouvement' }),
  overlay: h('canvas', { class: 'overlay' }),
  hint: h('p', { class: 'stage-hint' }),
  people: h('div', { class: 'people', role: 'listbox', 'aria-label': 'Personnages' }),
  actions: h('div', { class: 'actions', role: 'radiogroup', 'aria-label': 'Mouvement' }),
  sliders: h('div', { class: 'sliders' }),
  title: h('h2', { class: 'who' }),
  note: h('textarea', { id: 'note', rows: '3', placeholder: 'Par exemple : elle marche plus lentement, en balançant le bras droit ; les enfants courent en sautillant…' }),
  status: h('p', { class: 'status', role: 'status' }),
  sent: h('ul', { class: 'sent' }),
  recBtn: h('button', { class: 'btn', type: 'button' }, 'Enregistrer un trajet'),
  playBtn: h('button', { class: 'btn ghost', type: 'button' }, 'Rejouer le trajet'),
  clearBtn: h('button', { class: 'btn ghost', type: 'button' }, 'Effacer'),
  pathInfo: h('p', { class: 'small' }),
  sendBtn: h('button', { class: 'btn primary', type: 'button' }, 'Envoyer à Claude'),
  copyBtn: h('button', { class: 'btn ghost', type: 'button' }, 'Copier les réglages'),
  resetBtn: h('button', { class: 'btn ghost', type: 'button' }, 'Revenir aux réglages du jeu'),
};

function buildLayout(): void {
  ui.stage.append(ui.canvas, ui.overlay, ui.hint);
  const toggles = h('div', { class: 'toggles' });
  const mkToggle = (id: string, label: string, get: () => boolean, set: (v: boolean) => void): HTMLLabelElement => {
    const input = h('input', { type: 'checkbox', id });
    input.checked = get();
    input.addEventListener('change', () => {
      set(input.checked);
      refreshStageHint();
    });
    return h('label', { class: 'toggle', for: id }, input, ' ', label);
  };
  toggles.append(
    mkToggle('guides', 'Repères', () => state.guides, (v) => (state.guides = v)),
    mkToggle('inplace', 'Sur place', () => state.inPlace, (v) => (state.inPlace = v)),
    mkToggle('zoom', 'Plein pied', () => state.zoom === 'large', (v) => (state.zoom = v ? 'large' : 'proche')),
  );

  const left = h('section', { class: 'left' },
    h('div', { class: 'stage-wrap' }, ui.stage),
    toggles,
  );
  const trajet = h('div', { class: 'card' },
    h('h3', {}, 'Montrer un trajet'),
    h('p', { class: 'small' }, 'Appuie sur « Enregistrer », puis fais glisser le personnage sur la scène, à la souris ou au doigt : avance, arrête-toi, repars, accélère. Il marchera exactement comme tu le montres.'),
    h('div', { class: 'row' }, ui.recBtn, ui.playBtn, ui.clearBtn),
    ui.pathInfo,
  );

  const right = h('section', { class: 'right' },
    h('div', { class: 'card' }, h('h3', {}, 'Personnage'), ui.people),
    h('div', { class: 'card' }, ui.title, h('h3', {}, 'Mouvement'), ui.actions),
    h('div', { class: 'card' }, h('h3', {}, 'Réglages'), ui.sliders,
      h('p', { class: 'small' }, 'Avec « Repères » : fais glisser la ligne bleue des genoux, la ligne verte entre les jambes et les cercles orange des mains.'),
      h('div', { class: 'row' }, ui.resetBtn)),
    trajet,
    h('div', { class: 'card' },
      h('h3', {}, 'Ce que tu veux voir'),
      h('label', { class: 'small', for: 'note' }, 'Décris le mouvement voulu, avec tes mots :'),
      ui.note,
      h('div', { class: 'row' }, ui.sendBtn, ui.copyBtn),
      ui.status,
      h('h3', {}, 'Déjà envoyé'),
      ui.sent),
  );

  root.append(
    h('header', { class: 'top' },
      h('h1', {}, 'Studio des mouvements'),
      h('p', {}, 'Choisis un personnage et un mouvement, règle-le en le regardant bouger, puis envoie-le : Claude le reportera dans le jeu.')),
    h('main', { class: 'grid' }, left, right),
  );
}

function buildPeople(): void {
  ui.people.replaceChildren();
  const groups: Group[] = ['Habitants', 'Enfants', 'Ousmane et Coumba', 'Animaux'];
  for (const g of groups) {
    ui.people.append(h('p', { class: 'group' }, g));
    const row = h('div', { class: 'thumbs' });
    for (const e of ENTRIES.filter((x) => x.group === g)) {
      const pose = e.def.poses[e.pose('idle')] ?? Object.values(e.def.poses)[0];
      const b = h('button', { class: 'thumb', type: 'button', role: 'option', title: e.label, 'aria-label': e.label },
        h('img', { src: assets.url(pose.img), alt: '' }), h('span', {}, e.label));
      b.setAttribute('aria-selected', String(e === state.entry));
      b.addEventListener('click', () => selectEntry(e));
      row.append(b);
    }
    ui.people.append(row);
  }
}

function buildActions(): void {
  ui.actions.replaceChildren();
  for (const a of state.entry.actions) {
    const b = h('button', { class: 'chip', type: 'button', role: 'radio' }, MOTION_LABELS[a]);
    b.setAttribute('aria-checked', String(a === state.action));
    b.addEventListener('click', () => selectAction(a));
    ui.actions.append(b);
  }
}

const sliderInputs = new Map<keyof MotionParams, { input: HTMLInputElement; out: HTMLOutputElement; spec: ParamSpec }>();

function buildSliders(): void {
  ui.sliders.replaceChildren();
  sliderInputs.clear();
  for (const group of PARAMS) {
    const box = h('fieldset', { class: 'fs' }, h('legend', {}, group.title));
    for (const spec of group.items) {
      const id = 'p-' + spec.key;
      const input = h('input', { type: 'range', id, min: String(spec.min), max: String(spec.max), step: String(spec.step) });
      const out = h('output', { for: id });
      input.addEventListener('input', () => {
        state.params[spec.key] = Number(input.value);
        out.textContent = fmt(spec, state.params[spec.key]);
        state.dirty = true;
        applyMotion();
      });
      box.append(h('div', { class: 'slider' },
        h('label', { for: id, title: spec.help }, spec.label), out, input));
      sliderInputs.set(spec.key, { input, out, spec });
    }
    ui.sliders.append(box);
  }
}

function syncSliders(): void {
  for (const [key, s] of sliderInputs) {
    s.input.value = String(state.params[key]);
    s.out.textContent = fmt(s.spec, state.params[key]);
  }
}

// ------------------------------------------------------------------ scène 3D

const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, alpha: false });
renderer.setClearColor(0x6bb6ff);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 50);
camera.position.z = 10;
let backdrop: THREE.Mesh | null = null;
const ground = new THREE.Group();
scene.add(ground);
let view: CharacterView | null = null;
const shadow = new ContactShadow(1);
scene.add(shadow.mesh);

const sim = { x: 0, dir: 1 as 1 | -1, speed: 0, t: 0, camX: 0, half: 3 };

function buildGround(): void {
  ground.clear();
  const info = assets.info('props/sol_pierre');
  const tileW = 4.6 / 0.96;
  const tileH = tileW / (info.w / info.h);
  for (let i = -6; i <= 6; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: assets.tex('props/sol_pierre'), transparent: true, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.scale.set(i % 2 ? -tileW : tileW, tileH, 1);
    m.position.set(i * 4.6, 0.17 * tileH - tileH / 2, -0.02);
    ground.add(m);
  }
  const earth = new THREE.Mesh(new THREE.PlaneGeometry(80, 6), new THREE.MeshBasicMaterial({ color: 0x5a3018 }));
  earth.position.set(0, -tileH * 0.8 - 3, -0.03);
  ground.add(earth);
  const bmat = new THREE.MeshBasicMaterial({ map: assets.tex('bg/village'), toneMapped: false, depthWrite: false });
  backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bmat);
  backdrop.position.z = -5;
  scene.add(backdrop);
}

function currentPose(): PoseDef {
  const e = state.entry;
  return e.def.poses[e.pose(state.action)] ?? e.def.poses.idle ?? Object.values(e.def.poses)[0];
}

/** Taille et ancrage de l'image affichée, comme dans le jeu. */
function poseGeometry(): { w: number; h: number; ax: number } {
  const p = currentPose();
  const info = assets.info(p.img);
  const hh = p.h ?? info.h / (p.ppu ?? state.entry.def.ppu ?? 256);
  return { w: hh * (info.w / info.h), h: hh, ax: p.ax ?? info.fx ?? 0.5 };
}

function rebuildView(): void {
  view?.dispose();
  view = new CharacterView(assets, state.entry.def);
  view.setPose(state.entry.pose(state.action));
  scene.add(view.root);
  applyMotion(true);
}

function applyMotion(snap = false): void {
  if (!view) return;
  const g = poseGeometry();
  view.motion.setBody(state.body, g.h / g.w);
  view.motion.setParams({ ...state.params }, snap);
}

function moves(): boolean {
  return ['walk', 'run'].includes(state.action);
}

function resize(): void {
  const r = ui.stage.getBoundingClientRect();
  const w = Math.max(10, Math.floor(r.width));
  const hh = Math.max(10, Math.floor(r.height));
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, hh, false);
  ui.overlay.width = Math.floor(w * Math.min(2, window.devicePixelRatio || 1));
  ui.overlay.height = Math.floor(hh * Math.min(2, window.devicePixelRatio || 1));
}

function frameCamera(): void {
  const g = poseGeometry();
  const aspect = ui.stage.clientWidth / Math.max(1, ui.stage.clientHeight);
  const fh = state.zoom === 'large' ? 7.5 : g.h * 1.55;
  const fw = fh * aspect;
  sim.half = fw / 2;
  const target = state.zoom === 'large' ? 0 : sim.x;
  sim.camX += (target - sim.camX) * 0.12;
  const cy = state.zoom === 'large' ? fh * 0.36 : g.h * 0.46;
  camera.left = sim.camX - fw / 2;
  camera.right = sim.camX + fw / 2;
  camera.top = cy + fh / 2;
  camera.bottom = cy - fh / 2;
  camera.updateProjectionMatrix();
  if (backdrop) {
    const bi = assets.info('bg/village');
    const bw = Math.max(fw * 1.6, fh * 1.6 * (bi.w / bi.h));
    backdrop.scale.set(bw, bw / (bi.w / bi.h), 1);
    backdrop.position.set(sim.camX * 0.85, cy + fh * 0.05, -5);
  }
}

// ------------------------------------------------------------------ trajet montré à la souris

const pointer = { active: false, drag: null as null | 'knee' | 'split' | 'hand' | 'hand2' | 'r1' | 'r2' | 'body', lastX: 0, lastT: 0 };
let recStart = 0;
let playStart = 0;

function screenToWorld(ev: PointerEvent): { x: number; y: number } {
  const r = ui.overlay.getBoundingClientRect();
  const nx = (ev.clientX - r.left) / r.width;
  const ny = (ev.clientY - r.top) / r.height;
  return { x: camera.left + nx * (camera.right - camera.left), y: camera.top - ny * (camera.top - camera.bottom) };
}

/** Position d'un point de l'image (u, v) dans la scène, et l'inverse. */
function uvToWorld(u: number, v: number): { x: number; y: number } {
  const g = poseGeometry();
  return { x: sim.x + sim.dir * (u - g.ax) * g.w, y: v * g.h };
}

function worldToUv(x: number, y: number): { u: number; v: number } {
  const g = poseGeometry();
  return { u: (x - sim.x) * sim.dir / g.w + g.ax, v: y / g.h };
}

function hitTest(p: { x: number; y: number }): typeof pointer.drag {
  if (!state.guides) return 'body';
  const g = poseGeometry();
  const tol = (camera.top - camera.bottom) * 0.03;
  const near = (a: { x: number; y: number }): boolean => Math.hypot(a.x - p.x, a.y - p.y) < tol;
  for (const key of ['hand', 'hand2'] as const) {
    const hd = state.body[key];
    if (!hd) continue;
    const c = uvToWorld(hd.u, hd.v);
    const edge = { x: c.x + sim.dir * hd.r * g.h, y: c.y };
    if (near(edge)) return key === 'hand' ? 'r1' : 'r2';
    if (near(c)) return key;
  }
  const knee = uvToWorld(0, state.body.knee);
  if (Math.abs(p.y - knee.y) < tol && Math.abs(p.x - sim.x) < g.w * 0.7) return 'knee';
  const split = uvToWorld(state.body.split, 0);
  if (Math.abs(p.x - split.x) < tol && p.y < state.body.knee * g.h + tol) return 'split';
  return 'body';
}

function onPointerDown(ev: PointerEvent): void {
  try {
    ui.overlay.setPointerCapture(ev.pointerId);
  } catch {
    /* sans capture */
  }
  const p = screenToWorld(ev);
  pointer.active = true;
  pointer.lastX = p.x;
  pointer.lastT = performance.now();
  if (state.recording) {
    pointer.drag = 'body';
    state.path = [];
    recStart = performance.now();
    state.playing = false;
    sim.x = p.x;
    state.path.push([0, round(p.x)]);
    return;
  }
  pointer.drag = hitTest(p);
  if (pointer.drag === 'body') pointer.drag = null;
}

const round = (x: number): number => Math.round(x * 1000) / 1000;

function onPointerMove(ev: PointerEvent): void {
  const p = screenToWorld(ev);
  if (!pointer.active) {
    const hit = state.recording ? 'body' : hitTest(p);
    ui.overlay.style.cursor = hit === 'knee' ? 'ns-resize' : hit === 'split' ? 'ew-resize' : hit && hit !== 'body' ? 'move' : state.recording ? 'grab' : 'default';
    return;
  }
  if (state.recording) {
    const now = performance.now();
    const dt = Math.max(1, now - pointer.lastT) / 1000;
    sim.speed = (p.x - pointer.lastX) / dt;
    if (Math.abs(p.x - pointer.lastX) > 0.002) sim.dir = p.x > pointer.lastX ? 1 : -1;
    sim.x = p.x;
    pointer.lastX = p.x;
    pointer.lastT = now;
    const t = (now - recStart) / 1000;
    const last = state.path[state.path.length - 1];
    if (!last || t - last[0] > 0.033) state.path.push([round(t), round(p.x)]);
    return;
  }
  if (!pointer.drag) return;
  const uv = worldToUv(p.x, p.y);
  const g = poseGeometry();
  const b = state.body;
  const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
  if (pointer.drag === 'knee') b.knee = Math.min(0.7, Math.max(0.03, uv.v));
  else if (pointer.drag === 'split') b.split = clamp01(uv.u);
  else if (pointer.drag === 'hand' || pointer.drag === 'hand2') {
    const hd = b[pointer.drag];
    if (hd) b[pointer.drag] = { ...hd, u: clamp01(uv.u), v: clamp01(uv.v) };
  } else if (pointer.drag === 'r1' || pointer.drag === 'r2') {
    const key = pointer.drag === 'r1' ? 'hand' : 'hand2';
    const hd = b[key];
    if (hd) {
      const c = uvToWorld(hd.u, hd.v);
      b[key] = { ...hd, r: Math.min(0.4, Math.max(0.03, Math.hypot(p.x - c.x, p.y - c.y) / g.h)) };
    }
  }
  state.dirty = true;
  applyMotion();
}

function onPointerUp(): void {
  if (state.recording && pointer.active) {
    state.recording = false;
    sim.speed = 0;
    ui.recBtn.textContent = 'Enregistrer un trajet';
    ui.recBtn.classList.remove('rec');
    state.dirty = true;
    if (state.path.length > 3) {
      state.playing = true;
      playStart = performance.now();
    }
  }
  pointer.active = false;
  pointer.drag = null;
  refreshStageHint();
}

function pathPosition(t: number): { x: number; v: number } {
  const p = state.path;
  const total = p[p.length - 1][0] + 0.8;
  const tt = t % total;
  let i = 0;
  while (i < p.length - 1 && p[i + 1][0] < tt) i++;
  if (i >= p.length - 1) return { x: p[p.length - 1][1], v: 0 };
  const [t0, x0] = p[i];
  const [t1, x1] = p[i + 1];
  const k = t1 > t0 ? (tt - t0) / (t1 - t0) : 0;
  return { x: x0 + (x1 - x0) * k, v: t1 > t0 ? (x1 - x0) / (t1 - t0) : 0 };
}

// ------------------------------------------------------------------ boucle

let last = performance.now();
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!view) return;
  let speed = 0;
  if (state.playing && state.path.length > 3 && !state.recording) {
    const pp = pathPosition((now - playStart) / 1000);
    sim.speed = sim.speed + (pp.v - sim.speed) * Math.min(1, dt * 12);
    if (Math.abs(pp.v) > 0.05) sim.dir = pp.v > 0 ? 1 : -1;
    sim.x = pp.x;
    speed = sim.speed;
  } else if (state.recording) {
    speed = pointer.active ? sim.speed : 0;
    sim.speed *= 0.85;
  } else if (moves() && !state.inPlace) {
    speed = sim.dir * state.params.refSpeed;
    sim.x += speed * dt;
    const lim = state.zoom === 'large' ? sim.half - 1.2 : 6;
    if ((sim.dir > 0 && sim.x > lim) || (sim.dir < 0 && sim.x < -lim)) sim.dir = (-sim.dir) as 1 | -1;
  } else if (moves()) {
    speed = state.params.refSpeed;
  }
  view.setFacing(sim.dir);
  view.update(dt, { vx: speed, vy: 0, moving: Math.abs(speed) > 0.05 });
  view.root.position.set(sim.x, 0, 0);
  const g = poseGeometry();
  shadow.mesh.scale.x = g.w * 0.5;
  shadow.set(sim.x, 0, -0.01);
  frameCamera();
  renderer.render(scene, camera);
  drawOverlay();
}

function drawOverlay(): void {
  const c = ui.overlay;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  if (!state.guides || state.recording) return;
  const W = c.width;
  const H = c.height;
  const toPx = (p: { x: number; y: number }): [number, number] => [
    ((p.x - camera.left) / (camera.right - camera.left)) * W,
    ((camera.top - p.y) / (camera.top - camera.bottom)) * H,
  ];
  const g = poseGeometry();
  const px = W / (camera.right - camera.left);
  const lw = Math.max(2.5, W / 420);
  /** Trait lisible sur tous les fonds : contour sombre puis couleur. */
  const stroke = (color: string, draw: () => void, dash: number[] = []): void => {
    ctx.setLineDash(dash);
    ctx.lineWidth = lw + 3;
    ctx.strokeStyle = 'rgba(20,10,4,0.75)';
    ctx.beginPath();
    draw();
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    ctx.beginPath();
    draw();
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const label = (text: string, x: number, y: number, color: string): void => {
    ctx.font = `600 ${Math.round(Math.max(12, W / 60))}px system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,10,4,0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };
  // Ligne des genoux.
  const k0 = toPx(uvToWorld(sim.dir > 0 ? 0 : 1, state.body.knee));
  const k1 = toPx(uvToWorld(sim.dir > 0 ? 1 : 0, state.body.knee));
  stroke('#5cc0ff', () => {
    ctx.moveTo(k0[0], k0[1]);
    ctx.lineTo(k1[0], k1[1]);
  }, [12, 7]);
  label('genoux', Math.max(k0[0], k1[0]) + 8, k0[1] + 5, '#5cc0ff');
  // Séparation des jambes.
  const s0 = toPx(uvToWorld(state.body.split, 0));
  const s1 = toPx(uvToWorld(state.body.split, state.body.knee));
  stroke('#5be07f', () => {
    ctx.moveTo(s0[0], s0[1]);
    ctx.lineTo(s1[0], s1[1]);
  });
  // Mains.
  for (const key of ['hand', 'hand2'] as const) {
    const hd = state.body[key];
    if (!hd) continue;
    const c0 = toPx(uvToWorld(hd.u, hd.v));
    const r = hd.r * g.h * px;
    stroke('#ffa53a', () => ctx.arc(c0[0], c0[1], r, 0, Math.PI * 2));
    for (const [x, y, rad] of [[c0[0], c0[1], Math.max(5, W / 200)], [c0[0] + sim.dir * r, c0[1], Math.max(4, W / 260)]] as const) {
      ctx.fillStyle = 'rgba(20,10,4,0.8)';
      ctx.beginPath();
      ctx.arc(x, y, rad + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffa53a';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function refreshStageHint(): void {
  ui.hint.classList.toggle('rec', state.recording);
  ui.hint.textContent = state.recording
    ? 'Fais glisser le personnage : il suit ton doigt ou ta souris.'
    : state.guides
      ? 'Repères à glisser : genoux (bleu), jambes (vert), mains (orange).'
      : '';
  const n = state.path.length;
  ui.pathInfo.textContent = n > 3 ? `Trajet enregistré : ${state.path[n - 1][0].toFixed(1).replace('.', ',')} s.` : 'Aucun trajet enregistré.';
  ui.playBtn.disabled = n <= 3;
  ui.clearBtn.disabled = n === 0;
}

// ------------------------------------------------------------------ sélection

function defaultsFor(entry: Entry, action: MotionAction): { params: MotionParams; body: BodyProfile } {
  const pose = entry.def.poses[entry.pose(action)] ?? entry.def.poses.idle;
  const body = pose?.body ?? entry.def.body ?? DEFAULT_BODY;
  return { params: resolveMotion(action, entry.def.motion), body: JSON.parse(JSON.stringify(body)) as BodyProfile };
}

function loadSaved(entry: Entry, action: MotionAction): Saved | undefined {
  return savedDocs.get(`${entry.key}--${action}`);
}

function selectEntry(e: Entry): void {
  state.entry = e;
  const a = e.actions.includes(state.action) ? state.action : e.actions.includes('walk') ? 'walk' : e.actions[0];
  selectAction(a, true);
  buildPeople();
}

function selectAction(a: MotionAction, force = false): void {
  if (!force && a === state.action) return;
  state.action = a;
  const saved = loadSaved(state.entry, a);
  const d = defaultsFor(state.entry, a);
  state.params = saved ? { ...d.params, ...saved.reglages } : d.params;
  state.body = saved ? { ...d.body, ...saved.corps } : d.body;
  state.note = saved?.note ?? '';
  state.path = saved?.trajet ?? [];
  state.playing = state.path.length > 3;
  playStart = performance.now();
  state.dirty = false;
  ui.note.value = state.note;
  ui.title.textContent = `${state.entry.label} — ${MOTION_LABELS[a]}`;
  buildActions();
  syncSliders();
  rebuildView();
  sim.x = 0;
  refreshStageHint();
  setStatus(saved ? 'Ce mouvement a déjà été envoyé : tu peux le modifier et le renvoyer.' : '');
}

// ------------------------------------------------------------------ envoi à Claude

type Db = {
  collection(path: string): {
    doc(id: string): { set(data: Record<string, unknown>): Promise<void> };
    onSnapshot(next: (snap: { docs: { id: string; data(): Record<string, unknown> | undefined }[] }) => void, err?: (e: { code: string }) => void): () => void;
  };
};
let db: Db | null = null;
const savedDocs = new Map<string, Saved>();

function setStatus(text: string, kind: '' | 'ok' | 'err' = ''): void {
  ui.status.textContent = text;
  ui.status.className = 'status ' + kind;
}

function payload(): Saved {
  return {
    personnage: state.entry.key,
    nom: state.entry.label,
    action: state.action,
    reglages: { ...state.params },
    corps: JSON.parse(JSON.stringify(state.body)) as BodyProfile,
    note: ui.note.value.trim(),
    trajet: state.path.slice(0, 900),
    envoyeLe: new Date().toISOString(),
  };
}

async function send(): Promise<void> {
  if (!db) {
    setStatus('L’envoi n’est pas disponible ici : utilise « Copier les réglages » et colle-les dans la conversation.', 'err');
    return;
  }
  ui.sendBtn.disabled = true;
  setStatus('Envoi…');
  try {
    const data = payload();
    await db.collection('mouvements').doc(`${data.personnage}--${data.action}`).set(data as unknown as Record<string, unknown>);
    state.dirty = false;
    setStatus(`Envoyé : ${data.nom}, ${MOTION_LABELS[data.action].toLowerCase()}. Dis à Claude dans la conversation que c’est prêt.`, 'ok');
  } catch (err) {
    const code = (err as { code?: string }).code;
    setStatus(code === 'invalid_argument' ? 'Tu n’as pas le droit d’envoyer depuis cette page (lecture seule).' : 'L’envoi a échoué. Réessaie dans un instant, ou utilise « Copier les réglages ».', 'err');
  } finally {
    ui.sendBtn.disabled = false;
  }
}

async function copy(): Promise<void> {
  const text = JSON.stringify(payload());
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Réglages copiés : colle-les dans la conversation avec Claude.', 'ok');
  } catch {
    ui.note.value = (ui.note.value ? ui.note.value + '\n\n' : '') + text;
    ui.note.select();
    setStatus('Copie impossible ici : les réglages sont ajoutés dans la zone de texte, sélectionnés, prêts à copier.', 'err');
  }
}

function renderSent(): void {
  ui.sent.replaceChildren();
  if (!savedDocs.size) {
    ui.sent.append(h('li', { class: 'small' }, db ? 'Rien pour l’instant. Les mouvements envoyés apparaîtront ici.' : 'L’envoi n’est pas disponible ici.'));
    return;
  }
  const list = [...savedDocs.values()].sort((a, b) => (b.envoyeLe ?? '').localeCompare(a.envoyeLe ?? ''));
  for (const s of list) {
    const when = s.envoyeLe ? new Date(s.envoyeLe).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
    const b = h('button', { class: 'linkish', type: 'button' }, `${s.nom} — ${MOTION_LABELS[s.action] ?? s.action}`);
    b.addEventListener('click', () => {
      const e = ENTRIES.find((x) => x.key === s.personnage);
      if (!e) return;
      state.entry = e;
      buildPeople();
      selectAction(s.action, true);
    });
    ui.sent.append(h('li', {}, b, h('span', { class: 'small' }, ' ' + when)));
  }
}

async function connectDb(): Promise<void> {
  const claude = (window as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;
  if (!claude?.use) {
    renderSent();
    return;
  }
  try {
    db = (await claude.use('db')) as Db | null;
  } catch {
    db = null;
  }
  if (!db) {
    renderSent();
    return;
  }
  const timer = window.setTimeout(() => setStatus('Les mouvements déjà envoyés ne sont pas encore joignables.'), 10000);
  db.collection('mouvements').onSnapshot(
    (snap) => {
      window.clearTimeout(timer);
      savedDocs.clear();
      for (const d of snap.docs) {
        const v = d.data() as unknown as Saved | undefined;
        if (v && v.personnage && v.action) savedDocs.set(d.id, v);
      }
      renderSent();
    },
    () => {
      window.clearTimeout(timer);
      renderSent();
    },
  );
}

// ------------------------------------------------------------------ démarrage

async function boot(): Promise<void> {
  buildLayout();
  setStatus('Chargement des images…');
  await assets.loadManifest();
  const imgs = new Set<string>(['props/sol_pierre', 'bg/village']);
  for (const e of ENTRIES) for (const p of Object.values(e.def.poses)) imgs.add(p.img);
  await assets.load(imgs);
  buildPeople();
  buildSliders();
  buildGround();
  ui.recBtn.addEventListener('click', () => {
    state.recording = !state.recording;
    state.playing = false;
    ui.recBtn.textContent = state.recording ? 'Glisse le personnage…' : 'Enregistrer un trajet';
    ui.recBtn.classList.toggle('rec', state.recording);
    if (state.recording) state.zoom = 'large';
    (document.getElementById('zoom') as HTMLInputElement).checked = state.zoom === 'large';
    refreshStageHint();
  });
  ui.playBtn.addEventListener('click', () => {
    state.playing = true;
    playStart = performance.now();
  });
  ui.clearBtn.addEventListener('click', () => {
    state.path = [];
    state.playing = false;
    sim.x = 0;
    state.dirty = true;
    refreshStageHint();
  });
  ui.resetBtn.addEventListener('click', () => {
    const d = defaultsFor(state.entry, state.action);
    state.params = d.params;
    state.body = d.body;
    syncSliders();
    applyMotion();
    setStatus('Réglages du jeu rétablis pour ce mouvement.');
  });
  ui.sendBtn.addEventListener('click', () => void send());
  ui.copyBtn.addEventListener('click', () => void copy());
  ui.overlay.addEventListener('pointerdown', onPointerDown);
  ui.overlay.addEventListener('pointermove', onPointerMove);
  ui.overlay.addEventListener('pointerup', onPointerUp);
  ui.overlay.addEventListener('pointercancel', onPointerUp);
  new ResizeObserver(resize).observe(ui.stage);
  resize();
  selectEntry(state.entry);
  setStatus('');
  void connectDb();
  renderSent();
  requestAnimationFrame(frame);
  (window as unknown as { __studio: unknown }).__studio = { state, sim, selectEntry, selectAction, ENTRIES };
}

void boot();
