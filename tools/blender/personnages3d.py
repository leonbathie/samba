#!/usr/bin/env python3
"""Personnages 3D des villageoises (Tata Dieynaba = femme_bleue, Tata Salimata = femme_rose).

Construit avec Blender (module bpy), à partir des images de référence du jeu :

- le corps, la tête, la robe et les bras sont des volumes dont la silhouette est celle de
  l'image ; l'image elle-même est projetée sur la face qui regarde la caméra : au repos, le rendu
  reproduit le dessin, mais chaque partie est un vrai volume relié à un squelette ;
- les sandales et les chevilles sont ajoutées sous l'ourlet, que l'image ne montre pas ;
- un squelette commande l'ensemble ; les jambes sont résolues en cinématique inverse, si bien
  que les pieds restent posés au sol pendant l'appui ; les animations sont cuites image par image ;
- l'export produit un fichier GLB (squelette, peau, animations) lu par le jeu.

Usage (Python du module bpy, voir docs/MODELES_3D.md) :
  python tools/blender/personnages3d.py --personnage femme_bleue --sortie public/assets/models
  python tools/blender/personnages3d.py --personnage femme_bleue --apercu DOSSIER   (contrôle visuel)
"""

from __future__ import annotations

import argparse
import json
import math
import os
import struct
import sys
import tempfile

import numpy as np
from PIL import Image

try:
    import bpy  # doit précéder bmesh : c'est bpy qui charge ce module
    import bmesh
    from mathutils import Quaternion, Vector
except ImportError:  # pragma: no cover - ce fichier n'a de sens que dans Blender
    sys.exit("Ce script se lance avec le module bpy de Blender (voir docs/MODELES_3D.md).")

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FPS = 24
NSEG = 24  # points par anneau du corps
UP = Vector((0.0, 0.0, 1.0))
AX = Vector((1.0, 0.0, 0.0))  # axe des mouvements dans le plan de l'image (perpendiculaire à l'écran)

# Relevés sur les images (colonne, ligne) en pixels ; x = profondeur (négatif = vers la caméra).
PERSONNAGES = {
    "femme_bleue": {
        "image": "public/assets/npc/femme_bleue.webp",
        "hauteur": 1.85,
        "profil": True,
        "avant": (0.0, -1.0, 0.0),  # elle regarde vers la droite de l'image
        "bornes": [(86, 135, "droite", 112)],  # le bras tendu ne doit pas élargir le buste
        "hanche": 0.92,
        # profondeur : le pied visible est devant la paroi de l'ourlet (sinon il est caché dans la robe)
        "jambes": [{"nom": "g", "px": 70.0, "x": -0.24}, {"nom": "d", "px": 72.0, "x": -0.10}],
        "bras": [
            {"nom": "avant", "epaule": (78, 94), "coude": (90, 110), "poignet": (114, 97), "main": (126, 89), "x": -0.26},
            {"nom": "arriere", "epaule": (70, 100), "coude": (66, 116), "poignet": (92, 113), "main": (97, 112), "x": -0.22},
        ],
        "bras_principal": "avant",
        "peau": "#a4440f",
        "cuir": "#a8703a",
        "pas": 0.22,
        "levee": 0.05,
    },
    "femme_rose": {
        "image": "public/assets/npc/femme_rose.webp",
        "hauteur": 2.0,
        "profil": False,
        "avant": (-1.0, 0.0, 0.0),  # elle fait face à la caméra
        "bornes": [(96, 135, "gauche", 14), (96, 135, "droite", 90)],
        "hanche": 0.90,
        "jambes": [{"nom": "g", "px": 42.0, "x": -0.20}, {"nom": "d", "px": 68.0, "x": -0.20}],
        "bras": [
            {"nom": "gauche", "epaule": (22, 104), "coude": (12, 122), "poignet": (38, 118), "main": (42, 120), "x": -0.22},
            {"nom": "droite", "epaule": (84, 104), "coude": (86, 122), "poignet": (50, 120), "main": (44, 120), "x": -0.26},
        ],
        "bras_principal": "gauche",
        "peau": "#9a4516",
        "cuir": "#7a3a1e",
        "pas": 0.03,
        "levee": 0.04,
    },
}

ZONE_CHEVILLE = 0.09  # hauteur de la cheville au-dessus du sol (la semelle est à 0)
LONGUEUR_CUISSE = 0.46
ZHEM = 0.12  # ourlet de la robe : les chevilles et les sandales restent visibles dessous (l'image est remontée d'autant)
HAUTEUR_SANDALE = 0.065  # épaisseur des sandales au-dessus du sol
HAUTEUR_CHEVILLE_HAUT = 0.115  # haut de la cheville visible, sous l'ourlet


