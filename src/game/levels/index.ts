/**
 * Liste des niveaux et des intérieurs.
 * Pour ajouter un chapitre : écrire un fichier de niveau (voir niveau1.ts) et l'ajouter ici.
 */
import type { LevelDef } from '../types';
import { caseConteuse, caseFamille, niveau1 } from './niveau1';
import { caseSorcier, niveau2 } from './niveau2';
import { niveau3 } from './niveau3';
import { niveau4 } from './niveau4';
import { niveau5 } from './niveau5';
import { niveau6, templeSecret } from './niveau6';
import { niveau7 } from './niveau7';

/** Niveaux dans l'ordre de l'aventure. Chaque appel construit une description neuve. */
export const LEVELS: (() => LevelDef)[] = [niveau1, niveau2, niveau3, niveau4, niveau5, niveau6, niveau7];

/** Intérieurs accessibles par une porte (DoorDef.to). */
export const ROOMS: Record<string, () => LevelDef> = {
  famille: caseFamille,
  conteuse: caseConteuse,
  sorcier: caseSorcier,
  temple: templeSecret,
};
