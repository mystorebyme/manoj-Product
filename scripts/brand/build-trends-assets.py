#!/usr/bin/env python3
"""
TRENDS YOUNIQUE — brand asset builder
-------------------------------------
Owner ka ek hi original logo (`assets/source/trends-younique-logo-original.png`,
crown + gown crest + TRENDS YOUNIQUE wordmark) lekar saari site assets banata hai.

Koi redraw / typography change nahi — sirf:
  1. checkerboard (fake transparency) ko asli alpha me badalna
  2. trim + resize (Lanczos) + WebP
  3. kuch variants: cream version (maroon footer ke liye), horizontal header lockup,
     square mark (favicon/PWA), OG image

Output (apps/web/public/images/brand/):
  trends-lockup.png / .webp          stacked full lockup (transparent) — footer, about, invoice
  trends-lockup-cream.png / .webp    wahi, cream color (maroon background ke liye)
  trends-header.png                  horizontal lockup (crest + wordmark) — site header
  trends-header-cream.png            horizontal, cream (footer/dark sections)
  trends-wordmark.png                sirf "TRENDS YOUNIQUE" text
  trends-mark-{64,128,192,512}.png   square crest (cream plate) — favicon, PWA, apple touch
  og-image.jpg                       1200x630 social preview card

Chalane ke liye:  python3 scripts/brand/build-trends-assets.py
(Zaroorat: Pillow — `python3 -m pip install --user pillow`)
"""

from __future__ import annotations

import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SOURCE = os.path.join(ROOT, "assets", "source", "trends-younique-logo-original.png")
OUT_WEB = os.path.join(ROOT, "apps", "web", "public", "images", "brand")
OUT_ADMIN = os.path.join(ROOT, "apps", "admin", "public")

CREAM = (253, 250, 244, 255)
INK = (12, 10, 9, 255)


# ─────────────────────────── helpers ───────────────────────────


def load_with_alpha(path: str) -> Image.Image:
    """Checkerboard wali PNG ko asli transparency me badlo (luminance = alpha)."""
    image = Image.open(path).convert("RGB")
    gray = image.convert("L")
    # kaala art = opaque, safed checkerboard = transparent
    alpha = gray.point(lambda value: 255 - value).point(lambda value: 0 if value < 40 else (255 if value > 190 else value))
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    # art ko uniform ink color do (JPEG-ish noise saaf ho jata hai)
    ink = Image.new("RGBA", image.size, INK)
    out.paste(ink, (0, 0), alpha)
    return out


def trim(image: Image.Image, pad_ratio: float = 0.0) -> Image.Image:
    box = image.split()[3].getbbox()
    if box:
        image = image.crop(box)
    if pad_ratio > 0:
        pad = int(max(image.size) * pad_ratio)
        canvas = Image.new("RGBA", (image.width + pad * 2, image.height + pad * 2), (0, 0, 0, 0))
        canvas.paste(image, (pad, pad), image)
        image = canvas
    return image


def resize_to_height(image: Image.Image, height: int) -> Image.Image:
    scale = height / image.height
    return image.resize((max(1, round(image.width * scale)), height), Image.LANCZOS)