def srgb_lin(hex_couleur: str) -> tuple[float, float, float, float]:
    """Couleur sRGB (#rrggbb) vers espace linéaire, utilisé par Blender."""
    def f(v: float) -> float:
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (int(hex_couleur[i:i + 2], 16) for i in (1, 3, 5))
    return (f(r), f(g), f(b), 1.0)


class Repere:
    """Passe des pixels de l'image (bords de pixels) à l'espace Blender (mètres, Z vers le haut)."""

    def __init__(self, W: int, H: int, haut: float, zhem: float, bord_haut: float, bord_bas: float):
        self.W, self.H = W, H
        self.zhem = zhem
        self.bord_haut, self.bord_bas = bord_haut, bord_bas
        self.k = (haut - zhem) / (bord_bas - bord_haut)

    def y(self, colonne_bord: float) -> float:
        return -(colonne_bord - self.W / 2) * self.k

    def z(self, ligne_bord: float) -> float:
        return self.zhem + (self.bord_bas - ligne_bord) * self.k

    def ligne_de_z(self, z: float) -> float:
        return self.bord_bas - (z - self.zhem) / self.k

    def pos(self, colonne: float, ligne: float, x: float) -> Vector:
        """Point d'un centre de pixel (colonne, ligne) à la profondeur x."""
        return Vector((x, self.y(colonne + 0.5), self.z(ligne + 0.5)))

    def uv(self, p: Vector) -> tuple[float, float]:
        colonne = -p.y / self.k + self.W / 2
        ligne = self.ligne_de_z(p.z)
        return (colonne / self.W, 1.0 - ligne / self.H)


