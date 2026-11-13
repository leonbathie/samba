/**
 * Description des niveaux : tout le contenu d'un niveau (sols, objets, ennemis, habitants, portes…)
 * est une simple donnée, construite avec LevelBuilder (levels/builder.ts).
 */
import type { Ambience, MusicTheme } from '../core/Audio';
import type { Game } from './Game';
import type { Stage } from './Stage';

/** Apparence d'un sol ou d'une plateforme. */
export type SolidStyle =
  | 'stone' // muret de pierre peint (sol principal)
  | 'branch' // branche d'arbre
  | 'motif' // dalle flottante à motifs
  | 'bridge' // pont de corde
  | 'pilotis' // plateforme de bois sur pilotis
  | 'gue' // pierre de gué
  | 'pirogue'
  | 'ile' // îlot rocheux flottant
  | 'earth' // bloc de terre sans bordure
  | 'none'; // collision seule (intérieurs peints)

export interface SolidDef {
  /** Bord gauche. */
  x: number;
  /** Surface sur laquelle on marche. */
  y: number;
  w: number;
  /** Épaisseur de la collision. */
  h: number;
  style: SolidStyle;
  oneWay?: boolean;
  flip?: boolean;
  /** Identifiant pour les scripts (plateformes qui apparaissent, portes). */
  id?: string;
  /** Absent au départ : apparaît quand un script l'active. */
  hidden?: boolean;
  /** Dessine un bloc de terre sous la plateforme jusqu'à cette profondeur. */
  fillTo?: number;
}

export interface MoverDef extends SolidDef {
  /** Déplacement aller-retour. */
  dx: number;
  dy: number;
  /** Durée d'un aller-retour complet, en secondes. */
  period: number;
  phase?: number;
}

export interface ClimbDef {
  x: number;
  y0: number;
  y1: number;
  style: 'liane' | 'echelle' | 'none';
}

export interface HangDef {
  x0: number;
  x1: number;
  y: number;
}

export interface WaterDef {
  x0: number;
  x1: number;
  /** Niveau de la surface. */
  y: number;
  /** Eau déjà peinte dans le décor (intérieurs) : la chute est détectée mais rien n'est dessiné. */
  hidden?: boolean;
}

export interface DecorDef {
  img: string;
  x: number;
  /** Base du décor (ou centre si `center`). */
  y: number;
  /** Hauteur en unités. */
  h: number;
  /** Profondeur : négatif = derrière le plan de jeu, positif = devant. */
  z?: number;
  flip?: boolean;
  opacity?: number;
  center?: boolean;
  tint?: number;
  /** Halo lumineux ajouté au décor (lanternes). */
  glow?: { color: number; size: number; dy?: number };
  /** Léger balancement. */
  sway?: number;
  /** Décor animé qui traverse le ciel (oiseaux). */
  fly?: { speed: number; range: number; bob?: number };
}

export type ItemKind =
  | 'coin' | 'banana' | 'bunch' | 'stone' | 'pile' | 'heart' | 'gem' | 'feather' | 'key' | 'shield' | 'gourd' | 'quest';

export interface ItemDef {
  kind: ItemKind;
  x: number;
  y: number;
  /** Identifiant des objets uniques (mémorisés dans la sauvegarde). */
  id?: string;
  /** Pour les objets de quête : image et nom du drapeau à incrémenter. */
  img?: string;
  flag?: string;
  /** Teinte (gemmes de couleurs différentes). */
  tint?: number;
  /** Message affiché au ramassage ; {n} est remplacé par la valeur du drapeau. */
  toast?: string;
}

export interface ChestDef {
  id: string;
  x: number;
  y: number;
  /** Nécessite une petite clé trouvée dans le niveau. */
  locked?: boolean;
  loot: Partial<Record<'coins' | 'gem' | 'heart' | 'bananas' | 'stones' | 'feather' | 'key', number>>;
  /** Script exécuté à l'ouverture (coffre final). */
  onOpen?: (g: Game) => void | Promise<void>;
}

export type EnemyKind = 'singe' | 'serpent' | 'croc' | 'hyene' | 'phaco';

export interface EnemyDef {
  kind: EnemyKind;
  x: number;
  y: number;
  /** Zone de déplacement (patrouille, poursuite, nage). */
  x0?: number;
  x1?: number;
  /** Projectile lancé par les singes. */
  ammo?: 'banana' | 'stone' | 'mix';
  facing?: 1 | -1;
  id?: string;
}

