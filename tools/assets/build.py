#!/usr/bin/env python3
"""Fabrique les ressources graphiques du jeu à partir du pack d'images de référence.

    python tools/assets/build.py --models <dossier_modeles> [--pack <dossier_pack>]
                                 [--only sheets,cutouts,backdrops,extras] [--names a,b]
                                 [--preview <dossier>]

Étapes :
  sheets     découpe des planches à fond transparent (héros, ennemis, habitants, plateformes, objets)
  cutouts    détourage des personnages et décors peints dans les scènes (Segment-Anything)
  backdrops  arrière-plans et intérieurs nettoyés du héros et des ennemis (Segment-Anything + LaMa)
  extras     textures répétables et feuillages (incrustation par couleur)

Les fichiers produits (WebP) sont écrits dans public/assets et listés dans public/assets/manifest.json.
Voir tools/assets/README.md pour l'installation des modèles.
"""
import argparse
import json
import os
import sys
import zipfile

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "public", "assets")
ZIP = os.path.join(ROOT, "Taro_Pack_Complet_Jeu_Aventure_Africaine.zip")

sys.path.insert(0, HERE)


# ----------------------------------------------------------------------------- helpers

def ensure_pack(pack_dir):
    marker = os.path.join(pack_dir, "LISEZ_MOI.txt")
    if os.path.exists(marker):
        return pack_dir
    os.makedirs(pack_dir, exist_ok=True)
    print("extraction du pack ->", pack_dir)
    with zipfile.ZipFile(ZIP) as z:
        z.extractall(pack_dir)
    return pack_dir


def load_rgba(path):
    return np.array(Image.open(path).convert("RGBA"))


def clean_alpha(a, lo=14, hi=236):
    """The sheets have a noisy alpha channel (1-13 in empty areas, 244-253 in solid areas)."""
    return np.clip((a.astype(np.float32) - lo) / float(hi - lo), 0.0, 1.0)


def bleed(rgb, alpha, iters=8):
    """Spread the colours of the opaque pixels into the transparent ones (avoids halos when filtering)."""
    known = alpha > 0.03
    out = rgb.astype(np.float32).copy()
    out[~known] = 0
    k = np.ones((3, 3), np.float32)
    for _ in range(iters):
        kf = known.astype(np.float32)
        w = cv2.filter2D(kf, -1, k, borderType=cv2.BORDER_CONSTANT)
        s = cv2.filter2D(out * kf[..., None], -1, k, borderType=cv2.BORDER_CONSTANT)
        newly = (~known) & (w > 0)
        if not newly.any():
            break
        out[newly] = s[newly] / w[newly][:, None]
        known = known | newly
    return np.clip(out, 0, 255).astype(np.uint8)


def trim(rgb, alpha, pad=2):
    ys, xs = np.where(alpha > 0.03)
    if len(xs) == 0:
        return rgb, alpha
    x0, x1 = max(0, xs.min() - pad), min(alpha.shape[1], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(alpha.shape[0], ys.max() + pad + 1)
    return rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]


def fit(rgb, alpha, max_side):
    h, w = alpha.shape
    if not max_side or max(h, w) <= max_side:
        return rgb, alpha
    s = max_side / max(h, w)
    size = (max(1, int(round(w * s))), max(1, int(round(h * s))))
    return cv2.resize(rgb, size, interpolation=cv2.INTER_AREA), cv2.resize(alpha, size, interpolation=cv2.INTER_AREA)


def save_sprite(name, rgb, alpha, max_side=None):
    rgb, alpha = trim(rgb, alpha)
    rgb, alpha = fit(rgb, alpha, max_side)
    rgb = bleed(rgb, alpha)
    rgba = np.dstack([rgb, np.clip(alpha * 255.0 + 0.5, 0, 255).astype(np.uint8)])
    path = os.path.join(OUT, name + ".webp")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(path, "WEBP", quality=90, method=6, exact=True)
    print("  %-28s %4dx%-4d" % (name, rgba.shape[1], rgba.shape[0]))


