/**
 * Catalogue des personnages et de leurs poses.
 *
 * IMPORTANT : toutes les images référencées ici sont des représentations PROVISOIRES, découpées
 * dans les planches et les scènes du pack de référence. Aucune n'est un modèle 3D.
 * L'identifiant `id` sert à brancher un vrai modèle GLB (public/assets/models/models.json) :
 * dès qu'un modèle est déclaré pour cet identifiant, il remplace automatiquement les images.
 *
 * Mouvements : les poses marquées `motion` déforment l'image par zones (render/motion.ts) en gardant
 * les pieds au sol. `body` situe dans l'image les genoux, la séparation des jambes et les mains ;
 * `motion` ajuste les mouvements de base pour un personnage (réglés avec le studio des mouvements).
 *
 * Noms de poses attendus par le jeu (et donc par les animations des futurs modèles) :
 *   héros   : idle, run, jump, fall, land, crouch, climb, hang, bananaWind, stoneWind, throw,
 *             stoneThrow, slingAim, slingFire, guard, hurt, talk, cheer
 *   ennemis : idle, warn, attack, move, stun, happy
 *   habitants : idle, walk, run, chat (parler), listen (écouter), dance
 */
import type { CharacterDef, PoseDef } from '../render/characters';
import type { BodyProfile, MotionAction, MotionParams } from '../render/motion';

export const HERO: CharacterDef = {
  id: 'hero',
  ppu: 256,
  motion: {
    idle: { breathe: 0.014, sway: 0.006, nod: 0.01 },
    run: { cadence: 1.75, refSpeed: 6.2, stride: 0.09, lift: 0.05, bob: 0.03, lean: 0.03, twist: 0.03 },
    talk: { gesture: 0, nod: 0.02 },
  },
  poses: {
    idle: { img: 'hero/idle', motion: 'idle', ax: 0.6, body: { knee: 0.27, split: 0.58 } },
    run: { img: 'hero/run', motion: 'run', ax: 0.62, body: { knee: 0.33, split: 0.52 } },
    jump: { img: 'hero/jump', anim: 'air', ax: 0.56 },
    fall: { img: 'hero/jump', anim: 'air', ax: 0.56 },
    land: { img: 'hero/land', ax: 0.52, dy: -0.05 },
    crouch: { img: 'hero/crouch', motion: 'idle', ax: 0.6, body: { knee: 0.2, split: 0.5 } },
    climb: { img: 'hero/climb', anim: 'climb', ax: 0.72 },
    hang: { img: 'hero/hang', anim: 'sway', ax: 0.56, pivotTop: true },
    bananaWind: { img: 'hero/banana_windup', ax: 0.5 },
    stoneWind: { img: 'hero/stone_ready', ax: 0.55 },
    throw: { img: 'hero/throw', ax: 0.5 },
    stoneThrow: { img: 'hero/stone_throw', ax: 0.52 },
    slingAim: { img: 'hero/sling_aim', ax: 0.45 },
    slingFire: { img: 'hero/sling_fire', ax: 0.45 },
    guard: { img: 'hero/guard', ax: 0.6 },
    hurt: { img: 'hero/hurt', anim: 'shake', ax: 0.5 },
    talk: { img: 'hero/talk', ppu: 225, motion: 'talk', ax: 0.52, body: { knee: 0.25, split: 0.5 } },
    cheer: { img: 'hero/jump', anim: 'bounce', ax: 0.56 },
  },
};

export const AMIE: CharacterDef = {
  id: 'amie',
  body: { knee: 0.25, split: 0.48, hand: { u: 0.86, v: 0.62, r: 0.1 } },
  motion: {
    run: { cadence: 1.8, refSpeed: 6, stride: 0.1, lift: 0.06, lean: 0.04 },
    idle: { gesture: 0.012, gestureSpeed: 0.8 },
  },
  poses: {
    idle: { img: 'npc/amie', h: 1.62, motion: 'idle', ax: 0.5 },
    run: { img: 'npc/amie_course', h: 1.42, motion: 'run', ax: 0.5, body: { knee: 0.33, split: 0.5 } },
    jump: { img: 'npc/amie_course', h: 1.42, anim: 'air', ax: 0.5 },
    cheer: { img: 'npc/amie', h: 1.62, anim: 'bounce', ax: 0.5 },
  },
};

type Seat = NonNullable<CharacterDef['seat']>;
type Tweaks = Partial<Record<MotionAction, Partial<MotionParams>>>;

