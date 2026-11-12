/**
 * Liste des niveaux et des intérieurs.
 * Pour ajouter un chapitre : écrire un fichier de niveau (voir niveau1.ts) et l'ajouter ici.
 */
import type { LevelDef } from '../types';
import { caseConteuse, caseFamille, niveau1 } from './niveau1';

/** Niveaux dans l'ordre de l'aventure. Chaque appel construit une description neuve. */
export const LEVELS: (() => LevelDef)[] = [niveau1];

/** Intérieurs accessibles par une porte (DoorDef.to). */
export const ROOMS: Record<string, () => LevelDef> = {
  famille: caseFamille,
  conteuse: caseConteuse,
};
