# Fabrication des images du jeu

`build.py` produit toutes les images de `public/assets/` à partir du pack de référence
`Taro_Pack_Complet_Jeu_Aventure_Africaine.zip` (extrait automatiquement dans `.cache/pack/`).
Il n’est nécessaire que pour **refaire ou modifier** les images : le jeu fonctionne avec celles
déjà présentes dans le dépôt.

## Installation

Python 3.10 ou plus récent :

```bash
python3 -m venv .venv
```

```bash
.venv/bin/pip install onnxruntime opencv-python-headless pillow numpy
```

Deux modèles ONNX (sous licence Apache 2.0), à placer dans un dossier de votre choix, par exemple
`~/modeles-ousmane/` :

| Fichier | Rôle | Source |
|---|---|---|
| `sam_vit_l_0b3195.encoder.onnx`, `sam_vit_l_0b3195.decoder.onnx` | segmentation (Segment Anything, Meta) | https://github.com/danielgatis/rembg/releases/tag/v0.0.0 |
| `lama.onnx` | retouche des zones effacées (LaMa) | `inpainting_lama_2025jan.onnx` de https://github.com/opencv/opencv_zoo/tree/main/models/inpainting_lama, renommé `lama.onnx` |

## Utilisation

Tout refaire :

```bash
.venv/bin/python tools/assets/build.py --models ~/modeles-ousmane
```

Une seule étape, quelques images, avec des planches de contrôle :

```bash
.venv/bin/python tools/assets/build.py --models ~/modeles-ousmane --only cutouts --names npc/conteuse,props/case --preview /tmp/apercus
```

Étapes (`--only`) :

| Étape | Fichier de réglages | Ce qu’elle fait |
|---|---|---|
| `sheets` | `jobs/sheets.json` | découpe les planches à fond transparent (cadres en pixels de la planche) |
| `cutouts` | `jobs/cutouts.json` | détoure les personnages et décors peints dans les scènes, à partir de points « à garder » (`pos`) et « à exclure » (`neg`) et d’un cadre (`box`) |
| `backdrops` | `jobs/backdrops.json` | efface le héros, les ennemis et les objets peints dans les scènes (`remove`, `rects`) puis reconstruit le fond |
| `extras` | `jobs/backdrops.json` | textures et feuillages complémentaires (vides actuellement) |

Dans `cutouts.json` et `backdrops.json`, les coordonnées sont données dans un aperçu de la scène ;
`scale` les convertit en pixels de l’image d’origine (1,1943 pour un aperçu de 1400 pixels de large).

Chaque exécution réécrit `public/assets/manifest.json` (dimensions des images et position des pieds
des personnages), lu par le jeu au démarrage.
