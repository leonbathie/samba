/**
 * Réglages du déplacement du héros. Ils sont partagés par le jeu (Player.ts) et par le test
 * d'accessibilité des niveaux (tests/unit/reach.ts) : modifier un saut ici met les deux à jour.
 */
export const GRAV = 32;
export const MAX_FALL = 21;
export const STAND_H = 1.5;
export const CROUCH_H = 0.9;
export const PLAYER_W = 0.62;

/** Dehors (course, grand saut) et dans les intérieurs (marche, petit saut). */
export const MOVE = {
  out: { walk: 3.6, run: 6.4, jump: 13.2, acc: 46, dec: 60, air: 30, climb: 3.3 },
  in: { walk: 1.7, run: 2.3, jump: 7.6, acc: 30, dec: 40, air: 18, climb: 1.8 },
};

export type MoveSet = (typeof MOVE)['out'];

/** Facteurs appliqués aux sauts depuis une liane et depuis une branche où l'on est suspendu. */
export const VINE_JUMP = 0.82;
export const VINE_RUN = 0.85;
export const HANG_PULL = 0.9;
export const HANG_SPEED = 2.7;
/** Hauteur des mains au-dessus des pieds, et tolérance pour attraper une branche. */
export const HANG_REACH = 0.3;