def silhouette(spec: dict, a: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Bords gauche et droit (en bords de pixels) de chaque ligne, bornés comme indiqué."""
    H = a.shape[0]
    m = a[:, :, 3] > 127
    g = np.full(H, np.nan)
    d = np.full(H, np.nan)
    for r in range(H):
        xs = np.flatnonzero(m[r])
        if xs.size:
            g[r] = xs[0]
            d[r] = xs[-1] + 1
    for r0, r1, cote, val in spec["bornes"]:
        for r in range(r0, min(r1, H)):
            if cote == "droite" and not np.isnan(d[r]):
                d[r] = min(d[r], val)
            if cote == "gauche" and not np.isnan(g[r]):
                g[r] = max(g[r], val)

    # pas de lissage : un filtre médian efface le col et l'ourlet, dont la largeur change vite
    return g, d


def remplir_bords(a: np.ndarray) -> np.ndarray:
    """Couleur des pixels transparents = couleur voisine : pas de liseré sombre au bord."""
    rgb = a[:, :, :3].astype(np.float32).copy()
    known = a[:, :, 3] > 127
    for _ in range(12):
        if known.all():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros(known.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            sk = np.roll(np.roll(known, dy, 0), dx, 1)
            sr = np.roll(np.roll(rgb, dy, 0), dx, 1)
            acc += sr * sk[..., None]
            cnt += sk
        new = (~known) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]
        known = known | new
    return np.dstack([rgb, a[:, :, 3].astype(np.float32)]).clip(0, 255).astype(np.uint8)


def texture_png(spec: dict, a: np.ndarray, dossier: str) -> str:
    """Image projetée : 2× (lissage), canal alpha conservé pour découper la silhouette."""
    im = Image.fromarray(remplir_bords(a))
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    chemin = os.path.join(dossier, "texture_%s.png" % spec["nom"])
    im.save(chemin)
    return chemin


def facteur_profondeur(z_rel: float) -> float:
    """Demi-profondeur (lateral) / demi-largeur, selon la hauteur relative du corps (0 = sol, 1 = tête)."""
    pts = [(0.07, 0.80), (0.32, 0.70), (0.54, 0.62), (0.70, 0.56), (0.77, 0.50), (0.82, 0.78), (1.0, 0.95)]
    return float(np.interp(z_rel, [p[0] for p in pts], [p[1] for p in pts]))


# ----------------------------------------------------------------------------- géométrie

def materiau_image(nom: str, chemin: str) -> bpy.types.Material:
    mat = bpy.data.materials.new(nom)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(chemin)
    tex.image.colorspace_settings.name = "sRGB"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.7
    mat.blend_method = "CLIP"  # découpe nette de la silhouette (exportée en MASK)
    mat.alpha_threshold = 0.5
    return mat


def materiau_plein(nom: str, hex_couleur: str, rugosite: float = 0.6) -> bpy.types.Material:
    mat = bpy.data.materials.new(nom)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = srgb_lin(hex_couleur)
    bsdf.inputs["Roughness"].default_value = rugosite
    return mat


def anneau_points(bm, centre: Vector, axe_u: Vector, axe_v: Vector, rayon_u: float, rayon_v: float, n: int) -> list:
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        p = centre + axe_u * (rayon_u * math.cos(t)) + axe_v * (rayon_v * math.sin(t))
        pts.append(bm.verts.new(p))
    return pts


def relier(bm, a: list, b: list, mat: int) -> None:
    n = len(a)
    for i in range(n):
        f = bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
        f.material_index = mat


def tube(bm, a: Vector, b: Vector, ra: float, rb: float, mat: int, n: int = 10, etages: int = 4) -> None:
    d = (b - a).normalized()
    ref = Vector((1.0, 0.0, 0.0)) if abs(d.x) < 0.9 else Vector((0.0, 1.0, 0.0))
    e1 = d.cross(ref).normalized()
    e2 = d.cross(e1).normalized()
    anneaux = []
    for j in range(etages + 1):
        t = j / etages
        c = a.lerp(b, t)
        r = ra + (rb - ra) * t
        anneaux.append(anneau_points(bm, c, e1, e2, r, r, n))
    for j in range(etages):
        relier(bm, anneaux[j], anneaux[j + 1], mat)
    bm.faces.new(anneaux[0]).material_index = mat
    bm.faces.new(list(reversed(anneaux[-1]))).material_index = mat


def ellipsoide(bm, c: Vector, f: Vector, lat: Vector, rl: float, rw: float, rh: float, mat: int,
               n: int = 12, etages: int = 6) -> None:
    """Ellipsoïde orienté : axe long f (avant), latéral lat, vertical Z."""
    anneaux = []
    for j in range(1, etages):
        phi = -math.pi / 2 + math.pi * j / etages
        cp = math.cos(phi)
        pts = []
        for i in range(n):
            th = 2 * math.pi * i / n
            p = c + f * (rl * cp * math.cos(th)) + lat * (rw * cp * math.sin(th)) + UP * (rh * math.sin(phi))
            pts.append(bm.verts.new(p))
        anneaux.append(pts)
    for j in range(len(anneaux) - 1):
        relier(bm, anneaux[j], anneaux[j + 1], mat)
    bm.faces.new(anneaux[0]).material_index = mat
    bm.faces.new(list(reversed(anneaux[-1]))).material_index = mat


def corps(bm, spec: dict, rep: Repere, g: np.ndarray, d: np.ndarray, haut: float) -> None:
    """Corps et robe : anneaux suivant la silhouette, de la tête jusqu'à l'ourlet (matière 0 = image)."""
    H = len(g)
    idx = np.arange(H)
    valide = ~np.isnan(g)
    gf = np.interp(idx, idx[valide], g[valide])
    df = np.interp(idx, idx[valide], d[valide])
    premiere = int(idx[valide][0])
    haut_bord = int(rep.bord_haut)
    # un anneau par ligne de pixels : le col et l'ourlet changent vite, un pas plus large les lisse
    bords = list(range(haut_bord + 1, int(rep.bord_bas) + 1))
    yc0 = rep.y((gf[premiere] + df[premiere]) / 2)
    sommet = bm.verts.new(Vector((0.0, yc0, rep.z(rep.bord_haut))))
    anneaux = []
    for e in bords:
        ligne = min(e, H - 1)
        if e < premiere:
            dome = math.sqrt(max(0.0, (e - haut_bord) / max(1.0, premiere - haut_bord)))
        else:
            dome = 1.0
        yA = rep.y(df[ligne])
        yB = rep.y(gf[ligne])
        yc = (yA + yB) / 2
        ry = max(0.004, (yB - yA) / 2 * dome)
        z = rep.z(e)
        rx = facteur_profondeur((z - rep.zhem) / (haut - rep.zhem)) * ry
        pts = []
        for i in range(NSEG):
            t = 2 * math.pi * i / NSEG
            pts.append(bm.verts.new(Vector((rx * math.sin(t), yc + ry * math.cos(t), z))))
        anneaux.append(pts)
    # sommet de la tête : éventail vers le premier anneau
    for i in range(NSEG):
        bm.faces.new((sommet, anneaux[0][(i + 1) % NSEG], anneaux[0][i])).material_index = 0
    for j in range(len(anneaux) - 1):
        relier(bm, anneaux[j], anneaux[j + 1], 0)
    bm.faces.new(list(reversed(anneaux[-1]))).material_index = 0  # ourlet fermé


def bras(bm, spec: dict, rep: Repere) -> None:
    for b in spec["bras"]:
        x = b["x"]
        ep = rep.pos(*b["epaule"], x)
        co = rep.pos(*b["coude"], x - 0.02)
        po = rep.pos(*b["poignet"], x - 0.02)
        ma = rep.pos(*b["main"], x - 0.03)
        tube(bm, ep, co, 0.052, 0.042, 0)
        tube(bm, co, po, 0.042, 0.036, 0)
        avant = (ma - po).normalized()
        lat = (UP.cross(avant) if abs(avant.z) < 0.9 else AX.copy()).normalized()
        ellipsoide(bm, ma, avant, lat, 0.05, 0.036, 0.036, 0)


def sandales(bm, spec: dict, rep: Repere, cheville: dict) -> None:
    """Sandales posées au sol et chevilles, sous l'ourlet (ce que l'image ne montre pas)."""
    f = Vector(spec["avant"]).normalized()
    lat = UP.cross(f).normalized()
    for jambe in spec["jambes"]:
        a = cheville[jambe["nom"]]
        c = Vector((a.x, a.y, HAUTEUR_SANDALE / 2)) + f * 0.05
        ellipsoide(bm, c, f, lat, 0.115, 0.045, HAUTEUR_SANDALE / 2, 1)
        tube(bm, Vector((a.x, a.y, HAUTEUR_SANDALE - 0.02)), Vector((a.x, a.y, HAUTEUR_CHEVILLE_HAUT)),
             0.036, 0.034, 2, n=8, etages=2)


# ----------------------------------------------------------------------------- squelette

def squelette(spec: dict, rep: Repere, g: np.ndarray, d: np.ndarray, haut: float):
    """Crée l'armature. Retourne (objet, dictionnaire des positions de repos, liste des os)."""
    H = len(g)
    f = Vector(spec["avant"]).normalized()

    def centre_y(z: float) -> float:
        ligne = int(round(min(max(rep.ligne_de_z(z), 0), H - 1)))
        return rep.y((g[ligne] + d[ligne]) / 2)

    zb, zt, zc, zn = spec["hanche"], spec["hanche"] + 0.20, 1.34, 1.46
    zh = haut - 0.02
    def sur_axe(z: float) -> Vector:
        """Point de la colonne à la hauteur z : X = profondeur (0), Y = gauche-droite de l'image."""
        return Vector((0.0, centre_y(z), z))

    os_def = []  # (nom, tête, queue, parent)
    os_def.append(("racine", Vector((0, 0, 0)), Vector((0, 0, 0.10)), None))
    os_def.append(("bassin", sur_axe(zb), sur_axe(zt), "racine"))
    os_def.append(("torse", sur_axe(zt), sur_axe(zc), "bassin"))
    os_def.append(("cou", sur_axe(zc), sur_axe(zn), "torse"))
    os_def.append(("tete", sur_axe(zn), Vector((0.0, centre_y(zh - 0.12), zh)), "cou"))
    hanche_pts = {}
    for jambe in spec["jambes"]:
        nom = jambe["nom"]
        yl = rep.y(jambe["px"] + 0.5)  # gauche-droite de l'image
        h0 = Vector((jambe["x"], yl, spec["hanche"]))
        genou = Vector((jambe["x"], yl, spec["hanche"] - LONGUEUR_CUISSE))
        cheville = Vector((jambe["x"], yl, ZONE_CHEVILLE))
        pied_bout = cheville + f * 0.16
        os_def.append(("cuisse_" + nom, h0, genou, "bassin"))
        os_def.append(("jambe_" + nom, genou, cheville, "cuisse_" + nom))
        os_def.append(("pied_" + nom, cheville, pied_bout, "jambe_" + nom))
        hanche_pts[nom] = (h0, genou, cheville)
    for b in spec["bras"]:
        nom = b["nom"]
        x = b["x"]
        ep = rep.pos(*b["epaule"], x)
        co = rep.pos(*b["coude"], x - 0.02)
        po = rep.pos(*b["poignet"], x - 0.02)
        ma = rep.pos(*b["main"], x - 0.03)
        os_def.append(("bras_%s_haut" % nom, ep, co, "torse"))
        os_def.append(("bras_%s_bas" % nom, co, po, "bras_%s_haut" % nom))
        os_def.append(("main_%s" % nom, po, ma, "bras_%s_bas" % nom))

    data = bpy.data.armatures.new(spec["nom"] + "_squelette")
    obj = bpy.data.objects.new(spec["nom"] + "_squelette", data)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for nom, tete, queue, parent in os_def:
        eb = data.edit_bones.new(nom)
        eb.head = tete
        eb.tail = queue
        if parent:
            eb.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj, hanche_pts, [(n, t, q) for n, t, q, _ in os_def]


