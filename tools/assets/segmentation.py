"""Local Segment-Anything (ONNX) wrapper used to cut characters and props out of the concept art.

The model files are NOT part of the repository (see tools/assets/README.md).
"""
import os

import cv2
import numpy as np
import onnxruntime as ort

IN_H, IN_W = 684, 1024


class Sam:
    def __init__(self, models_dir, name="sam_vit_l_0b3195"):
        so = ort.SessionOptions()
        so.log_severity_level = 3
        self.enc = ort.InferenceSession(os.path.join(models_dir, name + ".encoder.onnx"), so)
        self.dec = ort.InferenceSession(os.path.join(models_dir, name + ".decoder.onnx"), so)
        self.emb = None
        self.scale = 1.0
        self.size = (0, 0)

    def embed(self, rgb):
        h, w = rgb.shape[:2]
        self.scale = min(IN_W / w, IN_H / h)
        nw, nh = int(round(w * self.scale)), int(round(h * self.scale))
        canvas = np.zeros((IN_H, IN_W, 3), dtype=np.float32)
        interp = cv2.INTER_CUBIC if self.scale > 1 else cv2.INTER_AREA
        canvas[:nh, :nw] = cv2.resize(rgb, (nw, nh), interpolation=interp)
        self.size = (h, w)
        self.emb = self.enc.run(None, {self.enc.get_inputs()[0].name: canvas})[0]

    def predict(self, pos, neg=(), box=None):
        """Returns the mask logits (float32, HxW of the embedded image)."""
        pts, labels = [], []
        for p in pos:
            pts.append(p)
            labels.append(1)
        for p in neg:
            pts.append(p)
            labels.append(0)
        if box is not None:
            pts.append([box[0], box[1]])
            labels.append(2)
            pts.append([box[2], box[3]])
            labels.append(3)
        else:
            pts.append([0.0, 0.0])
            labels.append(-1)
        coords = (np.array(pts, dtype=np.float32) * self.scale)[None]
        labels = np.array(labels, dtype=np.float32)[None]
        masks, scores, _ = self.dec.run(None, {
            "image_embeddings": self.emb,
            "point_coords": coords,
            "point_labels": labels,
            "mask_input": np.zeros((1, 1, 256, 256), dtype=np.float32),
            "has_mask_input": np.zeros(1, dtype=np.float32),
            "orig_im_size": np.array([IN_H, IN_W], dtype=np.float32),
        })
        best = int(np.argmax(scores[0]))
        logit = masks[0, best]
        h, w = self.size
        nw, nh = int(round(w * self.scale)), int(round(h * self.scale))
        return cv2.resize(logit[:nh, :nw], (w, h), interpolation=cv2.INTER_LINEAR)