def save_opaque(name, rgb, quality=86):
    path = os.path.join(OUT, name + ".webp")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(rgb, "RGB").save(path, "WEBP", quality=quality, method=6)
    print("  %-28s %4dx%-4d" % (name, rgb.shape[1], rgb.shape[0]))


def scaled(values, s):
    return [v * s for v in values]


def scaled_points(points, s):
    return [[p[0] * s, p[1] * s] for p in points]


# ----------------------------------------------------------------------------- sheets

def build_sheets(pack, names):
    spec = json.load(open(os.path.join(HERE, "jobs", "sheets.json"), encoding="utf-8"))
    cache = {}
    for sp in spec["sprites"]:
        if names and sp["out"] not in names:
            continue
        if sp["sheet"] not in cache:
            cache[sp["sheet"]] = load_rgba(os.path.join(pack, spec["sheets"][sp["sheet"]]))
        img = cache[sp["sheet"]]
        x0, y0, x1, y1 = sp["box"]
        m = 6
        x0, y0 = max(0, x0 - m), max(0, y0 - m)
        x1, y1 = min(img.shape[1], x1 + m), min(img.shape[0], y1 + m)
        crop = img[y0:y1, x0:x1]
        alpha = clean_alpha(crop[..., 3])
        solid = (alpha > 0.15).astype(np.uint8)
        n, lab, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
        if n > 1:
            areas = stats[1:, cv2.CC_STAT_AREA]
            biggest = 1 + int(np.argmax(areas))
            if sp.get("keep_parts"):
                keep = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= 40]
            else:
                keep = [biggest]
            mask = np.isin(lab, keep)
            mask = cv2.dilate(mask.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
            alpha = alpha * mask
        save_sprite(sp["out"], crop[..., :3], alpha, sp.get("max_side"))


# ----------------------------------------------------------------------------- cut-outs

def predict_parts(sam, job, s, x0, y0):
    def loc(points):
        return [[p[0] * s - x0, p[1] * s - y0] for p in points]

    def locbox(b):
        return None if b is None else [b[0] * s - x0, b[1] * s - y0, b[2] * s - x0, b[3] * s - y0]

    parts = job.get("parts") or [{"pos": job.get("pos", []), "neg": job.get("neg", []), "box": job.get("box")}]
    mask = np.zeros(sam.size, dtype=bool)
    seeds = []
    for part in parts:
        logit = sam.predict(loc(part.get("pos", [])), loc(part.get("neg", [])), locbox(part.get("box")))
        mask |= logit > float(part.get("thr", 0.0))
        seeds += loc(part.get("pos", []))
    return mask, seeds


def refine_mask(mask, seeds, job):
    m = mask.astype(np.uint8)
    n, lab = cv2.connectedComponents(m)
    keep = set()
    for px, py in seeds:
        px, py = int(round(px)), int(round(py))
        if 0 <= py < lab.shape[0] and 0 <= px < lab.shape[1] and lab[py, px] > 0:
            keep.add(int(lab[py, px]))
    if keep:
        m = np.isin(lab, list(keep)).astype(np.uint8)
    inv = (1 - m).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(inv)
    max_hole = int(job.get("fill_holes", 400))
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        touches = x == 0 or y == 0 or x + w == m.shape[1] or y + h == m.shape[0]
        if not touches and area <= max_hole:
            m[lab == i] = 1
    er = int(job.get("erode", 1))
    if er > 0:
        m = cv2.erode(m, np.ones((3, 3), np.uint8), iterations=er)
    alpha = cv2.GaussianBlur(m.astype(np.float32), (0, 0), float(job.get("feather", 1.2)))
    return np.clip((alpha - 0.5) * 2.0, 0, 1)


def up2x(rgb):
    """2x enlargement for small background elements: Lanczos + light unsharp mask (no ML model)."""
    big = cv2.resize(rgb, (rgb.shape[1] * 2, rgb.shape[0] * 2), interpolation=cv2.INTER_LANCZOS4)
    soft = cv2.GaussianBlur(big, (0, 0), 1.2)
    return cv2.addWeighted(big, 1.35, soft, -0.35, 0)


def build_cutouts(pack, models, names):
    from segmentation import Sam

    spec = json.load(open(os.path.join(HERE, "jobs", "cutouts.json"), encoding="utf-8"))
    sam = Sam(models)
    cache = {}
    for job in spec["jobs"]:
        if names and job["out"] not in names:
            continue
        if job["src"] not in cache:
            cache[job["src"]] = load_rgba(os.path.join(pack, spec["sources"][job["src"]]))
        img = cache[job["src"]]
        H, W = img.shape[:2]
        s = float(job.get("scale", 1.0))
        if "crop" in job:
            x0, y0, x1, y1 = scaled(job["crop"], s)
        else:
            bx0, by0, bx1, by1 = scaled(job["box"], s)
            mx, my = (bx1 - bx0) * 0.18 + 12, (by1 - by0) * 0.18 + 12
            x0, y0, x1, y1 = bx0 - mx, by0 - my, bx1 + mx, by1 + my
        x0, y0 = int(max(0, round(x0))), int(max(0, round(y0)))
        x1, y1 = int(min(W, round(x1))), int(min(H, round(y1)))
        crop = img[y0:y1, x0:x1]
        rgb = crop[..., :3]
        sheet_alpha = None
        if job.get("use_alpha"):
            sheet_alpha = clean_alpha(crop[..., 3])
            grey = np.full_like(rgb, 128)
            rgb_in = (rgb * sheet_alpha[..., None] + grey * (1 - sheet_alpha[..., None])).astype(np.uint8)
        else:
            rgb_in = rgb
        sam.embed(np.ascontiguousarray(rgb_in))
        mask, seeds = predict_parts(sam, job, s, x0, y0)
        alpha = refine_mask(mask, seeds, job)
        if sheet_alpha is not None:
            alpha = alpha * sheet_alpha
        up = int(job.get("upscale", 1))
        if up == 2:
            rgb = up2x(np.ascontiguousarray(rgb))
            alpha = cv2.resize(alpha, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC)
            alpha = np.clip((alpha - 0.5) * 1.7 + 0.5, 0, 1)
        if alpha.max() < 0.5:
            print("  !! masque vide :", job["out"])
            continue
        save_sprite(job["out"], rgb, alpha, job.get("max_side"))


# ----------------------------------------------------------------------------- backdrops

def object_mask(sam, img, obj, s):
    """Mask of one painted object to erase. The object is segmented in a close crop (better precision
    than on the whole scene), once with all the prompts and once per positive point (extremities)."""
    H, W = img.shape[:2]
    box = scaled(obj["box"], s)
    pad = max(50.0, 0.25 * max(box[2] - box[0], box[3] - box[1]))
    x0, y0 = int(max(0, box[0] - pad)), int(max(0, box[1] - pad))
    x1, y1 = int(min(W, box[2] + pad)), int(min(H, box[3] + pad))
    sam.embed(np.ascontiguousarray(img[y0:y1, x0:x1]))
    local_box = [box[0] - x0, box[1] - y0, box[2] - x0, box[3] - y0]
    pos = [[p[0] * s - x0, p[1] * s - y0] for p in obj.get("pos", [])]
    neg = [[p[0] * s - x0, p[1] * s - y0] for p in obj.get("neg", [])]
    m = sam.predict(pos, neg, local_box) > 0
    box_area = (local_box[2] - local_box[0]) * (local_box[3] - local_box[1])
    for p in pos:
        part = sam.predict([p], neg, None) > 0
        if part.sum() < 0.35 * box_area:
            m |= part
    lim = np.zeros_like(m)
    g = 16
    lim[int(max(0, local_box[1] - g)):int(local_box[3] + g), int(max(0, local_box[0] - g)):int(local_box[2] + g)] = True
    m &= lim
    full = np.zeros((H, W), dtype=bool)
    full[y0:y1, x0:x1] = m
    return full


def build_backdrops(pack, models, names):
    from inpainting import Lama, inpaint
    from segmentation import Sam

    spec = json.load(open(os.path.join(HERE, "jobs", "backdrops.json"), encoding="utf-8"))
    sam = lama = None
    for job in spec["jobs"]:
        if names and job["out"] not in names:
            continue
        img = np.array(Image.open(os.path.join(pack, job["src"])).convert("RGB"))
        H, W = img.shape[:2]
        s = float(job.get("scale", 1.0))
        mask = np.zeros((H, W), dtype=bool)
        if job.get("remove"):
            if sam is None:
                sam, lama = Sam(models), Lama(models)
            for obj in job["remove"]:
                mask |= object_mask(sam, img, obj, s)
        for r in job.get("rects", []):
            x0, y0, x1, y1 = [int(round(v)) for v in scaled(r, s)]
            mask[y0:y1, x0:x1] = True
        if mask.any():
            if lama is None:
                lama = Lama(models)
            d = int(job.get("dilate", 10))
            k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * d + 1, 2 * d + 1))
            mask = cv2.dilate(mask.astype(np.uint8), k).astype(bool)
            img = inpaint(lama, img, mask)
        if job.get("lighten"):
            l = float(job["lighten"])
            img = (img.astype(np.float32) * (1 - l) + np.array([236, 242, 255], np.float32) * l).astype(np.uint8)
        if job.get("blur"):
            img = cv2.GaussianBlur(img, (0, 0), float(job["blur"]))
        save_opaque(job["out"], img, 90 if job["out"].startswith("rooms/") else 84)