def os_autorise(nom_os: str, z: float) -> bool:
    """Qui commande quoi : le corps et la robe suivent le buste ; les pieds suivent le pied seul."""
    if nom_os.startswith(("cuisse_", "jambe_")):
        return False
    if nom_os.startswith("pied_"):
        return z < HAUTEUR_CHEVILLE_HAUT - 0.005
    return True


def poids(points: np.ndarray, segments: list) -> list:
    """Pour chaque sommet : les trois os les plus proches autorisés et leur poids (distance inverse)."""
    N = len(points)
    dist = np.zeros((N, len(segments)))
    for j, (_, a, b) in enumerate(segments):
        a = np.array(a)
        ab = np.array(b) - a
        L2 = max(1e-9, float(ab @ ab))
        t = np.clip(((points - a) @ ab) / L2, 0.0, 1.0)
        proj = a + t[:, None] * ab
        dist[:, j] = np.linalg.norm(points - proj, axis=1)
    for i in range(N):
        for j, (nom_os, _, bout) in enumerate(segments):
            if not os_autorise(nom_os, float(points[i, 2])):
                dist[i, j] = np.inf
            # la main ne commande que la main : sinon elle entraîne tout le poignet
            elif nom_os.startswith("main_") and np.linalg.norm(points[i] - np.array(bout)) > 0.085:
                dist[i, j] = np.inf
    ordre = np.argsort(dist, axis=1)[:, :3]
    resultat = []
    for i in range(N):
        ws = []
        for j in ordre[i]:
            if np.isfinite(dist[i, j]):
                ws.append((int(j), 1.0 / ((dist[i, j] + 0.012) ** 4)))
        s = sum(w for _, w in ws)
        resultat.append([(j, w / s) for j, w in ws if w / s > 1e-3])
    return resultat


