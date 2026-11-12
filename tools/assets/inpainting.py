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


def inpaint(lama, img, mask, context=1.8, min_side=384):
    """Fill every connected component of `mask` using its own context window."""
    H, W = img.shape[:2]
    result = img.copy()
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8))
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 20:
            continue
        side = int(max(w, h) * context)
        side = min(max(side, min_side), min(H, W))
        cx, cy = x + w // 2, y + h // 2
        wx0 = int(np.clip(cx - side // 2, 0, W - side))
        wy0 = int(np.clip(cy - side // 2, 0, H - side))
        win = result[wy0:wy0 + side, wx0:wx0 + side]
        wmask = lab[wy0:wy0 + side, wx0:wx0 + side] == i
        allmask = mask[wy0:wy0 + side, wx0:wx0 + side]
        filled = lama.fill(win, allmask)
        soft = cv2.GaussianBlur(wmask.astype(np.float32), (0, 0), 2.0)
        soft = np.clip(soft * 1.6, 0, 1)[..., None]
        soft[wmask] = 1.0
        result[wy0:wy0 + side, wx0:wx0 + side] = (filled * soft + win * (1 - soft)).astype(np.uint8)
    return result