# ----------------------------------------------------------------------------- extras

def build_extras(pack, models, names):
    spec = json.load(open(os.path.join(HERE, "jobs", "backdrops.json"), encoding="utf-8"))
    for tex in spec.get("textures", []):
        if names and tex["out"] not in names:
            continue
        img = np.array(Image.open(os.path.join(pack, tex["src"])).convert("RGB"))
        x0, y0, x1, y1 = [int(round(v)) for v in scaled(tex["crop"], float(tex.get("scale", 1.0)))]
        crop = np.ascontiguousarray(img[y0:y1, x0:x1])
        if int(tex.get("upscale", 1)) == 2:
            crop = up2x(crop)
        save_opaque(tex["out"], crop, 88)
    for ch in spec.get("chroma", []):
        if names and ch["out"] not in names:
            continue
        img = np.array(Image.open(os.path.join(pack, ch["src"])).convert("RGB"))
        x0, y0, x1, y1 = [int(round(v)) for v in scaled(ch["crop"], float(ch.get("scale", 1.0)))]
        crop = np.ascontiguousarray(img[y0:y1, x0:x1])
        hsv = cv2.cvtColor(crop, cv2.COLOR_RGB2HSV)
        hch, sch, vch = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        keep = ((hch >= 3) & (hch <= 50) & (sch > 70) & (vch > 40)).astype(np.uint8)
        keep = cv2.morphologyEx(keep, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        alpha = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 1.0)
        if ch.get("ellipse"):
            # soft oval falloff: the strip blends into the scene instead of ending on straight cuts
            hh, ww = alpha.shape
            yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
            d = np.sqrt(((xx - ww / 2) / (ww / 2)) ** 2 + ((yy - hh * 0.42) / (hh * 0.62)) ** 2)
            alpha = alpha * np.clip((1.0 - d) / 0.32, 0, 1)
        fade = float(ch.get("fade_bottom", 0))
        if fade > 0:
            h = alpha.shape[0]
            ramp = np.clip((h - 1 - np.arange(h)) / (h * fade), 0, 1)
            alpha = alpha * ramp[:, None]
        save_sprite(ch["out"], crop, alpha)


