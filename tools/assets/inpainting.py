"""LaMa (ONNX) wrapper: fills masked regions of a painting (used to remove the painted hero from scenes)."""
import os

import cv2
import numpy as np
import onnxruntime as ort


class Lama:
    def __init__(self, models_dir):
        so = ort.SessionOptions()
        so.log_severity_level = 3
        self.s = ort.InferenceSession(os.path.join(models_dir, "lama.onnx"), so)

    def fill(self, rgb, mask):
        h, w = rgb.shape[:2]
        im = cv2.resize(rgb, (512, 512), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
        mk = cv2.resize(mask.astype(np.uint8), (512, 512), interpolation=cv2.INTER_NEAREST).astype(np.float32)
        out = self.s.run(None, {"image": im.transpose(2, 0, 1)[None], "mask": mk[None, None]})[0][0]
        out = out.transpose(1, 2, 0)
        if out.max() <= 1.5:
            out = out * 255.0
        out = np.clip(out, 0, 255).astype(np.uint8)
        return cv2.resize(out, (w, h), interpolation=cv2.INTER_CUBIC)


def _fill_window(lama, result, mask, target, wx0, wy0, side):
    win = result[wy0:wy0 + side, wx0:wx0 + side]
    wmask = target[wy0:wy0 + side, wx0:wx0 + side]
    if not wmask.any():
        return
    filled = lama.fill(win, mask[wy0:wy0 + side, wx0:wx0 + side])
    soft = cv2.GaussianBlur(wmask.astype(np.float32), (0, 0), 2.0)
    soft = np.clip(soft * 1.6, 0, 1)[..., None]
    soft[wmask] = 1.0
    result[wy0:wy0 + side, wx0:wx0 + side] = (filled * soft + win * (1 - soft)).astype(np.uint8)


def inpaint(lama, img, mask, context=1.8, min_side=384, tile=640, margin=72):
    """Fill every connected component of `mask`.

    A component that fits in one window is filled with its own centred context window. A larger one
    is filled tile by tile: each tile only fills the pixels far enough from its borders, so every
    pixel is reconstructed with real context around it.
    """
    H, W = img.shape[:2]
    result = img.copy()
    remaining = mask.copy()
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8))
    limit = min(H, W)
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 20:
            continue
        comp = lab == i
        side = int(max(w, h) * context)
        if max(w, h) <= 0.8 * limit and side <= limit:
            side = min(max(side, min_side), limit)
            cx, cy = x + w // 2, y + h // 2
            wx0 = int(np.clip(cx - side // 2, 0, W - side))
            wy0 = int(np.clip(cy - side // 2, 0, H - side))
            _fill_window(lama, result, remaining, comp, wx0, wy0, side)
            remaining &= ~comp
            continue
        side = min(tile, limit)
        step = side - 2 * margin
        ty = max(0, y - margin)
        while True:
            wy0 = int(min(ty, H - side))
            tx = max(0, x - margin)
            while True:
                wx0 = int(min(tx, W - side))
                inner = np.zeros((H, W), dtype=bool)
                ix0 = wx0 if wx0 == 0 else wx0 + margin
                iy0 = wy0 if wy0 == 0 else wy0 + margin
                ix1 = W if wx0 + side >= W else wx0 + side - margin
                iy1 = H if wy0 + side >= H else wy0 + side - margin
                inner[iy0:iy1, ix0:ix1] = True
                target = comp & remaining & inner
                _fill_window(lama, result, remaining, target, wx0, wy0, side)
                remaining &= ~target
                if wx0 + side - margin >= x + w or wx0 + side >= W:
                    break
                tx = wx0 + step
            if wy0 + side - margin >= y + h or wy0 + side >= H:
                break
            ty = wy0 + step
    return result
