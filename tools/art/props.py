"""
Pipeline de cenário: modela e renderiza objetos (árvores, caixas, barris, rochas e estandartes)
com a mesma câmera, luz e acabamento dos personagens.

Uso: python tools/art/props.py
Saída: assets/environment/objects/<objeto>.png
"""
import math
import os
import random
import shutil
import sys
import tempfile

import bpy

sys.path.insert(0, os.path.dirname(__file__))
import characters as C  # noqa: E402

R = math.radians
OUT = os.path.join(C.ROOT, 'assets', 'environment', 'objects')


def stone_mat(name, hexcolor):
    return C.make_mat(name, C.hexc(hexcolor), rough=0.8)


def boulder(name, parent, loc, size, seed, mat):
    random.seed(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    o = bpy.context.active_object
    o.name = name
    for v in o.data.vertices:
        v.co *= 0.82 + random.random() * 0.3
        v.co.z = max(v.co.z, -0.35)
    C.finish(o, mat, parent, loc, (0, 0, random.random() * 6), size, outline=0, smooth=False)
    return o


def build(kind):
    root = C.empty('root')
    P = C.palette('blue')
    if kind.startswith('tree'):
        variant = kind[-1]
        leaf = [C.make_mat('leaf1', C.hexc('#3f9a3a'), rough=0.7), C.make_mat('leaf2', C.hexc('#56b84a'), rough=0.7),
                C.make_mat('leaf3', C.hexc('#2f7d33'), rough=0.7)]
        C.cyl('trunk', P['wood'], root, (0, 0, 0.45), r=0.17, depth=0.9, outline=0)
        random.seed(3 if variant == 'a' else 9)
        blobs = [(0, 0, 1.35, 0.72)] + [
            (math.cos(a) * 0.45, math.sin(a) * 0.38, 1.15 + random.random() * 0.35, 0.45 + random.random() * 0.12)
            for a in [i * 2 * math.pi / 5 + random.random() for i in range(5)]
        ] + [(0.05, -0.05, 1.85, 0.42)]
        for i, (x, y, z, r) in enumerate(blobs):
            C.sphere(f'leaf_{i}', leaf[i % 3], root, (x, y, z), (r, r, r * 0.9), outline=0)
        return root, 3.4
    if kind == 'crate':
        C.box('crate', C.make_mat('crate_wood', C.hexc('#c08a50'), rough=0.7), root, (0, 0, 0.36), (0.72, 0.72, 0.72), outline=0, bevel=0.04)
        band = C.make_mat('crate_band', C.hexc('#7a4f2a'), rough=0.7)
        for z in (0.06, 0.66):
            C.box(f'band_{z}', band, root, (0, 0, z), (0.76, 0.76, 0.1), outline=0, bevel=0.02)
        for x in (-0.33, 0.33):
            C.box(f'post_{x}', band, root, (x, -0.33, 0.36), (0.1, 0.1, 0.74), outline=0, bevel=0.02)
            C.box(f'postb_{x}', band, root, (x, 0.33, 0.36), (0.1, 0.1, 0.74), outline=0, bevel=0.02)
        return root, 1.6
    if kind == 'barrel':
        wood = C.make_mat('barrel_wood', C.hexc('#a8703f'), rough=0.7)
        C.cyl('barrel', wood, root, (0, 0, 0.42), r=0.32, depth=0.84, scale=(1, 1, 1), outline=0, bevel=0.05)
        C.sphere('bulge', wood, root, (0, 0, 0.42), (0.35, 0.35, 0.4), outline=0)
        for z in (0.12, 0.72):
            C.torus(f'hoop_{z}', P['darkmetal'], root, (0, 0, z), R=0.33, r=0.03, outline=0)
        return root, 1.6
    if kind.startswith('rock'):
        mats = [stone_mat('rock1', '#9a948c'), stone_mat('rock2', '#857f78'), stone_mat('rock3', '#b0aaa0')]
        seed = {'rock_a': 1, 'rock_b': 2, 'rock_c': 3}[kind]
        random.seed(seed)
        boulder('b0', root, (0, 0, 0.3), (0.62, 0.55, 0.5), seed, mats[0])
        boulder('b1', root, (0.45, 0.2, 0.18), (0.36, 0.32, 0.3), seed + 10, mats[1])
        boulder('b2', root, (-0.42, -0.15, 0.15), (0.3, 0.3, 0.26), seed + 20, mats[2])
        C.sphere('moss', C.make_mat('moss', C.hexc('#5c9e45'), rough=0.9), root, (0.05, 0.05, 0.62), (0.3, 0.25, 0.08), outline=0)
        return root, 2.2
    if kind.startswith('banner'):
        team = kind.split('_')[1]
        T = C.palette(team)
        stone = stone_mat('base_stone', '#a39c90')
        C.cyl('plinth', stone, root, (0, 0, 0.12), r=0.42, depth=0.24, outline=0, bevel=0.03)
        C.cyl('pole', T['wood'], root, (0, 0, 1.25), r=0.045, depth=2.3, outline=0)
        C.sphere('finial', T['gold'], root, (0, 0, 2.42), (0.09, 0.09, 0.09), outline=0)
        C.box('bar', T['wood'], root, (0.33, 0, 2.25), (0.72, 0.06, 0.06), outline=0, bevel=0.01)
        # Tecido levemente ondulado
        bpy.ops.mesh.primitive_plane_add(size=1)
        flag = bpy.context.active_object
        flag.name = 'flag'
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.subdivide(number_cuts=10)
        bpy.ops.object.mode_set(mode='OBJECT')
        for v in flag.data.vertices:
            v.co.z = 0.05 * math.sin(v.co.x * 7)
        C.finish(flag, T['team'], root, (0.36, -0.02, 1.78), (R(90), 0, 0), (0.66, 0.9, 1), outline=0)
        flag.modifiers.new('solid', 'SOLIDIFY').thickness = 0.02
        C.sphere('emblem', T['gold'], root, (0.36, -0.07, 1.82), (0.14, 0.03, 0.14), outline=0)
        return root, 3.0
    raise ValueError(kind)


KINDS = ['tree_a', 'tree_b', 'crate', 'barrel', 'rock_a', 'rock_b', 'rock_c', 'banner_blue', 'banner_red']


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    try:
        for kind in KINDS:
            scene = C.setup_scene()
            root, ortho = build(kind)
            scene.camera.data.ortho_scale = ortho
            # Reposiciona a câmera para manter a base do objeto em ORIGIN_Y.
            el = R(C.ELEVATION)
            ppu = C.FRAME / ortho
            h = (C.ORIGIN_Y - C.FRAME / 2) / ppu / math.cos(el)
            from mathutils import Vector
            target = Vector((0, 0, h))
            scene.camera.location = target + Vector((0, -math.cos(el), math.sin(el))) * 20
            scene.cycles.samples = 48
            path = os.path.join(tmp, 'p.png')
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            from PIL import Image
            im = C.add_outline(Image.open(path).convert('RGBA'))
            im.save(os.path.join(OUT, f'{kind}.png'), optimize=True)
            print(f'[ok] {kind} ortho={ortho}', flush=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