# ----------------------------------------------------------------------------- manifest & previews

def write_manifest():
    images = {}
    for d, _, files in os.walk(OUT):
        for f in sorted(files):
            if not f.endswith(".webp"):
                continue
            p = os.path.join(d, f)
            rel = os.path.relpath(p, OUT).replace(os.sep, "/")
            with Image.open(p) as im:
                entry = {"file": rel, "w": im.width, "h": im.height}
                if rel.split("/")[0] in ("hero", "npc", "enemies"):
                    a = np.array(im.convert("RGBA"))[..., 3].astype(np.float32)
                    cols = np.arange(a.shape[1], dtype=np.float32)
                    rows = max(4, int(a.shape[0] * 0.1))
                    feet = a[-rows:].sum(axis=0)
                    head = a[:max(4, int(a.shape[0] * 0.14))].sum(axis=0)
                    entry["fx"] = round(float((feet * cols).sum() / max(1.0, feet.sum())) / a.shape[1], 3)
                    entry["hx"] = round(float((head * cols).sum() / max(1.0, head.sum())) / a.shape[1], 3)
                images[rel[:-5]] = entry
    images = dict(sorted(images.items()))
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump({"images": images}, fh, indent=1, ensure_ascii=False)
    total = sum(os.path.getsize(os.path.join(OUT, v["file"])) for v in images.values())
    print("manifest : %d images, %.1f Mo" % (len(images), total / 1e6))