export interface NpcDef {
  id: string;
  /** Clé de CHARACTERS (personnage affiché). */
  char: string;
  x: number;
  y: number;
  facing?: 1 | -1;
  pose?: string;
  /** Profondeur d'affichage (derrière le héros par défaut). */
  z?: number;
  /** Clé de traduction du nom affiché. */
  name?: string;
  /** Script joué quand le joueur parle au personnage. */
  talk?: (g: Game) => void | Promise<void>;
  /** Personnage invisible : zone d'interaction posée sur un personnage peint dans le décor. */
  ghost?: boolean;
  /** Largeur de la zone d'interaction. */
  reach?: number;
  /** Hauteur de la bulle d'invite au-dessus des pieds (personnages peints). */
  promptY?: number;
  /** Présent seulement si la condition est vraie. */
  when?: (g: Game) => boolean;
  /** Clé de traduction de l'invite (par défaut « Parler »). */
  prompt?: string;
  /** Courte échelle : vitesse verticale donnée au héros par ce personnage (utilisée aussi par les tests). */
  boost?: number;
  /** Se promène entre ces deux abscisses (s'arrête et se tourne vers le héros quand il approche). */
  wander?: [number, number];
  /** Bavarde avec ses voisins : hochements et petits gestes. */
  chat?: boolean;
}

/** Habitant qui se promène à l'arrière-plan, sans interaction (vie du village). */
export interface WalkerDef {
  char: string;
  x0: number;
  x1: number;
  y?: number;
  /** Profondeur : légèrement derrière le plan de jeu (négatif). */
  z?: number;
  speed?: number;
}

export interface DoorDef {
  id: string;
  x: number;
  y: number;
  /** Identifiant de l'intérieur à ouvrir, ou 'exit' pour la sortie d'un intérieur. */
  to: string;
  label: string;
  /** Affiche une case devant la porte. */
  hut?: boolean;
  flip?: boolean;
  /** Condition d'ouverture ; sinon `lockedText` est affiché. */
  canOpen?: (g: Game) => boolean;
  lockedText?: string;
  onEnter?: (g: Game) => void | Promise<void>;
}

export interface TriggerDef {
  id: string;
  x0: number;
  x1: number;
  y0?: number;
  y1?: number;
  /** Rejoué à chaque passage si faux. */
  once?: boolean;
  run: (g: Game, stage: Stage) => void | Promise<void>;
}

export interface TargetDef {
  id: string;
  x: number;
  y: number;
  /** Symbole dessiné sur la cible (énigme du temple). */
  symbol?: 'soleil' | 'eau' | 'baobab';
  size?: number;
}

export interface SignDef {
  x: number;
  y: number;
  /** Clé de traduction de l'aide affichée quand le joueur passe devant. */
  text: string;
  /** Actions dont les touches sont affichées avec l'aide. */
  keys?: string[];
}

export interface ThemeDef {
  backdrop: string;
  /** Teinte multipliée sur l'arrière-plan (nuit, crépuscule). */
  tint?: number;
  /** Partie du tableau visible : 0 = bas, 1 = haut. */
  alignLow?: number;
  alignHigh?: number;
  sky: number;
  /** Couleur de la terre sous les sols. */
  earth: number;
  water: { shallow: number; deep: number; glint: number };
  music: MusicTheme;
  ambience: Ambience[];
  /** Altitude à laquelle le ciel recouvre entièrement le paysage (niveaux en hauteur). */
  skyAt?: number;
  /** Lucioles et ambiance de nuit. */
  night?: boolean;
  /** Teinte appliquée aux personnages et décors proches (nuit). */
  light?: number;
}

export interface LevelDef {
  id: string;
  /** Numéro affiché (1 à 7) ; 0 pour les intérieurs. */
  number: number;
  name: string;
  kind: 'level' | 'room';
  theme: ThemeDef;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  spawn: { x: number; y: number };
  /** Hauteur visible du plan de jeu. */
  viewH: number;
  /** Physique réduite des intérieurs (marche lente, petit saut). */
  indoor?: boolean;
  /** Image peinte servant de décor fixe (intérieurs) : placée exactement dans les limites. */
  painting?: string;
  solids: SolidDef[];
  movers: MoverDef[];
  climbs: ClimbDef[];
  hangs: HangDef[];
  waters: WaterDef[];
  decor: DecorDef[];
  items: ItemDef[];
  chests: ChestDef[];
  enemies: EnemyDef[];
  npcs: NpcDef[];
  doors: DoorDef[];
  checkpoints: { x: number; y: number }[];
  triggers: TriggerDef[];
  targets: TargetDef[];
  signs: SignDef[];
  /** Cascades animées : x, y = centre haut. */
  falls: { x: number; y: number; w: number; h: number; z?: number; opacity?: number }[];
  /** Habitants qui se promènent à l'arrière-plan. */
  walkers: WalkerDef[];
  /** Grands troncs d'arbre dessinés derrière le plan de jeu (niveau des arbres). */
  trunks: { x: number; w: number; y0: number; y1: number }[];
  /** Position de la sortie du niveau. */
  exit?: { x: number; y: number; canLeave?: (g: Game) => boolean; lockedText?: string };
  /** La jeune amie accompagne le héros dans ce niveau à partir de ce point. */
  companion?: { x: number; y: number; when?: (g: Game) => boolean };
  /** Script appelé une fois le niveau construit (énigmes, mises en scène). */
  setup?: (g: Game, stage: Stage) => void;
  /** Script appelé à chaque pas de simulation. */
  tick?: (g: Game, stage: Stage, dt: number) => void;
  /** Mission principale affichée pendant ce niveau. */
  objective?: (g: Game) => string;
}
