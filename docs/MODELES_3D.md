# Intégrer les modèles 3D (GLB)

Aujourd’hui, chaque personnage est affiché par une **représentation provisoire** : une image
découpée dans les planches de référence, animée par le code (respiration, balancement, course,
étirement). Le jeu ne manipule que des **noms de poses** (`idle`, `run`, `jump`…) : dès qu’un vrai
modèle 3D est déclaré pour un personnage, il remplace automatiquement l’image, avec ses animations,
sans toucher au code du jeu.

## 0. Déjà en 3D : Tata Dieynaba et Tata Salimata

Les deux villageoises `femme_bleue` (Tata Dieynaba) et `femme_rose` (Tata Salimata) ne sont plus des
images : elles sont générées par `tools/blender/personnages3d.py` et déclarées dans
`public/assets/models/models.json`. Le script les construit à partir de leurs images de référence :

- le corps, la tête, la robe et les bras sont des **volumes** dont la silhouette est celle de l’image ;
  l’image est projetée sur la face qui regarde la caméra, donc le repos reproduit le dessin (recouvrement
  des silhouettes d’environ 98 %) ;
- les **pieds** (sandales et chevilles) sont ajoutés sous l’ourlet, que l’image ne montre pas ;
- un **squelette** de 17 os commande l’ensemble ; les jambes sont résolues en cinématique inverse, si
  bien que les pieds restent posés pendant l’appui ;
- six animations sont cuites image par image : `idle`, `walk`, `run`, `talk`, `listen`, `dance` ;
- l’export produit un fichier GLB par personnage (environ 0,75 Mo chacun).

Pour régénérer les fichiers (il faut le module Python `bpy` de Blender, testé avec la version 5.2 LTS) :

```bash
pip install "bpy==5.2.4"
python tools/blender/personnages3d.py --personnage tous --sortie public/assets/models
```

Contrôle visuel sans écrire les fichiers : `--apercu DOSSIER` produit la superposition de la silhouette
sur l’image, une planche des animations (rendu, hauteur des semelles à chaque instant clé).

Les positions (colonnes et lignes des épaules, des coudes, des poignets, des chevilles) sont relevées
dans le haut du fichier, `PERSONNAGES`. Pour une nouvelle villageoise, relever ces points sur son image,
ajouter une entrée, puis lancer le script. Le catalogue accepte deux options utiles :

- `"centrer": false` : l’origine du fichier est déjà au milieu des pieds (c’est le cas ici) ;
- `"retournement": "miroir"` : pour regarder à gauche, le personnage est retourné comme l’image
  (sans montrer son autre côté, qui n’est pas dessiné). Le défaut `"pivot"` tourne le modèle sur lui-même.

Limites honnêtes : ce sont des volumes construits à partir d’un dessin, pas des sculptures d’artiste.
Le côté visible reprend le dessin ; le dos et les côtés sont une extrapolation. Un modèle sculpté à la main
(ou généré par une image vers 3D) donnera un meilleur résultat et se déposera au même endroit.

## 1. Préparer le modèle dans Blender

- Un fichier par personnage, personnage **seul** dans la scène (avec son armature).
- Le personnage regarde vers l’avant de Blender (axe −Y, vue « Front »), les pieds à l’origine.
- Échelle réelle conseillée : Ousmane mesure environ 1,6 m de haut dans le jeu (la taille est de
  toute façon ajustée automatiquement, voir `height` plus bas).
- Une **action** (Action Editor / NLA) par animation, nommée clairement : `Idle`, `Run`, `Jump`…
- Textures intégrées (images dans le fichier) ; matériaux « Principled BSDF ».
- Rester raisonnable pour le téléphone : 15 000 à 30 000 triangles par personnage, textures 1024 ou
  2048 pixels, une soixantaine d’os.

Export : *Fichier → Exporter → glTF 2.0*

- Format : **glTF Binaire (.glb)** ;
- Inclure : objets sélectionnés ; Transformation : **+Y en haut** ;
- Maillage : appliquer les modificateurs ; Animation : exporter les actions (mode « Actions »),
  « Toujours échantillonner les animations » coché.

## 2. Déposer le fichier et le déclarer

Copier le fichier dans `public/assets/models/`, puis le déclarer dans
`public/assets/models/models.json` :