interface Villager {
  id: string;
  img: string;
  h: number;
  ax?: number;
  body?: BodyProfile;
  seat?: Seat;
  /** Mouvement au repos (les musiciens jouent, la cuisinière remue sa marmite…). */
  idle?: MotionAction;
  /** Mouvement de la fête (les personnages assis jouent ou applaudissent au lieu de danser). */
  party?: MotionAction;
  motion?: Tweaks;
}

/** Un habitant : la même image pour toutes ses poses, chacune avec son mouvement. */
const villager = (v: Villager): CharacterDef => {
  const pose = (motion: MotionAction): PoseDef => ({ img: v.img, h: v.h, ax: v.ax ?? 0.5, motion });
  const seated = !!v.seat;
  return {
    id: v.id,
    seat: v.seat,
    body: v.body ?? { knee: 0.28, split: 0.5 },
    motion: v.motion,
    poses: {
      idle: pose(v.idle ?? 'idle'),
      walk: pose(seated ? 'idle' : 'walk'),
      run: pose(seated ? 'idle' : 'run'),
      chat: pose(v.idle && seated ? v.idle : 'talk'),
      listen: pose(v.idle && seated ? v.idle : 'listen'),
      dance: pose(v.party ?? (seated ? v.idle ?? 'clap' : 'dance')),
    },
  };
};

/** Une robe longue : le bas de la robe balance plus haut que des jambes de pantalon. */
const ROBE = 0.3;