# ----------------------------------------------------------------------------- animation

def axe_local(os_bd, axe: Vector) -> Vector:
    """Axe monde exprimé dans le repère de repos de l'os (chaque os a son propre repère)."""
    M = os_bd.matrix_local.to_3x3()
    return (M.transposed() @ axe).normalized()


def appliquer(pb, os_bd, rotations: list) -> None:
    q = Quaternion((1.0, 0.0, 0.0, 0.0))
    for axe, angle in rotations:
        if abs(angle) < 1e-9:
            continue
        q = Quaternion(axe_local(os_bd, axe), angle) @ q
    pb.rotation_quaternion = q


def cinematique(a: Vector, f: Vector, L1: float, L2: float, hanche: Vector):
    """Cinématique inverse dans le plan (f, Z) : angles de la cuisse et de la jambe (0 = vertical)."""
    dv = a - hanche
    u, w = dv.dot(f), dv.dot(UP)
    d = math.hypot(u, w)
    lim = L1 + L2 - 1e-3
    if d > lim:
        u, w, d = u * lim / d, w * lim / d, lim
    d = max(d, abs(L1 - L2) + 1e-3)
    aa = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, L1 * L1 - aa * aa))
    pu, pw = aa * u / d, aa * w / d
    k1 = (pu - h * w / d, pw + h * u / d)
    k2 = (pu + h * w / d, pw - h * u / d)
    ku, kw = k1 if k1[0] >= k2[0] else k2
    phi1 = math.atan2(ku, -kw)
    phi2 = math.atan2(u - ku, -(w - kw))
    return phi1, phi2


ANIMATIONS = {
    # nom: (durée de la boucle en secondes, marche/course ?)
    "idle": 2.6,
    "walk": 1.0,
    "run": 0.55,
    "talk": 1.6,
    "listen": 2.4,
    "dance": 1.6,
}