```json
{
  "characters": {
    "hero": {
      "file": "ousmane.glb",
      "height": 1.6,
      "yaw": 90,
      "offsetY": 0,
      "animations": {
        "idle": "Idle",
        "run": "Run",
        "jump": "Jump",
        "fall": "Fall",
        "land": "Land",
        "crouch": "Crouch",
        "climb": "Climb",
        "hang": "Hang",
        "bananaWind": "ThrowWindup",
        "stoneWind": "ThrowWindup",
        "throw": "Throw",
        "stoneThrow": "Throw",
        "slingAim": "SlingAim",
        "slingFire": "SlingFire",
        "guard": "Guard",
        "hurt": "Hurt",
        "talk": "Talk",
        "cheer": "Cheer"
      }
    }
  }
}
```

| Champ | Rôle |
|---|---|
| `file` | nom du fichier dans `public/assets/models/` |
| `height` | hauteur voulue dans le jeu (unités du monde ≈ mètres) : le modèle est mis à l’échelle automatiquement |
| `yaw` | rotation (degrés) pour que le modèle regarde vers la droite de l’écran ; 90 pour un export Blender standard |
| `offsetY` | décalage vertical éventuel (pieds qui flottent ou s’enfoncent) |
| `animations` | correspondance *pose du jeu → nom de l’action dans le GLB*. Une pose absente utilise `idle`. |

Pour essayer un modèle sans modifier le catalogue par défaut : créer par exemple
`public/assets/models/essai.json` et ouvrir le jeu avec `?modeles=essai.json`.

Si un fichier est absent ou illisible, le jeu l’écrit dans la console et **garde la représentation
provisoire** : rien ne se bloque. Le test `npm run test:e2e` contient un scénario qui fabrique un
petit GLB et vérifie qu’il remplace bien le héros.

## 3. Identifiants et poses attendus

### Héros — identifiant `hero`

| Pose | Utilisation dans le jeu |
|---|---|
| `idle` | attendre |
| `run` | marcher et courir (la vitesse varie) |
| `jump`, `fall`, `land` | sauter, retomber, réception |
| `crouch` | s’accroupir, esquiver |
| `climb` | grimper le long d’une liane ou d’une échelle |
| `hang` | suspendu à une branche (se déplace à la force des bras) |
| `bananaWind`, `throw` | préparer puis lancer une banane |
| `stoneWind`, `stoneThrow` | préparer puis lancer une pierre |
| `slingAim`, `slingFire` | viser puis tirer au lance-pierre |
| `guard` | se défendre (coup de bras qui repousse) |
| `hurt` | être touché |
| `talk` | parler (portrait des dialogues, intérieurs) |
| `cheer` | se réjouir (fête finale) |

### Jeune amie — identifiant `amie` (Coumba)

`idle`, `run`, `jump`, `cheer`.

### Animaux — identifiants `singe`, `serpent`, `crocodile`, `hyene`, `phacochere`

| Pose | Signification |
|---|---|
| `idle` | au repos |
| `move` | se déplace (nage pour le crocodile) |
| `warn` | annonce l’attaque (le singe brandit son projectile, le serpent se dresse, la hyène ricane, le phacochère gratte le sol, le crocodile s’agite) |
| `attack` | attaque (lancer, morsure, bond, poursuite, charge) |
| `stun` | étourdi |
| `happy` | singe apprivoisé |

### Habitants

`idle` et `dance` (fête finale) :
`conteuse`, `conteuse_fete`, `sorcier`, `femme_fruits`, `femme_kente`, `femme_bleue`, `femme_rose`,
`femme_verte`, `porteuse`, `cuisiniere`, `artisan`, `enfants_assis`, `enfant_garcon`, `enfant_fille`,
`fille_exploratrice`, `garcon_explorateur`, `musicien_djembe`, `musicien_kora`, `musicienne_djembe`,
`danseuse`, `danseur`, `singe_ami`, `grue`.

## 4. Ce qui restera à adapter

- **Intérieurs des cases et temple** : ce sont des tableaux peints dans lesquels certains habitants
  sont dessinés (Maman, Tante Dado, Mame Awa, le vieux Demba). Pour passer en 3D, il faudra modéliser
  ces pièces (ou repeindre les tableaux sans personnages) puis remplacer les « personnages fantômes »
  (`ghost: true` dans les niveaux) par de vrais habitants.
- **Décors** : plateformes, arbres, cases et objets sont des images découpées posées dans la scène 3D,
  à différentes profondeurs. Chaque élément peut être remplacé par un modèle de la même façon, en
  gardant les mêmes positions et collisions (définies dans `src/game/levels/`).
- **Lumière** : la scène contient déjà une lumière d’ambiance et un soleil pour les modèles 3D ;
  les niveaux de nuit (grotte, fête) teintent les personnages, à reprendre avec de vraies lumières.