/** Habitants et animaux amis. La clé est celle utilisée par les niveaux (NpcDef.char). */
export const CHARACTERS: Record<string, CharacterDef> = {
  hero: HERO,
  amie: AMIE,
  conteuse: villager({ id: 'conteuse', img: 'npc/conteuse', h: 1.55, ax: 0.55, idle: 'talk', body: { knee: 0.12, split: 0.5, hand: { u: 0.17, v: 0.62, r: 0.1 } } }),
  mamie: villager({
    id: 'conteuse_fete', img: 'npc/mamie', h: 1.45, seat: { x0: 0.42, x1: 0.8, top: 0.28 }, idle: 'listen', party: 'clap',
    body: { knee: 0.12, split: 0.5, hand: { u: 0.42, v: 0.72, r: 0.12 } },
  }),
  sorcier: villager({
    id: 'sorcier', img: 'npc/doyen', h: 2.1, body: { knee: ROBE, split: 0.5, hand: { u: 0.86, v: 0.8, r: 0.08 } },
    motion: { idle: { gesture: 0.012, gestureSpeed: 0.7 }, walk: { cadence: 0.7, stride: 0.04, lean: 0.015 } },
  }),
  femme_fruits: villager({
    id: 'femme_fruits', img: 'npc/femme_fruits', h: 2.05, body: { knee: ROBE, split: 0.5, hand: { u: 0.76, v: 0.6, r: 0.08 } },
    motion: { talk: { gesture: 0.025 }, walk: { gesture: 0.008, gestureSpeed: 0.95 } },
  }),
  femme_kente: villager({ id: 'femme_kente', img: 'npc/femme_kente', h: 2.05, body: { knee: ROBE, split: 0.5 } }),
  femme_bleue: villager({ id: 'femme_bleue', img: 'npc/femme_bleue', h: 1.85, body: { knee: ROBE, split: 0.5, hand: { u: 0.84, v: 0.67, r: 0.1 } } }),
  femme_rose: villager({ id: 'femme_rose', img: 'npc/femme_rose', h: 2.0, body: { knee: ROBE, split: 0.5, hand: { u: 0.58, v: 0.62, r: 0.1 } } }),
  femme_verte: villager({ id: 'femme_verte', img: 'npc/femme_verte', h: 2.0, body: { knee: ROBE, split: 0.48, hand: { u: 0.82, v: 0.6, r: 0.09 } } }),
  porteuse: villager({
    id: 'porteuse', img: 'npc/porteuse', h: 2.35, body: { knee: ROBE, split: 0.5 },
    motion: { walk: { nod: 0.004, cadence: 0.85 }, talk: { nod: 0.008 } },
  }),
  cuisiniere: villager({
    id: 'cuisiniere', img: 'npc/cuisiniere', h: 1.55, ax: 0.62, idle: 'stir', party: 'clap',
    body: { knee: 0.1, split: 0.6, hand: { u: 0.52, v: 0.6, r: 0.1 } },
  }),
  artisan: villager({
    id: 'artisan', img: 'npc/artisan', h: 1.75, ax: 0.45, seat: { x0: 0.05, x1: 0.4, top: 0.24 }, idle: 'carve',
    body: { knee: 0.12, split: 0.5, hand: { u: 0.5, v: 0.62, r: 0.1 } },
  }),
  enfants_assis: villager({ id: 'enfants_assis', img: 'npc/enfants_assis', h: 1.15, idle: 'listen', body: { knee: 0.1, split: 0.5 }, motion: { listen: { nod: 0.03 } } }),
  enfant_garcon: villager({
    id: 'enfant_garcon', img: 'npc/enfant_garcon', h: 1.25,
    body: { knee: 0.34, split: 0.5, hand: { u: 0.08, v: 0.6, r: 0.13 }, hand2: { u: 0.94, v: 0.62, r: 0.13 } },
    motion: {
      run: { cadence: 1.9, refSpeed: 2.3, stride: 0.13, lift: 0.07, gesture: 0.06, gestureSpeed: 1.9 },
      idle: { gesture: 0.02, gestureSpeed: 1.1, sway: 0.012 },
    },
  }),
  enfant_fille: villager({
    id: 'enfant_fille', img: 'npc/enfant_fille', h: 1.25,
    body: { knee: 0.32, split: 0.5, hand: { u: 0.06, v: 0.62, r: 0.13 }, hand2: { u: 0.94, v: 0.6, r: 0.13 } },
    motion: {
      run: { cadence: 1.9, refSpeed: 2.3, stride: 0.13, lift: 0.07, gesture: 0.06, gestureSpeed: 1.9 },
      idle: { gesture: 0.02, gestureSpeed: 1.1, sway: 0.012 },
    },
  }),
  fille_exploratrice: villager({ id: 'fille_exploratrice', img: 'npc/fille_exploratrice', h: 1.72, body: { knee: 0.27, split: 0.47 } }),
  garcon_explorateur: villager({ id: 'garcon_explorateur', img: 'npc/garcon_explorateur', h: 1.62, body: { knee: 0.27, split: 0.47 } }),
  musicien_djembe: villager({
    id: 'musicien_djembe', img: 'npc/musicien_djembe', h: 1.6, seat: { x0: 0.04, x1: 0.36, top: 0.31 }, idle: 'drum',
    body: { knee: 0.15, split: 0.5, hand: { u: 0.56, v: 0.53, r: 0.08 }, hand2: { u: 0.82, v: 0.54, r: 0.08 } },
  }),
  musicien_kora: villager({
    id: 'musicien_kora', img: 'npc/musicien_kora', h: 1.62, seat: { x0: 0.04, x1: 0.34, top: 0.3 }, idle: 'drum',
    body: { knee: 0.15, split: 0.5, hand: { u: 0.46, v: 0.6, r: 0.07 }, hand2: { u: 0.62, v: 0.63, r: 0.07 } },
    motion: { drum: { gesture: 0.022, gestureSpeed: 3.1, nod: 0.03 } },
  }),
  musicienne_djembe: villager({
    id: 'musicienne_djembe', img: 'npc/musicienne_djembe', h: 1.5, seat: { x0: 0.08, x1: 0.38, top: 0.36 }, idle: 'drum',
    body: { knee: 0.15, split: 0.5, hand: { u: 0.62, v: 0.56, r: 0.08 }, hand2: { u: 0.86, v: 0.58, r: 0.08 } },
  }),
  danseuse: villager({
    id: 'danseuse', img: 'npc/danseuse', h: 1.5,
    body: { knee: 0.3, split: 0.5, hand: { u: 0.1, v: 0.8, r: 0.11 }, hand2: { u: 0.9, v: 0.82, r: 0.11 } },
  }),
  danseur: villager({
    id: 'danseur', img: 'npc/danseur', h: 1.4,
    body: { knee: 0.33, split: 0.5, hand: { u: 0.12, v: 0.84, r: 0.11 }, hand2: { u: 0.9, v: 0.86, r: 0.11 } },
  }),
  singe_ami: villager({
    id: 'singe_ami', img: 'npc/singe_ami', h: 0.95, body: { knee: 0.2, split: 0.5, hand: { u: 0.1, v: 0.62, r: 0.16 } },
    motion: { idle: { gesture: 0.04, gestureSpeed: 0.9, nod: 0.02 } },
  }),
  grue: villager({
    id: 'grue', img: 'npc/grue', h: 1.5,
    body: { knee: 0.34, split: 0.5, hand: { u: 0.14, v: 0.56, r: 0.14 }, hand2: { u: 0.84, v: 0.56, r: 0.14 } },
    motion: { walk: { cadence: 0.8, stride: 0.06, nod: 0.045, gesture: 0.015, gestureSpeed: 0.8 }, idle: { nod: 0.03, gesture: 0.012, gestureSpeed: 0.6 } },
  }),
};

