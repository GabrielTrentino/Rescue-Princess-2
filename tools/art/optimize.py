"""Reduz o tamanho das folhas de sprites geradas (paleta de 256 cores, sem pontilhado).

Uso: python tools/art/optimize.py [pastas...]   (padrão: assets/characters e assets/environment/objects)
Funciona com qualquer Python que tenha o Pillow instalado.
"""
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
folders = sys.argv[1:] or ["assets/characters", "assets/environment/objects"]
before = after = 0
for folder in folders:
    for path in sorted((ROOT / folder).rglob("*.png")):
        size = path.stat().st_size
        im = Image.open(path)
        if im.mode == "P":
            continue  # já otimizada
        q = im.convert("RGBA").quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        q.save(path, optimize=True)
        before += size
        after += path.stat().st_size
print(f"{before / 1e6:.1f} MB -> {after / 1e6:.1f} MB")
