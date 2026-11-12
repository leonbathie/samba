/**
 * Catalogue des personnages et de leurs poses.
 *
 * IMPORTANT : toutes les images référencées ici sont des représentations PROVISOIRES, découpées
 * dans les planches et les scènes du pack de référence. Aucune n'est un modèle 3D.
 * L'identifiant `id` sert à brancher un vrai modèle GLB (public/assets/models/models.json) :
 * dès qu'un modèle est déclaré pour cet identifiant, il remplace automatiquement les images.
 *
 * Noms de poses attendus par le jeu (et donc par les animations des futurs modèles) :
 *   héros   : idle, run, jump, fall, land, crouch, climb, hang, bananaWind, stoneWind, throw,
 *             stoneThrow, slingAim, slingFire, guard, hurt, talk, cheer
 *   ennemis : idle, warn, attack, move, stun, happy
 *   autres  : idle (+ run pour l'amie)
 */
import type { CharacterDef } from '../render/characters';

export const HERO: CharacterDef = {
  id: 'hero',
  ppu: 256,
  poses: {
    idle: { img: 'hero/idle', anim: 'breathe', ax: 0.6 },
    run: { img: 'hero/run', anim: 'run', ax: 0.62 },
    jump: { img: 'hero/jump', anim: 'air', ax: 0.56 },
    fall: { img: 'hero/jump', anim: 'air', ax: 0.56 },
    land: { img: 'hero/land', ax: 0.52, dy: -0.05 },
    crouch: { img: 'hero/crouch', anim: 'breathe', ax: 0.6 },
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
    talk: { img: 'hero/talk', ppu: 225, anim: 'breathe', ax: 0.52 },
    cheer: { img: 'hero/jump', anim: 'bounce', ax: 0.56 },
  },
};

export const AMIE: CharacterDef = {
  id: 'amie',
  poses: {
    idle: { img: 'npc/amie', h: 1.62, anim: 'breathe', ax: 0.5 },
    run: { img: 'npc/amie_course', h: 1.42, anim: 'run', ax: 0.5 },
    jump: { img: 'npc/amie_course', h: 1.42, anim: 'air', ax: 0.5 },
    cheer: { img: 'npc/amie', h: 1.62, anim: 'bounce', ax: 0.5 },
  },
};

const one = (id: string, img: string, h: number, anim: CharacterDef['poses'][string]['anim'] = 'breathe', ax = 0.5): CharacterDef => ({
  id,
  poses: { idle: { img, h, anim, ax }, dance: { img, h, anim: 'bounce', ax } },
});

/** Habitants et animaux amis. La clé est celle utilisée par les niveaux (NpcDef.char). */
export const CHARACTERS: Record<string, CharacterDef> = {
  hero: HERO,
  amie: AMIE,
  conteuse: one('conteuse', 'npc/conteuse', 1.55, 'breathe', 0.55),
  mamie: one('conteuse_fete', 'npc/mamie', 1.45, 'breathe', 0.5),
  sorcier: one('sorcier', 'npc/doyen', 2.1, 'breathe', 0.5),
  femme_fruits: one('femme_fruits', 'npc/femme_fruits', 2.05),
  femme_kente: one('femme_kente', 'npc/femme_kente', 2.05),
  femme_bleue: one('femme_bleue', 'npc/femme_bleue', 1.85),
  femme_rose: one('femme_rose', 'npc/femme_rose', 2.0),
  femme_verte: one('femme_verte', 'npc/femme_verte', 2.0),
  porteuse: one('porteuse', 'npc/porteuse', 2.35),
  cuisiniere: one('cuisiniere', 'npc/cuisiniere', 1.55, 'breathe', 0.62),
  artisan: one('artisan', 'npc/artisan', 1.75, 'breathe', 0.45),
  enfants_assis: one('enfants_assis', 'npc/enfants_assis', 1.15),
  enfant_garcon: one('enfant_garcon', 'npc/enfant_garcon', 1.25, 'hop'),
  enfant_fille: one('enfant_fille', 'npc/enfant_fille', 1.25, 'hop'),
  fille_exploratrice: one('fille_exploratrice', 'npc/fille_exploratrice', 1.72),
  garcon_explorateur: one('garcon_explorateur', 'npc/garcon_explorateur', 1.62),
  musicien_djembe: one('musicien_djembe', 'npc/musicien_djembe', 1.6, 'bounce'),
  musicien_kora: one('musicien_kora', 'npc/musicien_kora', 1.62, 'breathe'),
  musicienne_djembe: one('musicienne_djembe', 'npc/musicienne_djembe', 1.5, 'bounce'),
  danseuse: one('danseuse', 'npc/danseuse', 1.5, 'bounce'),
  danseur: one('danseur', 'npc/danseur', 1.4, 'bounce'),
  singe_ami: one('singe_ami', 'npc/singe_ami', 0.95, 'hop'),
  grue: one('grue', 'npc/grue', 1.5, 'breathe'),
};

export const ENEMIES: Record<string, CharacterDef> = {
  singe: {
    id: 'singe',
    poses: {
      idle: { img: 'enemies/singe_assis', h: 0.95, anim: 'breathe' },
      move: { img: 'enemies/singe_assis', h: 0.95, anim: 'hop' },
      warn: { img: 'enemies/singe_arme', h: 1.05, anim: 'shake' },
      attack: { img: 'enemies/singe_lance', h: 1.02 },
      stun: { img: 'enemies/singe_assis', h: 0.95, anim: 'shake' },
      happy: { img: 'enemies/singe_assis', h: 0.95, anim: 'hop' },
    },
  },
  serpent: {
    id: 'serpent',
    poses: {
      idle: { img: 'enemies/serpent', h: 1.05, anim: 'breathe' },
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
    poses: {
      idle: { img: 'enemies/hyene', h: 1.3, anim: 'breathe' },
      warn: { img: 'enemies/hyene_b', h: 1.38, anim: 'shake' },
      move: { img: 'enemies/hyene', h: 1.3, anim: 'run' },
      attack: { img: 'enemies/hyene_b', h: 1.38, anim: 'run' },
      stun: { img: 'enemies/hyene', h: 1.3, anim: 'shake' },
    },
  },
  phaco: {
    id: 'phacochere',
    poses: {
      idle: { img: 'enemies/phacochere', h: 1.3, anim: 'breathe' },
      warn: { img: 'enemies/phacochere', h: 1.3, anim: 'shake' },
      attack: { img: 'enemies/phacochere', h: 1.3, anim: 'run' },
      move: { img: 'enemies/phacochere', h: 1.3, anim: 'run' },
      stun: { img: 'enemies/phacochere', h: 1.3, anim: 'shake' },
    },
  },
};

/** Images à charger pour afficher un personnage. */
export function characterImages(def: CharacterDef): string[] {
  return [...new Set(Object.values(def.poses).map((p) => p.img))];
}