/** Quadrupède : pattes avant et arrière en ciseaux. */
const QUADRUPED: BodyProfile = { knee: 0.36, split: 0.5 };

export const ENEMIES: Record<string, CharacterDef> = {
  singe: {
    id: 'singe',
    body: { knee: 0.22, split: 0.5, hand: { u: 0.12, v: 0.7, r: 0.15 } },
    motion: { idle: { gesture: 0.035, gestureSpeed: 0.9, nod: 0.02 }, walk: { cadence: 1.4, stride: 0.05, refSpeed: 1.4, gesture: 0.03 } },
    poses: {
      idle: { img: 'enemies/singe_assis', h: 0.95, motion: 'idle' },
      move: { img: 'enemies/singe_assis', h: 0.95, motion: 'walk' },
      warn: { img: 'enemies/singe_arme', h: 1.05, anim: 'shake' },
      attack: { img: 'enemies/singe_lance', h: 1.02 },
      stun: { img: 'enemies/singe_assis', h: 0.95, anim: 'shake' },
      happy: { img: 'enemies/singe_assis', h: 0.95, motion: 'dance' },
    },
  },
  serpent: {
    id: 'serpent',
    body: { knee: 0.05, split: 0.5 },
    motion: { idle: { sway: 0.03, nod: 0.03, breathe: 0.02, cadence: 0.6 } },
    poses: {
      idle: { img: 'enemies/serpent', h: 1.05, motion: 'idle' },
      warn: { img: 'enemies/serpent_attaque', h: 1.1, anim: 'shake' },
      attack: { img: 'enemies/serpent_attaque', h: 1.1 },
      stun: { img: 'enemies/serpent', h: 1.05, anim: 'shake' },
    },
  },
  croc: {
    id: 'crocodile',
    poses: {
      idle: { img: 'enemies/crocodile_nage', h: 0.62, anim: 'float' },
      move: { img: 'enemies/crocodile_nage', h: 0.62, anim: 'float' },
      warn: { img: 'enemies/crocodile_nage', h: 0.62, anim: 'shake' },
      attack: { img: 'enemies/crocodile', h: 1.15 },
      stun: { img: 'enemies/crocodile_nage', h: 0.62, anim: 'shake' },
    },
  },
  hyene: {
    id: 'hyene',
    body: QUADRUPED,
    motion: {
      idle: { nod: 0.02, breathe: 0.02, cadence: 0.5 },
      walk: { cadence: 1.2, refSpeed: 1.6, stride: 0.07, lift: 0.04, nod: 0.02, lean: 0 },
      run: { cadence: 2.4, refSpeed: 5.3, stride: 0.1, lift: 0.06, bob: 0.035, lean: 0, nod: 0.025 },
    },
    poses: {
      idle: { img: 'enemies/hyene', h: 1.3, motion: 'idle' },
      warn: { img: 'enemies/hyene_b', h: 1.38, anim: 'shake' },
      move: { img: 'enemies/hyene', h: 1.3, motion: 'walk' },
      attack: { img: 'enemies/hyene_b', h: 1.38, motion: 'run' },
      stun: { img: 'enemies/hyene', h: 1.3, anim: 'shake' },
    },
  },
  phaco: {
    id: 'phacochere',
    body: QUADRUPED,
    motion: {
      idle: { nod: 0.015, breathe: 0.02, cadence: 0.5 },
      walk: { cadence: 1.2, refSpeed: 1.5, stride: 0.06, lift: 0.04, lean: 0 },
      run: { cadence: 2.8, refSpeed: 9.6, stride: 0.1, lift: 0.07, bob: 0.04, lean: 0, nod: 0.02 },
    },
    poses: {
      idle: { img: 'enemies/phacochere', h: 1.3, motion: 'idle' },
      warn: { img: 'enemies/phacochere', h: 1.3, anim: 'shake' },
      attack: { img: 'enemies/phacochere', h: 1.3, motion: 'run' },
      move: { img: 'enemies/phacochere', h: 1.3, motion: 'walk' },
      stun: { img: 'enemies/phacochere', h: 1.3, anim: 'shake' },
    },
  },
};

/** Images à charger pour afficher un personnage. */
export function characterImages(def: CharacterDef): string[] {
  return [...new Set(Object.values(def.poses).map((p) => p.img))];
}