def write_previews(preview_dir):
    from PIL import ImageDraw, ImageFont
    os.makedirs(preview_dir, exist_ok=True)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
    except Exception:
        font = ImageFont.load_default()
    groups = {}
    for d, _, files in os.walk(OUT):
        for f in sorted(files):
            if f.endswith(".webp"):
                groups.setdefault(os.path.relpath(d, OUT), []).append(os.path.join(d, f))
    for group, paths in groups.items():
        if group in ("bg", "rooms", "tex"):
            for p in paths:
                im = Image.open(p).convert("RGB")
                im.thumbnail((1300, 1300))
                im.save(os.path.join(preview_dir, "%s_%s.jpg" % (group, os.path.basename(p)[:-5])), quality=84)
            continue
        cell, cols = 230, 6
        rows = (len(paths) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell, rows * (cell + 18)), (255, 0, 255))
        draw = ImageDraw.Draw(sheet)
        for i, p in enumerate(paths):
            im = Image.open(p).convert("RGBA")
            label = "%s %dx%d" % (os.path.basename(p)[:-5], im.width, im.height)
            im.thumbnail((cell - 8, cell - 8))
            x, y = (i % cols) * cell, (i // cols) * (cell + 18)
            sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2), im)
            draw.rectangle([x, y + cell, x + cell, y + cell + 18], fill=(0, 0, 0))
            draw.text((x + 3, y + cell + 1), label, fill=(255, 255, 0), font=font)
        sheet.save(os.path.join(preview_dir, "sheet_%s.jpg" % group), quality=86)
    print("aperçus ->", preview_dir)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=os.environ.get("OUSMANE_MODELS", ""))
    ap.add_argument("--pack", default=os.path.join(ROOT, ".cache", "pack"))
    ap.add_argument("--only", default="sheets,cutouts,backdrops,extras")
    ap.add_argument("--names", default="")
    ap.add_argument("--preview", default="")
    args = ap.parse_args()
    steps = [s for s in args.only.split(",") if s]
    names = set(n for n in args.names.split(",") if n)
    pack = ensure_pack(args.pack)
    if "sheets" in steps:
        print("== planches")
        build_sheets(pack, names)
    if "cutouts" in steps:
        print("== détourages")
        build_cutouts(pack, args.models, names)
    if "backdrops" in steps:
        print("== décors")
        build_backdrops(pack, args.models, names)
    if "extras" in steps:
        print("== textures et feuillages")
        build_extras(pack, args.models, names)
    write_manifest()
    if args.preview:
        write_previews(args.preview)


if __name__ == "__main__":
    main()