def image_de_pose(nom: str, spec: dict, t: float):
    """Pose à l'instant t (0..1) : déplacement de la racine, rotations des os, pas des jambes."""
    s = math.sin
    c = math.cos
    tau = 2 * math.pi
    principal = spec["bras_principal"]
    autres = [b["nom"] for b in spec["bras"] if b["nom"] != principal]
    racine = Vector((0, 0, 0))
    rot: dict[str, list] = {}
    pas = {}
    profil = spec["profil"]
    if nom == "idle":
        racine = UP * (0.008 * s(tau * t))
        rot["torse"] = [(AX, 0.010 * s(tau * t))]
        rot["cou"] = [(AX, 0.012 * s(tau * t + 0.5))]
        rot["tete"] = [(AX, 0.02 * s(tau * t + 1.0))]
        rot["bras_%s_haut" % principal] = [(AX, 0.04 * s(tau * t))]
    elif nom in ("walk", "run"):
        marche = nom == "walk"
        amp = spec["pas"] * (1.0 if marche else 1.4)
        levee = spec["levee"] * (1.0 if marche else 1.8)
        bob = 0.02 if marche else 0.05
        lean = 0.04 if marche else 0.14
        bras_amp = 0.35 if marche else 0.8
        for i, jambe in enumerate(spec["jambes"]):
            p = (t + 0.5 * i) % 1.0
            pas[jambe["nom"]] = (amp * c(tau * p), levee * max(0.0, -s(tau * p)))
        racine = UP * (-bob * (1 - c(2 * tau * t)) / 2)
        if profil:
            rot["torse"] = [(AX, lean)]
            rot["cou"] = [(AX, -lean * 0.5)]
        rot["tete"] = [(AX, -0.02 * s(tau * t))]
        if profil:
            rot["bras_%s_haut" % principal] = [(AX, -bras_amp * s(tau * t))]
            for n in autres:
                rot["bras_%s_haut" % n] = [(AX, bras_amp * s(tau * t))]
        else:
            rot["bras_%s_haut" % principal] = [(AX, 0.05 * s(tau * t))]
    elif nom == "talk":
        racine = UP * 0.003 * s(tau * t)
        rot["torse"] = [(AX, 0.015 * s(tau * t))]
        rot["cou"] = [(AX, 0.02 * s(tau * t + 0.3))]
        rot["tete"] = [(AX, 0.05 * s(2 * tau * t))]
        rot["bras_%s_haut" % principal] = [(AX, -0.10 + 0.05 * s(tau * t + 0.4))]
        rot["bras_%s_bas" % principal] = [(AX, -0.35 + 0.25 * s(tau * t))]
        rot["main_%s" % principal] = [(AX, 0.20 * s(tau * t + 1.0))]
    elif nom == "listen":
        racine = UP * 0.002 * s(tau * t)
        rot["tete"] = [(UP, 0.10 + 0.05 * s(tau * t)), (AX, 0.03 * s(tau * t))]
        rot["cou"] = [(UP, 0.05)]
        rot["bras_%s_haut" % principal] = [(AX, 0.06)]
        rot["bras_%s_bas" % principal] = [(AX, -0.10)]
    elif nom == "dance":
        racine = UP * (0.03 * abs(s(tau * t)))
        rot["torse"] = [(UP, 0.12 * s(tau * t))]
        rot["cou"] = [(UP, -0.06 * s(tau * t))]
        rot["tete"] = [(AX, 0.05 * s(2 * tau * t))]
        if profil:
            rot["bras_%s_haut" % principal] = [(AX, -1.3 + 0.5 * s(tau * t))]
            for n in autres:
                rot["bras_%s_haut" % n] = [(AX, -1.0 - 0.5 * s(tau * t))]
        else:
            rot["bras_%s_haut" % principal] = [(AX, 0.25 * s(tau * t))]
    return racine, rot, pas


def animer(obj, spec: dict, hanches: dict, os_liste: list) -> None:
    """Cuit une action par animation : une clé par image, pieds posés par cinématique inverse."""
    arm = obj.data
    f = Vector(spec["avant"]).normalized()
    L1 = LONGUEUR_CUISSE
    arm_bones = {b.name: b for b in arm.bones}
    obj.animation_data_create()
    for nom, duree in ANIMATIONS.items():
        act = bpy.data.actions.new(nom)  # le nom du clip dans le GLB : idle, walk, run, talk, listen, dance
        obj.animation_data.action = act
        n_images = max(2, int(round(duree * FPS)))
        bones_pose = [pb for pb in obj.pose.bones]
        for pb in bones_pose:
            pb.rotation_mode = "QUATERNION"
        for img in range(1, n_images + 2):
            t = (img - 1) / n_images
            racine, rot, pas = image_de_pose(nom, spec, t)
            for pb in bones_pose:
                pb.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))
            pb_r = obj.pose.bones["racine"]
            pb_r.location = racine
            pb_r.keyframe_insert("location", frame=img)
            pb_r.keyframe_insert("rotation_quaternion", frame=img)
            # jambes : cinématique inverse dans le plan de marche
            for jambe in spec["jambes"]:
                nj = jambe["nom"]
                h0, genou0, cheville0 = hanches[nj]
                ds, lift = pas.get(nj, (0.0, 0.0))
                cible = cheville0 + f * ds + UP * lift
                hanche_monde = h0 + racine
                L2 = (cheville0 - genou0).length
                phi1, phi2 = cinematique(cible, f, L1, L2, hanche_monde)
                axe_plan = f.cross(UP).normalized()
                rot.setdefault("cuisse_" + nj, []).append((axe_plan, phi1))
                rot.setdefault("jambe_" + nj, []).append((axe_plan, phi2 - phi1))
                rot.setdefault("pied_" + nj, []).append((axe_plan, -phi2))
            for pb in bones_pose:
                if pb.name == "racine":
                    continue
                pieces = [r for r in rot.get(pb.name, []) if isinstance(r, tuple)]
                appliquer(pb, arm_bones[pb.name], pieces)
                pb.keyframe_insert("rotation_quaternion", frame=img)
        obj.animation_data.action = act
    bpy.context.scene.render.fps = FPS


# ----------------------------------------------------------------------------- export et aperçu

