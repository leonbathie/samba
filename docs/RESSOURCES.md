# Inventaire des ressources

Le dépôt contenait un seul fichier : `Taro_Pack_Complet_Jeu_Aventure_Africaine.zip`, soit
**25 images PNG de conception** (aucun modèle 3D, aucune animation, aucun son). Son `LISEZ_MOI.txt`
le précise : « les éléments des planches doivent être découpés et les animations complétées ».

Ces images ont été utilisées de trois façons, toutes reproductibles avec `tools/assets/build.py` :

1. **Planches à fond transparent** → découpe directe des personnages, animaux, plateformes et objets.
2. **Scènes composées** → détourage des habitants et décors qui n’existent que dans les scènes
   (conteuse, Coumba, musiciens, case, baobab…), grâce à un modèle de segmentation local.
3. **Scènes composées** → arrière-plans et intérieurs **nettoyés** : le héros, les ennemis et les
   objets peints y sont effacés et reconstruits (segmentation + retouche automatique), pour que les
   éléments jouables soient de vrais objets séparés.

Le jeu contient 101 images WebP (≈ 7 Mo), listées dans `public/assets/manifest.json`.

## Par personnage

| Personnage | Source | Dans le jeu |
|---|---|---|
| Ousmane | `03_…/01_Heros_positions.png` (8 poses) et `02_Heros_poses_action.png` (8 poses) | 14 poses découpées + l’escalade et la suspension (détourées, branche retirée) + une pose « parler » tirée de `02_Interieur_de_case.png` |
| Coumba, la jeune amie | `01_…/07_Savane_avec_une_amie.png`, `11_NOUVEAU_Falaises_de_la_savane.png` | pose debout et pose de course |
| Mame Awa, la conteuse | `02_…/05_NOUVEAU_La_conteuse_et_la_carte.png` | personnage + intérieur de sa case |
| Le vieux Demba (le vieux sorcier du pack, présenté comme un sage) | `02_…/03_Le_vieux_sorcier.png`, `04_Villageois_et_animaux.png` | intérieur de sa case + personnage pour la fête |
| Femmes du village (bleue, rose, verte), enfants qui jouent, cuisinière | `02_…/01_Place_du_village.png` | habitants du niveau 1 et de la fête |
| Marchande, artisan sculpteur, enfants assis | `02_…/04_NOUVEAU_Marche_du_village.png` | étal de fruits, artisan, enfants |
| Musiciens (djembé, kora), danseurs, grand-mère, porteuse de fruits | `02_…/06_NOUVEAU_Fete_du_village.png` | fête du niveau 7 |
| Femme aux fruits, femme en kente, explorateurs Aïda et Moussa | `03_…/04_Villageois_et_animaux.png` | Penda la pêcheuse, habitants |

## Animaux

| Animal | Source | Dans le jeu |
|---|---|---|
| Singe (3 poses), serpent (2), crocodile, phacochère, hyène | `03_…/03_Animaux_ennemis.png` | ennemis |
| Hyène (2ᵉ pose), singe ami, grue couronnée | `03_…/04_Villageois_et_animaux.png` | hyène qui ricane, singe gourmand, grue |
| Crocodile qui nage, oiseau, grue en vol | scènes de la mangrove et de la rivière | crocodile dans l’eau, oiseaux du décor |

## Environnements et niveaux

| Image | Utilisation |
|---|---|
| `04_…/01_Decor_baobabs_et_village.png` | arrière-plan du village (niveaux 1, 2, 7) et écran d’accueil |
| `01_…/02_Village_depart.png` | référence du niveau 1 ; case détourée |
| `01_…/03_Ascension_baobab.png`, `10_NOUVEAU_Arbre_aux_lianes.png`, `06_Lance_pierre_dans_les_arbres.png` | références du niveau 2 (lianes, branches, singes) |
| `01_…/08_Lancer_de_pierre_riviere.png`, `01_Riviere_et_cascades.png` | arrière-plan nettoyé du niveau 3 ; baobab, pierre de gué, nénuphars |
| `01_…/11_NOUVEAU_Falaises_de_la_savane.png`, `07_Savane_avec_une_amie.png` | arrière-plan nettoyé du niveau 4 ; îlot rocheux, acacia |
| `01_…/09_NOUVEAU_Mangrove_et_crocodile.png` | arrière-plan nettoyé du niveau 5 ; pilotis, pirogue, racines |
| `01_…/04_Grotte_mysterieuse.png` | arrière-plan nettoyé du niveau 6 ; entrée de la grotte |
| `01_…/12_NOUVEAU_Temple_secret_cascade.png` | intérieur du temple (nettoyé) ; cible, cristaux |
| `02_…/02_Interieur_de_case.png`, `03_Le_vieux_sorcier.png`, `05_NOUVEAU_La_conteuse_et_la_carte.png` | intérieurs des trois cases (le héros peint y est effacé) |
| `01_…/05_Lancer_de_banane.png` | référence des lancers et du pont de corde |

## Objets

`04_…/02_Plateformes_et_elements.png` : sol de pierre, branche, pont de corde, dalle à motifs,
rocher, buisson fleuri, jarre, liane, touffes de feuilles.

`04_…/03_Objets_bonus_et_projectiles.png` : pièce, clé, pierre précieuse, cœur, coffre, banane et
pierre (en vol et seules), gourde, bouclier, plume, parchemin, lanterne.

## Éléments créés par le code

- Eau animée, cascades, rayons de lumière, lucioles, étincelles, poussière, nuages, écorce des grands
  troncs, terre sous les sols, voile de ciel en altitude, cibles à symboles du temple, échelles.
- Interface (bois, or, motifs géométriques) dessinée en CSS.
- Musiques, ambiances et bruitages : synthèse sonore dans le navigateur.

## Ce qui est provisoire

- **Tous les personnages et animaux** : images plates découpées dans les planches, animées par
  déformation (respiration, course, balancement). Chaque personnage n’a que les poses dessinées
  dans le pack (Ousmane en a 17) ; il n’y a pas d’animation image par image.
- **Les habitants des intérieurs** (Maman, Tante Dado, Mame Awa, le vieux Demba) font partie des
  tableaux peints : ils ne bougent pas.
- **Les décors** : plateformes et accessoires sont des images posées dans la scène 3D (effet de
  profondeur par la caméra en perspective), pas des modèles 3D.
- Les **ennemis** n’ont qu’une à trois poses chacun.

## Modèles 3D et animations qui restent à créer

| Élément | À créer |
|---|---|
| Ousmane | modèle texturé et articulé, fidèle aux planches (peau foncée, cheveux noirs bouclés, bonnet à motifs, tunique claire à bordures bleues et orange, longue écharpe jaune, sacoche en cuir, pantalon beige, baskets foncées), et ses 18 animations (liste dans `MODELES_3D.md`) |
| Coumba | modèle + 4 animations |
| 5 animaux ennemis | modèles + 5 à 6 animations chacun |
| ~23 habitants | modèles + attente et danse |
| Intérieurs | 3 cases et le temple en 3D (ou tableaux repeints sans personnages) |
| Décors | baobabs, acacias, cases, plateformes, pirogues… (facultatif : les images actuelles fonctionnent) |
