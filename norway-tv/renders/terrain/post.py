"""post.py - tone mapping / filmic grade for the terrain plates (linear float -> sRGB uint8)"""
import numpy as np
from scipy import ndimage


def soft_shoulder(x, knee=0.78):
    """identity below the knee (keeps the Sentinel grade), smooth roll-off to 1.0 above"""
    over = np.maximum(x - knee, 0.0)
    r = 1.0 - knee
    return np.where(x < knee, x, knee + r * (1.0 - np.exp(-over / r)))


def lin_to_srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def vignette(h, w, strength=0.18, power=2.2):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx - w / 2) / (w / 2)
    ny = (yy - h / 2) / (h / 2)
    r = np.sqrt(nx * nx * 0.85 + ny * ny * 1.0) / 1.2
    return 1.0 - strength * np.clip(r, 0, 1) ** power


def bloom(img, thresh, sigma, amount):
    hi = np.maximum(img - thresh, 0.0)
    b = np.stack([ndimage.gaussian_filter(hi[..., c], sigma) for c in range(3)], -1)
    return img + b * amount


def finish_day(img, fr=0):
    x = img.astype(np.float32)
    h, w = x.shape[:2]
    x = bloom(x, 0.9, 6.0 * w / 1920, 0.5)
    x = x * 1.02
    x = soft_shoulder(x)
    s = lin_to_srgb(x)
    # crisp-up (unsharp mask on luminance-ish, small radius)
    bl = np.stack([ndimage.gaussian_filter(s[..., c], 1.1 * w / 1920) for c in range(3)], -1)
    s = s + 0.35 * (s - bl)
    # gentle filmic S-curve + a touch of warmth in highlights, cool shadows
    s = s + 0.06 * (s - 0.5) * (1 - np.abs(2 * s - 1))
    lum = (0.2126 * s[..., 0] + 0.7152 * s[..., 1] + 0.0722 * s[..., 2])[..., None]
    s = lum + (s - lum) * 1.04
    warm = np.array([1.012, 1.0, 0.985], np.float32)
    cool = np.array([0.985, 1.0, 1.02], np.float32)
    s = s * (warm * lum + cool * (1 - lum))
    s = s * vignette(h, w)[..., None]
    s = np.clip(s, 0, 1)
    return (s * 255.0 + 0.5).astype(np.uint8)
