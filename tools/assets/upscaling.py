"""2x upscale with a compact SRVGG ONNX model (used for small background elements cut from the scenes)."""
import numpy as np
import onnxruntime as ort

_sessions = {}


def up2x(rgb, model_path, tile=256, pad=16):
    if model_path not in _sessions:
        so = ort.SessionOptions()
        so.log_severity_level = 3
        _sessions[model_path] = ort.InferenceSession(model_path, so)
    s = _sessions[model_path]
    name = s.get_inputs()[0].name
    dtype = np.float16 if "float16" in s.get_inputs()[0].type else np.float32
    h, w = rgb.shape[:2]
    out = np.zeros((h * 2, w * 2, 3), dtype=np.float32)
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            x0, y0 = max(0, x - pad), max(0, y - pad)
            x1, y1 = min(w, x + tile + pad), min(h, y + tile + pad)
            patch = rgb[y0:y1, x0:x1].astype(np.float32) / 255.0
            res = s.run(None, {name: patch.transpose(2, 0, 1)[None].astype(dtype)})[0][0]
            res = res.astype(np.float32).transpose(1, 2, 0)
            ox0, oy0 = (x - x0) * 2, (y - y0) * 2
            tw, th = (min(w, x + tile) - x) * 2, (min(h, y + tile) - y) * 2
            out[y * 2:y * 2 + th, x * 2:x * 2 + tw] = res[oy0:oy0 + th, ox0:ox0 + tw]
    return np.clip(out * 255.0 + 0.5, 0, 255).astype(np.uint8)
