/**
 * Personnages qui parlent et missions de l'aventure.
 * Les textes eux-mêmes sont dans src/i18n (fr.ts, en.ts) : ici, seulement des clés.
 */
import type { Game } from './Game';

export interface Speaker {
  /** Clé de traduction du nom. */
  name: string;
  /** Image servant de portrait dans la boîte de dialogue. */
  img: string;
}

export const SPEAKERS: Record<string, Speaker> = {
  ousmane: { name: 'name.ousmane', img: 'hero/talk' },
  narrateur: { name: 'name.narrateur', img: 'items/parchemin' },
  maman: { name: 'name.maman', img: 'npc/femme_fruits' },
  tante: { name: 'name.tante', img: 'npc/femme_kente' },
  conteuse: { name: 'name.conteuse', img: 'npc/conteuse' },
  enfants: { name: 'name.enfants', img: 'npc/enfants_assis' },
  voisine1: { name: 'name.voisine1', img: 'npc/femme_bleue' },
  voisine2: { name: 'name.voisine2', img: 'npc/femme_rose' },
  voisine3: { name: 'name.voisine3', img: 'npc/femme_verte' },
  malick: { name: 'name.malick', img: 'npc/enfant_garcon' },
  fanta: { name: 'name.fanta', img: 'npc/enfant_fille' },
  marchande: { name: 'name.marchande', img: 'npc/porteuse' },
  artisan: { name: 'name.artisan', img: 'npc/artisan' },
  cuisiniere: { name: 'name.cuisiniere', img: 'npc/cuisiniere' },
  sorcier: { name: 'name.sorcier', img: 'npc/doyen' },
  coumba: { name: 'name.coumba', img: 'npc/amie' },
  pecheuse: { name: 'name.pecheuse', img: 'npc/femme_kente' },
  exploratrice: { name: 'name.exploratrice', img: 'npc/fille_exploratrice' },
  explorateur: { name: 'name.explorateur', img: 'npc/garcon_explorateur' },
  musicien: { name: 'name.musicien', img: 'npc/musicien_kora' },
};

export interface QuestInfo {
  title: string;
  /** Mission principale (sinon mission secondaire donnée par un habitant). */
  main?: boolean;
  /** Détail affiché dans le carnet de missions. */
  detail: (g: Game) => string;
}

/** Missions, dans l'ordre où elles apparaissent dans le carnet (menu pause). */
export const QUESTS: Record<string, QuestInfo> = {
  carte: { title: 'quest.carte', main: true, detail: () => 'quest.carte.d' },
  sorcier: { title: 'quest.sorcier', main: true, detail: () => 'quest.sorcier.d' },
  indices: {
    title: 'quest.indices', main: true,
    detail: (g) => (g.has('indice3') ? 'quest.indices.d3' : g.has('indice2') ? 'quest.indices.d2' : 'quest.indices.d1'),
  },
  temple: { title: 'quest.temple', main: true, detail: () => 'quest.temple.d' },
  retour: { title: 'quest.retour', main: true, detail: () => 'quest.retour.d' },
  ballon: { title: 'quest.ballon', detail: (g) => (g.has('ballon') ? 'quest.ballon.d2' : 'quest.ballon.d1') },
  beignets: { title: 'quest.beignets', detail: () => 'quest.beignets.d' },
  singe: { title: 'quest.singe', detail: () => 'quest.singe.d' },
  jarres: { title: 'quest.jarres', detail: () => 'quest.jarres.d' },
};

/** Ordre des signes à réveiller dans le temple, tel que le révèlent les trois indices. */
export const TEMPLE_ORDER = ['soleil', 'eau', 'baobab'] as const;

/** Rappel des indices déjà trouvés (énigme du temple, carnet de missions). */
export function knownClues(g: Game): string[] {
  const out: string[] = [];
  if (g.has('indice1')) out.push('clue.1');
  if (g.has('indice2')) out.push('clue.2');
  if (g.has('indice3')) out.push('clue.3');
  return out;
}