def exporter(obj_corps, obj_squelette, chemin: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj_squelette.select_set(True)
    obj_corps.select_set(True)
    bpy.context.view_layer.objects.active = obj_squelette
    parametres = dict(
        filepath=chemin,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_yup=True,
        export_apply=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_force_sampling=True,
        export_def_bones=False,
    )
    for cle in list(parametres):
        try:
            bpy.ops.export_scene.gltf.get_rna_type().properties[cle]
        except KeyError:
            parametres.pop(cle)
    bpy.ops.export_scene.gltf(**parametres)
    marquer_decoupe(chemin)


def marquer_decoupe(chemin: str) -> None:
    """La silhouette est découpée net : l'exporteur écrit « BLEND », on passe en « MASK » (seuil 0,5)."""
    with open(chemin, "rb") as fichier:
        donnees = fichier.read()
    longueur = struct.unpack_from("<I", donnees, 12)[0]
    fin_json = 20 + longueur
    doc = json.loads(donnees[20:fin_json].decode("utf-8"))
    for mat in doc.get("materials", []):
        if mat.get("name", "").endswith("_image"):
            mat["alphaMode"] = "MASK"
            mat["alphaCutoff"] = 0.5
    json_octets = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    json_octets += b" " * (-len(json_octets) % 4)
    reste = donnees[fin_json:]
    with open(chemin, "wb") as fichier:
        fichier.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(json_octets) + len(reste)))
        fichier.write(struct.pack("<I4s", len(json_octets), b"JSON"))
        fichier.write(json_octets)
        fichier.write(reste)


def rendu_silhouette(W: int, H: int, rep: Repere, chemin: str) -> None:
    """Rendu orthographique depuis la caméra du jeu (côté -X), fond transparent."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"  # rendu CPU : pas besoin d'un contexte OpenGL
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    scene.render.resolution_x = W
    scene.render.resolution_y = H
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    donnees = bpy.data.cameras.new("cam_apercu")
    donnees.type = "ORTHO"
    donnees.ortho_scale = H * rep.k
    cam = bpy.data.objects.new("cam_apercu", donnees)
    bpy.context.collection.objects.link(cam)
    cam.location = (-6.0, 0.0, rep.z(H / 2))
    cam.rotation_euler = (math.radians(90), 0.0, math.radians(-90))
    scene.camera = cam
    scene.render.filepath = chemin
    bpy.ops.render.render(write_still=True)


def hauteur_semelles(obj_corps) -> float:
    """Hauteur la plus basse des semelles (matière 1) dans la pose courante, en mètres."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    ev = obj_corps.evaluated_get(depsgraph)
    maille = ev.to_mesh()
    try:
        bas = min(
            (ev.matrix_world @ maille.vertices[i].co).z
            for poly in maille.polygons if poly.material_index == 1
            for i in poly.vertices
        )
    finally:
        ev.to_mesh_clear()
    return float(bas)


def planche_animations(nom: str, obj_corps, obj_sq, rep: Repere, W: int, H: int, dossier: str) -> None:
    """Une image par instant clé de chaque animation (silhouette) et la hauteur des semelles."""
    scene = bpy.context.scene
    rangees = []
    for action in ("walk", "run", "talk", "dance"):
        obj_sq.animation_data.action = bpy.data.actions[action]
        n = int(round(ANIMATIONS[action] * FPS))
        vues = []
        for k in range(4):
            image = 1 + (k * n) // 4
            scene.frame_set(image)
            hauteur = hauteur_semelles(obj_corps)
            chemin = os.path.join(dossier, "tmp_%s_%s_%d.png" % (nom, action, k))
            rendu_silhouette(W, H, rep, chemin)
            vues.append(Image.open(chemin).convert("RGBA"))
            print("  %-6s image %3d : semelle la plus basse %+.3f m" % (action, image, hauteur))
        rangees.append(vues)
    bloc = Image.new("RGBA", (W * 4 + 30, H * len(rangees) + 10 * len(rangees)), (60, 110, 60, 255))
    for j, vues in enumerate(rangees):
        for k, v in enumerate(vues):
            bloc.paste(v, (k * (W + 10), j * (H + 10)), v)
    bloc.save(os.path.join(dossier, "animations_%s.png" % nom))
    obj_sq.animation_data.action = bpy.data.actions["idle"]


def comparer(nom: str, a: np.ndarray, rendu_chemin: str, dossier: str) -> float:
    """Superpose la silhouette rendue (bleu) et celle de l'image (rouge) ; retourne le recouvrement."""
    rendu = np.asarray(Image.open(rendu_chemin).convert("RGBA"))[:, :, 3] > 127
    image = a[:, :, 3] > 127
    ensemble = (rendu | image).sum()
    iou = (rendu & image).sum() / max(1, ensemble)
    fond = np.full(a.shape, 255, np.uint8)
    fond[image & ~rendu] = (230, 40, 40, 255)
    fond[rendu & ~image] = (40, 90, 230, 255)
    fond[rendu & image] = (120, 120, 120, 255)
    Image.fromarray(fond).save(os.path.join(dossier, "superposition_%s.png" % nom))
    return float(iou)