def recolor(image: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    """Monochrome art ko kisi bhi flat color me (alpha wahi rehta hai)."""
    out = Image.new("RGBA", image.size, rgb + (0,))
    out.putalpha(image.split()[3])
    return out


def save(image: Image.Image, *paths: str) -> None:
    for path in paths:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if path.lower().endswith(".webp"):
            image.save(path, "WEBP", quality=92, method=6)
        elif path.lower().endswith(".jpg"):
            image.save(path, "JPEG", quality=88, optimize=True, progressive=True)
        else:
            image.save(path, "PNG", optimize=True)
        print(f"  {os.path.relpath(path, ROOT):<58} {image.width}x{image.height}")


def square_plate(mark: Image.Image, size: int, background=CREAM, ratio: float = 0.74, radius_ratio: float = 0.14) -> Image.Image:
    """Square icon — cream plate + centered crest."""
    canvas = Image.new("RGBA", (size, size), background)
    target = int(size * ratio)
    inner = mark.copy()
    scale = min(target / inner.width, target / inner.height)
    inner = inner.resize((max(1, round(inner.width * scale)), max(1, round(inner.height * scale))), Image.LANCZOS)
    canvas.paste(inner, ((size - inner.width) // 2, (size - inner.height) // 2), inner)
    return canvas


# ─────────────────────────── build ───────────────────────────


def main() -> int:
    if not os.path.exists(SOURCE):
        print(f"missing source: {SOURCE}", file=sys.stderr)
        return 1

    print("TRENDS YOUNIQUE — building brand assets from")
    print(f"  {os.path.relpath(SOURCE, ROOT)}\n")

    art = trim(load_with_alpha(SOURCE))

    # crest aur wordmark alag karo (row gaps se)
    import numpy as np  # local import — sirf build step me chahiye

    alpha = np.array(art.split()[3])
    rows = (alpha > 60).sum(axis=1)
    gaps, run = [], 0
    for value in rows:
        if value == 0:
            run += 1
        elif run:
            gaps.append(run)
            run = 0
    split = art.height - sum(gaps[:2]) if len(gaps) >= 2 else int(art.height * 0.75)
    # crest ke baad pehla bada gap = wordmark ka start
    band_start = None
    for index, value in enumerate(rows):
        if value > 0 and band_start is None:
            band_start = index
        if value == 0 and band_start is not None and index > art.height * 0.6:
            split = band_start
            break
    # asli split: crest ke baad ka pehla blank row (60% ke baad)
    blank = 0
    for index in range(int(art.height * 0.6), art.height):
        if rows[index] == 0:
            blank += 1
        elif blank > 8:
            split = index - blank
            break
        else:
            blank = 0

    crest = trim(art.crop((0, 0, art.width, split)))
    wordmark = trim(art.crop((0, split, art.width, art.height)))
    print(f"  crest {crest.width}x{crest.height} · wordmark {wordmark.width}x{wordmark.height}\n")

    # ── 1. stacked lockup (transparent) ──
    lockup_h = 1100
    lockup = art.resize((round(art.width * lockup_h / art.height), lockup_h), Image.LANCZOS)
    lockup = trim(lockup, pad_ratio=0.02)
    save(lockup, f"{OUT_WEB}/trends-lockup.png", f"{OUT_WEB}/trends-lockup.webp")
    save(recolor(lockup, (248, 242, 232)), f"{OUT_WEB}/trends-lockup-cream.png", f"{OUT_WEB}/trends-lockup-cream.webp")

    # ── 2. horizontal header lockup ──
    crest_h = 300
    crest_big = resize_to_height(crest, crest_h)
    word_h = int(crest_h * 0.52)
    word_big = resize_to_height(wordmark, word_h)
    gap = int(crest_h * 0.16)
    header_w = crest_big.width + gap + word_big.width
    header = Image.new("RGBA", (header_w, crest_h), (0, 0, 0, 0))
    header.paste(crest_big, (0, 0), crest_big)
    header.paste(word_big, (crest_big.width + gap, (crest_h - word_big.height) // 2), word_big)
    header = trim(header, pad_ratio=0.015)
    save(header, f"{OUT_WEB}/trends-header.png", f"{OUT_WEB}/trends-header.webp")
    save(recolor(header, (248, 242, 232)), f"{OUT_WEB}/trends-header-cream.png", f"{OUT_WEB}/trends-header-cream.webp")

    # ── 3. wordmark only ──
    save(trim(resize_to_height(wordmark, 220), 0.01), f"{OUT_WEB}/trends-wordmark.png")

    # ── 4. square marks (favicon / PWA / apple touch / admin) ──
    mark_master = square_plate(crest, 512)
    for size in (512, 192, 128, 64):
        icon = mark_master if size == 512 else mark_master.resize((size, size), Image.LANCZOS)
        save(icon, f"{OUT_WEB}/trends-mark-{size}.png")
        if size in (128, 192, 512):
            save(icon, f"{OUT_ADMIN}/trends-mark-{size}.png")
    save(mark_master, f"{OUT_ADMIN}/brand-mark.png")

    # ── 5. invoice logo (cream plate, wide) ──
    invoice = Image.new("RGBA", (720, 260), CREAM)
    lock_small = resize_to_height(trim(load_with_alpha(SOURCE)), 210)
    invoice.paste(lock_small, ((720 - lock_small.width) // 2, (260 - lock_small.height) // 2), lock_small)
    save(invoice, f"{OUT_ADMIN}/invoice-logo.png")

    # ── 6. Open Graph card 1200x630 ──
    og = Image.new("RGB", (1200, 630), (253, 250, 244))
    lock_og = resize_to_height(lockup, 470)
    og.paste(lock_og, ((1200 - lock_og.width) // 2, (630 - lock_og.height) // 2), lock_og)
    save(og, f"{ROOT}/apps/web/public/images/og-image.jpg")

    print("\ndone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
