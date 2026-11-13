# Les aventures d’Ousmane — Le secret de la cascade

Jeu d’aventure et de plateformes jouable dans le navigateur (ordinateur, tablette, téléphone),
inspiré de l’Afrique de l’Ouest. Ousmane, un jeune garçon courageux et curieux, traverse son village,
grimpe au sommet du grand baobab, longe une rivière aux cascades, parcourt la savane avec son amie
Coumba, explore la mangrove et découvre un temple caché derrière une cascade.

> **Version jouable avec personnages provisoires.** Aucun modèle 3D n’était fourni : la plupart des
> personnages, les animaux et une partie des décors sont des **images découpées dans les planches de
> référence**, animées par le code. Seules **Tata Dieynaba et Tata Salimata** sont en 3D (GLB construits
> avec Blender à partir de leur image). Le code est prêt à remplacer le reste par de vrais modèles GLB
> sans modification (voir [docs/MODELES_3D.md](docs/MODELES_3D.md)).

## Lancer le jeu

Il faut [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
npm install
```

```bash
npm run dev
```

Ouvrir ensuite l’adresse affichée (par défaut http://localhost:5173). Sur un téléphone du même réseau,
utiliser l’adresse « Network » affichée par Vite.

Version de production (fichiers statiques dans `dist/`, à déposer sur n’importe quel hébergement web) :

```bash
npm run build
```

```bash
npm run preview
```

Version à publier sous forme de lien claude.ai (Three.js chargé depuis le CDN jsDelivr, police
depuis Google Fonts, page d’entrée sans en-tête HTML) dans `dist-lien/` :

```bash
npm run build:lien
```

Studio des mouvements (page pour régler et montrer comment chaque personnage bouge) : en développement,
ouvrir http://localhost:5173/studio.html ; version à publier en lien dans `dist-studio/` :

```bash
npm run build:studio
```

Raccourcis utiles pendant le développement :

- `?niveau=4` : démarre directement au niveau 4 ;
- `?modeles=autre.json` : essaie un autre catalogue de modèles 3D (voir docs/MODELES_3D.md).

## Commandes

| Action | Clavier (positions QWERTY / AZERTY) | Tactile | Manette |
|---|---|---|---|
| Se déplacer | ← → ou A / D (Q / D en AZERTY) | croix à gauche | stick, croix |
| Grimper, descendre, viser en l’air | ↑ ↓ ou W / S (Z / S en AZERTY) | croix (haut / bas) | stick, croix |
| Sauter (maintenir pour sauter plus haut) | Espace | bouton bleu | A |
| S’accroupir / esquiver | ↓ | croix (bas) | stick vers le bas |
| Interagir (parler, entrer, ouvrir) | E ou Entrée | bouton ✋ (apparaît près d’une cible) | Y |
| Se défendre (repousse, renvoie les projectiles) | K ou C | bouton « Défense » | B |
| Lancer l’objet équipé | J ou X | bouton « Lancer » | X |
| Changer d’objet (banane, pierre, lance-pierre) | L ou R | bouton ⇄ ou les cases d’objets | gâchettes hautes |
| Pause | Échap ou P | bouton ❚❚ | Start |

Les touches sont repérées par leur **position** sur le clavier : elles tombent au même endroit en
AZERTY et en QWERTY, et l’affichage s’adapte à la disposition détectée (réglable). Toutes les
touches se **réaffectent** dans les paramètres. Un tutoriel s’affiche au fil du niveau 1 (parchemins).

## Ce que contient le jeu

- **7 niveaux jouables** et **4 intérieurs** :
  1. *Le village du départ* — tutoriel, habitants, marché, case familiale et case de la conteuse, qui confie la carte ancienne.
  2. *Les arbres et les singes* — ascension verticale du grand baobab : lianes, branches où l’on se suspend, singes lanceurs, serpents ; la case du vieux Demba (le vieux sage) tout en haut, qui remet la clé.
  3. *La rivière aux cascades* — ponts, pierres de gué, pirogues, crocodiles ; indice gravé près de la grande cascade et coffre caché derrière le rideau d’eau.
  4. *La savane* — Coumba confie son lance-pierre et accompagne Ousmane (elle aide en lançant des pierres) ; hyènes qui poursuivent, phacochères qui chargent, courte échelle pour gravir la falaise.
  5. *La mangrove* — racines, plateformes sur pilotis, pirogues et plateforme mobile ; trois jarres cachées sur les chemins écartés pour obtenir le dernier indice.
  6. *La grotte et le temple secret* — de nuit, jusqu’à la porte derrière la cascade ; énigme des trois signes à réveiller au lance-pierre dans l’ordre des indices ; coffre final.
  7. *Retour au village* — révélation de la découverte, fête avec musiciens et danseurs, ouverture vers un chapitre 2.
- **Histoire et missions** : mission principale suivie à l’écran, missions secondaires (ballon perché, beignets de Tata Mariam, petit singe gourmand, jarres de Penda), carnet de missions et indices dans le menu pause.
- **Héros** : marche et course, saut à hauteur variable, accroupissement, escalade, suspension aux branches, lancer de banane, lancer de pierre, visée et tir au lance-pierre (avec aide à la visée), défense, réaction aux coups, dialogue.
- **Animaux** : singes (lancent bananes ou pierres ; une banane les apprivoise), serpents (se dressent puis frappent), crocodiles (bondissent hors de l’eau), hyènes (poursuivent sur une distance), phacochères (grattent le sol puis chargent). Chaque attaque est annoncée (point d’exclamation, pose, son). Aucun sang : les animaux sont repoussés, étourdis, apprivoisés ou s’enfuient. Oiseaux, grue couronnée et singe ami animent le décor.
- **Objets** : pièces, bananes, pierres, cœurs, gourde, plumes de grue (rattrapent une chute), pierres précieuses, bouclier, petites clés et coffres, objets de quête. Trois cœurs au départ, un de plus en aidant la cuisinière.
- **Points de sauvegarde** (lanternes) : après une chute ou une défaite, retour au dernier point allumé.
- **Sauvegarde locale** automatique de la progression et des paramètres (« Continuer » sur l’écran d’accueil).
- **Interface** : accueil (Jouer, Continuer, Niveaux, Paramètres), affichage du héros, des cœurs, des pièces, du score, de l’objet équipé et des munitions, du niveau et de la mission ; pause ; paramètres (langue, musique et effets séparés avec volume, commandes tactiles, disposition du clavier, touches) ; écrans de fin de niveau et de fin d’aventure.
- **Langues** : français et anglais ; le pulaar est prévu (fichier `src/i18n/ff.ts`) sans traduction inventée.
- **Tata Dieynaba et Tata Salimata sont en 3D** : modèles GLB construits avec Blender à partir de leurs
  images de référence (`tools/blender/personnages3d.py`, voir [docs/MODELES_3D.md](docs/MODELES_3D.md)) :
  squelette, sandales qui touchent le sol, six animations (repos, marche, course, parole, écoute, danse).
  Les autres habitants et les animaux restent des images animées, décrites ci-dessous.
- **Mouvements** : faute de vraies animations, chaque image est posée sur une grille souple que le
  processeur graphique déforme par zones (`src/render/motion.ts`). Les pieds restent plantés au sol ;
  les jambes ou la robe se balancent en ciseaux, le corps rebondit au-dessus des genoux, les hanches,
  les épaules et la tête bougent, les mains gesticulent. Les habitants bavardent chacun leur tour, les
  enfants courent, les musiciens jouent, la grand-mère applaudit, la cuisinière remue sa marmite.
  Les zones du corps (genoux, jambes, mains) et les réglages de chaque personnage sont dans
  `src/game/characterDefs.ts` ; le **studio des mouvements** permet de les régler à l'œil et d'envoyer
  le résultat (il est rangé dans la base de données de la page, que Claude relit).
- **Sons** : musiques originales et bruitages **entièrement synthétisés** par le code (balafon, kora, djembé, cloche…), ambiances (eau, cascade, oiseaux, vent, village, nuit, grotte, fête). Aucun fichier sonore externe.

## Organisation du code

```
src/
  App.ts               démarrage, boucle de jeu à pas fixe, pause, menus
  core/                entrées (clavier, tactile, manette), sauvegarde, sons, chargement des images
  render/              rendu Three.js : caméra de côté, décors, eau, cascades, personnages (images ou GLB)
  game/
    Game.ts            partie : niveaux, intérieurs, inventaire, missions, dialogues, sauvegarde
    Stage.ts           un niveau en cours : construction, collisions, caméra, interactions
    Player.ts          le héros            tuning.ts   réglages des sauts et déplacements
    enemies.ts         les animaux         entities.ts objets, coffres, habitants, portes, cibles, Coumba
    physics.ts         physique des plateformes (sans rendu, testée seule)
    characterDefs.ts   personnages et leurs poses     story.ts   interlocuteurs et missions
    levels/            un fichier par niveau + builder.ts (outil de construction)
  i18n/                fr.ts, en.ts, ff.ts (pulaar, vide)
  ui/Ui.ts             affichage en jeu, dialogues, menus, commandes tactiles
public/assets/         images du jeu (WebP) + manifest.json + models/ (modèles 3D à venir)
tools/assets/          fabrication des images à partir du pack de référence
tools/blender/         génération des personnages 3D (Blender, module bpy) : personnages3d.py
tests/                 tests unitaires (Vitest) et de bout en bout (Playwright)
```

**Ajouter un chapitre** : écrire un fichier dans `src/game/levels/` sur le modèle des existants
(`LevelBuilder` : `ground`, `plat`, `branch`, `liane`, `water`, `mover`, `enemy`, `npc`, `chest`,
`checkpoint`, `exit`…), ajouter ses textes dans `fr.ts` et `en.ts`, puis l’inscrire dans
`src/game/levels/index.ts`. Le test d’accessibilité vérifie aussitôt qu’il peut être terminé.

## Tests

```bash
npm test
```

Tests unitaires : physique, sauvegarde, traductions (toutes les clés existent en français et en
anglais), et **accessibilité de chaque niveau** : un explorateur rejoue la vraie physique du jeu
(marche, sauts, lianes, branches, plateformes mobiles, courte échelle) et vérifie que la sortie,
les portes, les habitants, les coffres, les points de sauvegarde, les objets de quête et toutes les
pièces sont atteignables ; il vérifie aussi que le coffre du temple exige de résoudre l’énigme.

```bash
npm run test:e2e
```

27 scénarios dans un vrai navigateur : accueil, paramètres (langue, réaffectation d’une touche),
déplacement, saut, accroupissement, dialogue, entrée et sortie d’une case, lancer, changement
d’objet, point de sauvegarde, chute dans l’eau, défense, blessure, défaite et retour au point de sauvegarde, combat, fin de niveau, escalade,
suspension, singe apprivoisé, pause, sauvegarde et « Continuer », énigme du temple, modèle GLB qui
remplace le héros provisoire, ressource manquante, et commandes tactiles sur téléphone (visibles,
sans cacher le héros, croix, saut, interaction). Playwright n’est pas une dépendance du projet :
`npm i -D playwright && npx playwright install chromium` si besoin.

```bash
npm run typecheck
```

## Ressources et licences

- Images : toutes proviennent du pack de référence fourni (`Taro_Pack_Complet_Jeu_Aventure_Africaine.zip`),
  découpées et nettoyées par `tools/assets/build.py` (voir [tools/assets/README.md](tools/assets/README.md)
  et l’inventaire [docs/RESSOURCES.md](docs/RESSOURCES.md)).
- Sons et musiques : synthétisés par le code, aucun échantillon externe.
- Police : Baloo 2 (SIL Open Font License), via `@fontsource/baloo-2`.
- Bibliothèques : Three.js (MIT), Vite, TypeScript, Vitest.