def vider_scene() -> None:
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.images,
                 bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for x in list(coll):
            coll.remove(x)


def construire(nom: str, sortie: str | None, apercu: str | None) -> None:
    spec = dict(PERSONNAGES[nom], nom=nom)
    chemin_image = os.path.join(RACINE, spec["image"])
    im = Image.open(chemin_image).convert("RGBA")
    a = np.asarray(im).copy()
    H, W = a.shape[0], a.shape[1]
    haut = spec["hauteur"]
    lignes = np.flatnonzero((a[:, :, 3] > 127).any(axis=1))
    bord_haut = float(lignes[0])
    bord_bas = float(lignes[-1] + 1)
    rep = Repere(W, H, haut, ZHEM, bord_haut, bord_bas)
    g, d = silhouette(spec, a)

    vider_scene()
    dossier = tempfile.mkdtemp(prefix="perso_%s_" % nom)
    png = texture_png(spec, a, dossier)

    bm = bmesh.new()
    corps(bm, spec, rep, g, d, haut)
    bras(bm, spec, rep)
    obj_sq, hanches, os_liste = squelette(spec, rep, g, d, haut)
    cheville = {nj: hanches[nj][2] for nj in hanches}
    sandales(bm, spec, rep, cheville)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    uvs = bm.loops.layers.uv.new("UVMap")
    for face in bm.faces:
        for loop in face.loops:
            loop[uvs].uv = rep.uv(loop.vert.co)
    maille = bpy.data.meshes.new(nom + "_maille")
    bm.to_mesh(maille)
    bm.free()
    # ombrage lissé : sinon chaque anneau du corps forme une bande plate (stries sur la robe)
    for poly in maille.polygons:
        poly.use_smooth = True
    obj_corps = bpy.data.objects.new(nom, maille)
    bpy.context.collection.objects.link(obj_corps)
    maille.materials.append(materiau_image(nom + "_image", png))
    maille.materials.append(materiau_plein(nom + "_cuir", spec["cuir"], 0.5))
    maille.materials.append(materiau_plein(nom + "_peau", spec["peau"], 0.7))

    segments = [(n, tuple(t), tuple(q)) for n, t, q in os_liste]
    coords = np.array([tuple(v.co) for v in maille.vertices])
    poids_sommets = poids(coords, segments)
    for j, (nom_os, _, _) in enumerate(segments):
        obj_corps.vertex_groups.new(name=nom_os)
    for i, liste in enumerate(poids_sommets):
        for j, w in liste:
            obj_corps.vertex_groups[segments[j][0]].add([i], w, "REPLACE")
    mod = obj_corps.modifiers.new("Squelette", "ARMATURE")
    mod.object = obj_sq
    obj_corps.parent = obj_sq

    animer(obj_sq, spec, hanches, os_liste)

    if apercu:
        os.makedirs(apercu, exist_ok=True)
        # pose de repos : on retire l'action (la dernière cuite laisse les bras levés)
        obj_sq.animation_data.action = None
        for pb in obj_sq.pose.bones:
            pb.location = (0.0, 0.0, 0.0)
            pb.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))
        bpy.context.view_layer.update()
        pose_repos = os.path.join(apercu, "rendu_%s.png" % nom)
        rendu_silhouette(W, H, rep, pose_repos)
        iou = comparer(nom, a, pose_repos, apercu)
        print("recouvrement silhouette image/rendu (IoU) :", round(iou, 3))
        planche_animations(nom, obj_corps, obj_sq, rep, W, H, apercu)
        for fichier in os.listdir(apercu):
            if fichier.startswith("tmp_"):
                os.remove(os.path.join(apercu, fichier))
    if sortie:
        os.makedirs(sortie, exist_ok=True)
        chemin = os.path.join(sortie, nom + ".glb")
        exporter(obj_corps, obj_sq, chemin)
        print("GLB écrit :", chemin, os.path.getsize(chemin), "octets")
    print("sommets :", len(maille.vertices), "faces :", len(maille.polygons), "os :", len(obj_sq.data.bones))


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--personnage", choices=sorted(PERSONNAGES) + ["tous"], default="tous")
    p.add_argument("--sortie", default=None, help="dossier où écrire le fichier GLB")
    p.add_argument("--apercu", default=None, help="dossier pour les images de contrôle")
    args = p.parse_args(argv)
    noms = sorted(PERSONNAGES) if args.personnage == "tous" else [args.personnage]
    for nom in noms:
        construire(nom, args.sortie, args.apercu)


if __name__ == "__main__":
    main()
