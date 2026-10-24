#!/usr/bin/env python3
"""
TRENDS YOUNIQUE — hero banner assets
------------------------------------
Do editorial source images se teen device-specific hero files:

  mobile   (4:5)   → hero-mobile.webp     <768px
  tablet   (4:3)   → hero-tablet.webp     768–1023px
  desktop  (16:9)  → hero-desktop.webp    ≥1024px

Desktop source me model right side par hai aur left me cream negative space —
wahan headline text baithta hai. Mobile source ka top portion headline ke liye
khali rehta hai. Koi text bake nahi hota (SEO + accessibility HTML me rehti hai).

Chalane ke liye:  python3 scripts/brand/build-trends-hero.py
"""

from __future__ import annotations

import os

from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC_WIDE = os.path.join(ROOT, "assets", "source", "hero-editorial-wide.png")
SRC_TALL = os.path.join(ROOT, "assets", "source", "hero-editorial-mobile.png")
OUT = os.path.join(ROOT, "apps", "web", "public", "images", "banners")


def cover(image: Image.Image, size: tuple[int, int], *, focus_x: float = 0.5, focus_y: float = 0.5) -> Image.Image:
    """Crop-to-fill (kuch stretch nahi hota)."""
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    left = round((resized.width - target_w) * focus_x)
    top = round((resized.height - target_h) * focus_y)
    return resized.crop((left, top, left + target_w, top + target_h))


def grade(image: Image.Image) -> Image.Image:
    """Halka warm premium grade — gold/ivory tone, thoda contrast."""
    image = ImageEnhance.Color(image).enhance(1.04)
    image = ImageEnhance.Contrast(image).enhance(1.03)
    return ImageEnhance.Brightness(image).enhance(1.01)


def save(image: Image.Image, name: str) -> None:
    os.makedirs(OUT, exist_ok=True)
    webp = os.path.join(OUT, name)
    image.save(webp, "WEBP", quality=86, method=6)
    print(f"  {name:<22} {image.width}x{image.height}  {os.path.getsize(webp) // 1024} KB")


def main() -> int:
    wide = Image.open(SRC_WIDE).convert("RGB")
    tall = Image.open(SRC_TALL).convert("RGB")

    print("TRENDS YOUNIQUE — hero banners")

    # desktop 16:9 — source already 16:9-ish, model right par
    save(grade(cover(wide, (1920, 1080), focus_x=0.62, focus_y=0.45)), "hero-desktop.webp")

    # tablet 4:3 — wide source ka right half (model + thoda negative space)
    save(grade(cover(wide, (1280, 960), focus_x=0.72, focus_y=0.42)), "hero-tablet.webp")

    # mobile 4:5 — tall source, upar headline ke liye space
    save(grade(cover(tall, (1000, 1250), focus_x=0.5, focus_y=0.18)), "hero-mobile.webp")

    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
