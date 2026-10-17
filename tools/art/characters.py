"""
Pipeline de personagens: modela as seis classes em 3D (estilo Cartoon 3D Stylized),
anima por quadros-chave procedurais e renderiza folhas de sprites com fundo transparente.

Uso (Blender como módulo Python, `pip install bpy`, ou dentro do Blender):
    python tools/art/characters.py                       # tudo
    python tools/art/characters.py --classes warrior     # só uma classe
    python tools/art/characters.py --preview             # 1 quadro por animação, para revisão rápida

Saídas:
    assets/characters/<classe>/<classe>_<equipe>_<animação>.png   folhas (colunas = quadros, linhas = direções)
    assets/source/characters/<classe>.blend                        modelo-fonte
"""
import argparse
import math
import os
import shutil
import sys
import tempfile

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FRAME = 256
ORIGIN_Y = 212           # linha (px, a partir do topo) onde fica o ponto dos pés
ELEVATION = 50           # inclinação da câmera em graus (handoff: 35°–50°)
ORTHO_SCALE = 2.45
DIRECTIONS = {'down': 0, 'left': -90, 'right': 90, 'up': 180}  # rotação Z do personagem
DIR_ORDER = ['down', 'left', 'right', 'up']
ANIMS = {'idle': 8, 'run': 8, 'attack': 8, 'hurt': 4, 'death': 8}
CLASSES = ['warrior', 'barbarian', 'mage', 'archer', 'mercenary', 'halberdier']
TEAMS = {'blue': (0.16, 0.42, 0.95), 'red': (0.92, 0.2, 0.16)}

# ---------------------------------------------------------------- materiais

def srgb(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def hexc(h):
    h = h.lstrip('#')
    return srgb(tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)))


def make_mat(name, color, rough=0.55, metal=0.0, emit=0.0, coat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if coat:
        p.inputs['Coat Weight'].default_value = coat
    if emit:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emit
    return m


def outline_mat():
    m = bpy.data.materials.get('Outline')
    if m:
        return m
    m = bpy.data.materials.new('Outline')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    mix = nt.nodes.new('ShaderNodeMixShader')
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (0.03, 0.025, 0.05, 1)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    nt.links.new(geo.outputs['Backfacing'], mix.inputs['Fac'])
    nt.links.new(em.outputs['Emission'], mix.inputs[1])
    nt.links.new(tr.outputs['BSDF'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return m


def palette(team):
    return {
        'team': make_mat(f'team_{team}', srgb(TEAMS[team]), rough=0.5),
        'teamdark': make_mat(f'teamdark_{team}', tuple(c * 0.55 for c in srgb(TEAMS[team])), rough=0.6),
        'skin': make_mat('skin', hexc('#f2c29b'), rough=0.6),
        'metal': make_mat('metal', hexc('#c8d2de'), rough=0.28, metal=0.85),
        'darkmetal': make_mat('darkmetal', hexc('#6c7684'), rough=0.35, metal=0.8),
        'gold': make_mat('gold', hexc('#f0c048'), rough=0.3, metal=0.9),
        'wood': make_mat('wood', hexc('#8a5a33'), rough=0.7),
        'leather': make_mat('leather', hexc('#5b3a24'), rough=0.65),
        'boot': make_mat('boot', hexc('#3a2a20'), rough=0.6),
        'eye': make_mat('eye', hexc('#1a1626'), rough=0.2),
        'white': make_mat('white', hexc('#f4f1ea'), rough=0.5),
        'bone': make_mat('bone', hexc('#efe3c4'), rough=0.5),
        'fur': make_mat('fur', hexc('#9b6a3f'), rough=0.9),
        'beard_red': make_mat('beard_red', hexc('#c8622c'), rough=0.85),
        'beard_white': make_mat('beard_white', hexc('#e8e6e2'), rough=0.85),
        'purple': make_mat('purple', hexc('#6f43c9'), rough=0.55),
        'purple_light': make_mat('purple_light', hexc('#a57cf0'), rough=0.5),
        'orb': make_mat('orb', hexc('#d9c4ff'), rough=0.1, emit=4.0),
        'green': make_mat('green', hexc('#4b9a3f'), rough=0.6),
        'green_dark': make_mat('green_dark', hexc('#2f6a2b'), rough=0.6),
        'shadowcloth': make_mat('shadowcloth', hexc('#34323f'), rough=0.7),
        'violet': make_mat('violet', hexc('#7d6bb8'), rough=0.6),
        'bronze': make_mat('bronze', hexc('#c8913a'), rough=0.35, metal=0.8),
        'feather': make_mat('feather', hexc('#f4f1ea'), rough=0.7),
    }

# ---------------------------------------------------------------- primitivas

COLL = None
USE_HULL_OUTLINE = False  # o contorno final é aplicado em 2D sobre a silhueta (add_outline)
OUTLINE_PX = 3
OUTLINE_RGB = (28, 24, 40)


def link(obj):
    COLL.objects.link(obj)
    return obj


def empty(name, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    e = link(bpy.data.objects.new(name, None))
    e.parent = parent
    e.location = loc
    e.rotation_euler = rot
    return e


def finish(obj, mat, parent, loc, rot, scale, outline=0.022, bevel=0.0, smooth=True):
    obj.parent = parent
    obj.location = loc
    obj.rotation_euler = rot
    obj.scale = scale
    obj.data.materials.append(mat)
    if smooth and hasattr(obj.data, 'polygons'):
        for p in obj.data.polygons:
            p.use_smooth = True
    if bevel:
        m = obj.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = 3
    if outline and USE_HULL_OUTLINE:
        obj.data.materials.append(outline_mat())
        s = obj.modifiers.new('outline', 'SOLIDIFY')
        s.thickness = -outline / max(min(scale), 0.05)
        s.use_flip_normals = True
        s.material_offset = 1
        s.offset = 1
    return obj


def sphere(name, mat, parent, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), r=1.0, outline=0.022, seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=seg // 2)
    o = bpy.context.active_object
    o.name = name
    COLL.objects.link(o) if o.name not in COLL.objects else None
    return finish(o, mat, parent, loc, rot, scale, outline)


def cyl(name, mat, parent, loc=(0, 0, 0), r=1.0, depth=1.0, scale=(1, 1, 1), rot=(0, 0, 0), outline=0.022, bevel=0.0, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    return finish(o, mat, parent, loc, rot, scale, outline, bevel)


def cone(name, mat, parent, loc=(0, 0, 0), r1=1.0, r2=0.0, depth=1.0, scale=(1, 1, 1), rot=(0, 0, 0), outline=0.022, verts=32):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    return finish(o, mat, parent, loc, rot, scale, outline)


def box(name, mat, parent, loc=(0, 0, 0), size=(1, 1, 1), rot=(0, 0, 0), outline=0.02, bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    return finish(o, mat, parent, loc, rot, size, outline, bevel, smooth=False)


def torus(name, mat, parent, loc=(0, 0, 0), R=0.3, r=0.04, scale=(1, 1, 1), rot=(0, 0, 0), outline=0.015):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=40, minor_segments=12)
    o = bpy.context.active_object
    o.name = name
    return finish(o, mat, parent, loc, rot, scale, outline)


def arc_curve(name, mat, parent, points, bevel=0.025, loc=(0, 0, 0), rot=(0, 0, 0)):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel
    cu.bevel_resolution = 4
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = link(bpy.data.objects.new(name, cu))
    o.data.materials.append(mat)
    o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    return o

# ---------------------------------------------------------------- personagem

R = math.radians


class Rig:
    """Pivôs do boneco. Rotações em X: negativo = para a frente (-Y)."""

    def __init__(self, cls, team):
        self.cls = cls
        self.team = team
        P = self.P = palette(team)
        bulk = {'barbarian': 1.18, 'mercenary': 0.9}.get(cls, 1.0)
        self.bulk = bulk
        self.root = empty('root')
        self.hips = empty('hips', self.root, (0, 0, 0.42))
        self.torso = empty('torso', self.hips, (0, 0, 0))
        self.neck = empty('neck', self.torso, (0, 0, 0.56))
        self.leg_l = empty('leg_l', self.hips, (0.12 * bulk, 0, 0))
        self.leg_r = empty('leg_r', self.hips, (-0.12 * bulk, 0, 0))
        self.arm_l = empty('arm_l', self.torso, (0.31 * bulk, 0, 0.44))
        self.arm_r = empty('arm_r', self.torso, (-0.31 * bulk, 0, 0.44))
        self.hand_l = empty('hand_l', self.arm_l, (0, 0, -0.32))
        self.hand_r = empty('hand_r', self.arm_r, (0, 0, -0.32))
        self.build_body()
        getattr(self, f'build_{cls}')()

    # --- corpo comum
    def build_body(self):
        P, b = self.P, self.bulk
        robe = self.cls == 'mage'
        for side, leg in (('l', self.leg_l), ('r', self.leg_r)):
            if not robe:
                cyl(f'leg_{side}', P['leather'] if self.cls in ('mercenary', 'archer') else P['teamdark'], leg, (0, 0, -0.17), r=0.075, depth=0.3)
            box(f'boot_{side}', P['boot'], leg, (0, -0.035, -0.37), (0.15, 0.22, 0.12), bevel=0.04)
        torso_mat = P['team']
        sphere('torso_m', torso_mat, self.torso, (0, 0, 0.27), (0.29 * b, 0.22 * b, 0.33))
        torus('belt', P['leather'], self.torso, (0, 0, 0.1), R=0.255 * b, r=0.04, scale=(1, 0.78, 1))
        box('buckle', P['gold'], self.torso, (0, -0.2 * b, 0.1), (0.08, 0.03, 0.07), outline=0.01, bevel=0.01)
        sphere('head', P['skin'], self.neck, (0, 0, 0.3), (0.36, 0.34, 0.34))
        for side, x in (('l', 0.12), ('r', -0.12)):
            sphere(f'eye_{side}', P['eye'], self.neck, (x, -0.3, 0.3), (0.055, 0.035, 0.075), outline=0)
            sphere(f'shine_{side}', P['white'], self.neck, (x + 0.018, -0.33, 0.33), (0.018, 0.012, 0.022), outline=0)
            sphere(f'ear_{side}', P['skin'], self.neck, (x * 2.9, 0.0, 0.29), (0.06, 0.05, 0.08))
        sphere('nose', P['skin'], self.neck, (0, -0.34, 0.25), (0.045, 0.04, 0.04), outline=0.012)
        for side, arm, hand in (('l', self.arm_l, self.hand_l), ('r', self.arm_r, self.hand_r)):
            sphere(f'shoulder_{side}', P['team'], arm, (0, 0, -0.02), (0.1 * b, 0.1 * b, 0.1 * b))
            cyl(f'arm_{side}', P['skin'] if self.cls in ('barbarian',) else P['team'], arm, (0, 0, -0.16), r=0.06 * b, depth=0.26)
            sphere(f'hand_{side}', P['skin'], hand, (0, 0, 0), (0.08, 0.08, 0.08))

    # --- classes
    def build_warrior(self):
        P = self.P
        sphere('chest', P['metal'], self.torso, (0, -0.03, 0.33), (0.27, 0.2, 0.24))
        for side, x in (('l', 1), ('r', -1)):
            sphere(f'pauldron_{side}', P['metal'], self.arm_l if x > 0 else self.arm_r, (0, 0, 0.02), (0.15, 0.15, 0.11))
        sphere('helmet', P['metal'], self.neck, (0, 0.03, 0.44), (0.385, 0.37, 0.26))
        box('nasal', P['metal'], self.neck, (0, -0.35, 0.4), (0.05, 0.03, 0.16), bevel=0.015)
        sphere('plume', P['team'], self.neck, (0, 0.1, 0.72), (0.07, 0.24, 0.13))
        # Espada na mão direita, lâmina ao longo de +Z do pivô da mão.
        w = empty('weapon', self.hand_r, (0, 0, 0), (R(35), 0, R(-20)))
        self.weapon = w
        cyl('grip', P['leather'], w, (0, 0, 0.02), r=0.03, depth=0.18)
        box('guard', P['gold'], w, (0, 0, 0.12), (0.24, 0.06, 0.05), bevel=0.015)
        box('blade', P['metal'], w, (0, 0, 0.47), (0.09, 0.025, 0.62), bevel=0.01)
        sphere('pommel', P['gold'], w, (0, 0, -0.09), (0.045, 0.045, 0.045))
        # Escudo no braço esquerdo.
        s = empty('shield', self.hand_l, (0.03, -0.12, 0.08), (R(90), 0, 0))
        cyl('shield_face', P['team'], s, (0, 0, 0), r=0.27, depth=0.05, scale=(1, 1.15, 1))
        torus('shield_rim', P['metal'], s, (0, 0, 0.0), R=0.27, r=0.03, scale=(1, 1.15, 1))
        sphere('shield_boss', P['gold'], s, (0, 0, -0.04), (0.09, 0.09, 0.05))
        self.style = 'swing'

    def build_barbarian(self):
        P = self.P
        sphere('fur_collar', P['fur'], self.torso, (0, 0.02, 0.5), (0.36, 0.28, 0.13))
        box('strap', P['leather'], self.torso, (0, -0.21, 0.3), (0.08, 0.04, 0.6), rot=(0, R(35), 0), bevel=0.01, outline=0.012)
        sphere('beard', P['beard_red'], self.neck, (0, -0.24, 0.12), (0.27, 0.15, 0.2))
        sphere('helmet', P['darkmetal'], self.neck, (0, 0.02, 0.42), (0.37, 0.35, 0.24))
        for side, x in (('l', 1), ('r', -1)):
            cone(f'horn_{side}', P['bone'], self.neck, (0.36 * x, 0, 0.6), r1=0.08, depth=0.36, rot=(0, R(-40 * x), 0))
        w = empty('weapon', self.hand_r, (0, 0, 0), (R(30), 0, R(-25)))
        self.weapon = w
        cyl('haft', P['wood'], w, (0, 0, 0.25), r=0.035, depth=0.95)
        for side in (1, -1):
            cyl(f'axe_{side}', P['metal'], w, (0.17 * side, 0, 0.6), r=0.2, depth=0.04, rot=(R(90), 0, 0), scale=(0.9, 1.25, 1), verts=24)
        box('axe_core', P['darkmetal'], w, (0, 0, 0.6), (0.14, 0.08, 0.2), bevel=0.02)
        self.style = 'swing'

    def build_mage(self):
        P = self.P
        cone('robe', P['purple'], self.hips, (0, 0, -0.14), r1=0.34, r2=0.24, depth=0.62)
        torus('robe_trim', P['team'], self.hips, (0, 0, -0.43), R=0.335, r=0.035)
        sphere('beard', P['beard_white'], self.neck, (0, -0.22, 0.08), (0.2, 0.14, 0.28))
        cyl('hat_brim', P['purple'], self.neck, (0, 0, 0.5), r=0.5, depth=0.05)
        cone('hat', P['purple'], self.neck, (0, 0.08, 0.92), r1=0.31, depth=0.85, rot=(R(12), 0, 0))
        torus('hat_band', P['team'], self.neck, (0, 0, 0.53), R=0.29, r=0.04)
        sphere('hat_star', P['gold'], self.neck, (0, -0.28, 0.66), (0.06, 0.03, 0.06), outline=0.01)
        w = empty('weapon', self.hand_r, (0, 0, 0), (R(15), 0, 0))
        self.weapon = w
        cyl('staff', P['wood'], w, (0, 0, 0.3), r=0.035, depth=1.25)
        torus('orb_ring', P['gold'], w, (0, 0, 0.98), R=0.11, r=0.025, rot=(R(90), 0, 0))
        sphere('orb', P['orb'], w, (0, 0, 1.0), (0.1, 0.1, 0.1), outline=0.012)
        self.style = 'cast'

    def build_archer(self):
        P = self.P
        sphere('vest', P['green'], self.torso, (0, -0.02, 0.3), (0.27, 0.2, 0.27))
        sphere('hood', P['green_dark'], self.neck, (0, 0.06, 0.34), (0.4, 0.38, 0.38))
        cone('hood_tip', P['green_dark'], self.neck, (0, 0.33, 0.5), r1=0.14, depth=0.3, rot=(R(-60), 0, 0))
        box('cape', P['team'], self.torso, (0, 0.22, 0.22), (0.46, 0.04, 0.55), rot=(R(-8), 0, 0), bevel=0.02)
        q = empty('quiver', self.torso, (0.12, 0.26, 0.35), (R(-20), R(25), 0))
        cyl('quiver_body', P['leather'], q, (0, 0, 0), r=0.08, depth=0.5)
        for i, x in enumerate((-0.03, 0.0, 0.03)):
            cone(f'fletch_{i}', P['feather'], q, (x, 0, 0.3), r1=0.03, depth=0.12, outline=0.008)
        w = empty('weapon', self.hand_l, (0, 0, 0), (R(90), 0, 0))
        self.weapon = w
        pts = [(0, -0.05, -0.55), (0, 0.18, -0.28), (0, 0.24, 0), (0, 0.18, 0.28), (0, -0.05, 0.55)]
        arc_curve('bow', P['wood'], w, pts, bevel=0.028)
        cyl('string', P['white'], w, (0, -0.05, 0), r=0.006, depth=1.1, outline=0)
        self.style = 'shoot'

    def build_mercenary(self):
        P = self.P
        sphere('vest', P['shadowcloth'], self.torso, (0, -0.02, 0.3), (0.26, 0.19, 0.27))
        torus('sash', P['team'], self.torso, (0, 0, 0.3), R=0.23, r=0.04, rot=(0, R(35), 0), scale=(1, 0.8, 1))
        sphere('hood', P['shadowcloth'], self.neck, (0, 0.05, 0.36), (0.39, 0.37, 0.35))
        box('mask', P['shadowcloth'], self.neck, (0, -0.25, 0.18), (0.56, 0.2, 0.16), bevel=0.06)
        for side, hand in (('r', self.hand_r), ('l', self.hand_l)):
            w = empty(f'dagger_{side}', hand, (0, 0, 0), (R(50), 0, 0))
            if side == 'r':
                self.weapon = w
            box(f'dguard_{side}', P['violet'], w, (0, 0, 0.07), (0.14, 0.05, 0.04), bevel=0.01, outline=0.012)
            box(f'dblade_{side}', P['metal'], w, (0, 0, 0.26), (0.06, 0.02, 0.32), bevel=0.008, outline=0.012)
        self.style = 'swing'

    def build_halberdier(self):
        P = self.P
        sphere('breastplate', P['bronze'], self.torso, (0, -0.03, 0.33), (0.27, 0.2, 0.25))
        for side, arm in (('l', self.arm_l), ('r', self.arm_r)):
            sphere(f'pauldron_{side}', P['bronze'], arm, (0, 0, 0.02), (0.14, 0.14, 0.1))
        cyl('hat_brim', P['bronze'], self.neck, (0, 0, 0.5), r=0.43, depth=0.05)
        sphere('hat_dome', P['bronze'], self.neck, (0, 0, 0.52), (0.33, 0.33, 0.25))
        torus('hat_band', P['team'], self.neck, (0, 0, 0.55), R=0.33, r=0.035)
        w = empty('weapon', self.hand_r, (0, 0, 0), (R(15), 0, 0))
        self.weapon = w
        cyl('pole', P['wood'], w, (0, 0, 0.35), r=0.035, depth=1.8)
        cyl('blade', P['metal'], w, (0.13, 0, 1.08), r=0.17, depth=0.035, rot=(R(90), 0, 0), scale=(1, 1.4, 1), verts=24)
        cone('spike', P['metal'], w, (0, 0, 1.36), r1=0.06, depth=0.3)
        cone('hook', P['metal'], w, (-0.12, 0, 1.08), r1=0.04, depth=0.2, rot=(0, R(-90), 0))
        sphere('tassel', P['team'], w, (0, 0, 0.88), (0.06, 0.06, 0.08))
        self.style = 'thrust'

    # --- poses
    def reset(self):
        for o in (self.root, self.hips, self.torso, self.neck, self.leg_l, self.leg_r, self.arm_l, self.arm_r, self.hand_l, self.hand_r):
            o.rotation_euler = (0, 0, 0)
        self.hips.location = (0, 0, 0.42)
        self.root.location = (0, 0, 0)
        self.base_pose()

    def base_pose(self):
        """Pose neutra por estilo (arma visível e legível)."""
        s = self.style
        if s == 'swing':
            self.arm_r.rotation_euler = (R(-35), R(0), R(-12))
            self.arm_l.rotation_euler = (R(-25), 0, R(14))
        elif s == 'cast':
            self.arm_r.rotation_euler = (R(-30), 0, R(-18))
            self.arm_l.rotation_euler = (R(-10), 0, R(10))
        elif s == 'shoot':
            self.arm_l.rotation_euler = (R(-45), 0, R(15))
            self.arm_r.rotation_euler = (R(-15), 0, R(-10))
        elif s == 'thrust':
            self.arm_r.rotation_euler = (R(-40), 0, R(-15))
            self.arm_l.rotation_euler = (R(-50), 0, R(25))

    def pose(self, anim, t):
        """t em [0, 1)."""
        self.reset()
        w = 2 * math.pi * t
        if anim == 'idle':
            self.hips.location.z = 0.42 + 0.015 * math.sin(w)
            self.neck.rotation_euler.x = R(3 * math.sin(w))
            self.arm_l.rotation_euler.x += R(4 * math.sin(w))
            self.arm_r.rotation_euler.x += R(4 * math.sin(w + 1))
        elif anim == 'run':
            self.hips.location.z = 0.42 + 0.05 * abs(math.sin(w))
            self.torso.rotation_euler.x = R(-10)
            self.leg_l.rotation_euler.x = R(38 * math.sin(w))
            self.leg_r.rotation_euler.x = R(-38 * math.sin(w))
            self.arm_l.rotation_euler.x += R(-28 * math.sin(w))
            self.arm_r.rotation_euler.x += R(20 * math.sin(w))
        elif anim == 'attack':
            k = t
            if self.style == 'swing':
                # prepara acima da cabeça e golpeia para a frente
                keys = [(0, -35), (0.25, -150), (0.45, -160), (0.6, -30), (0.75, 5), (1, -35)]
                self.arm_r.rotation_euler.x = R(interp(keys, k))
                self.arm_r.rotation_euler.z = R(interp([(0, -12), (0.45, -30), (0.7, 20), (1, -12)], k))
                self.torso.rotation_euler.z = R(interp([(0, 0), (0.4, 20), (0.7, -25), (1, 0)], k))
                self.torso.rotation_euler.x = R(interp([(0, 0), (0.6, -12), (1, 0)], k))
            elif self.style == 'thrust':
                keys = [(0, 0), (0.3, 0.12), (0.55, -0.32), (0.8, -0.1), (1, 0)]
                lunge = interp(keys, k)
                self.arm_r.rotation_euler.x = R(-40 - 50 * max(0, -lunge) / 0.32)
                self.arm_l.rotation_euler.x = R(-50 - 40 * max(0, -lunge) / 0.32)
                self.hips.location.y = lunge
                self.torso.rotation_euler.x = R(interp([(0, 0), (0.55, -18), (1, 0)], k))
            elif self.style == 'cast':
                self.arm_r.rotation_euler.x = R(interp([(0, -30), (0.3, -150), (0.55, -95), (1, -30)], k))
                self.torso.rotation_euler.x = R(interp([(0, 0), (0.3, 8), (0.55, -10), (1, 0)], k))
                self.arm_l.rotation_euler.x = R(interp([(0, -10), (0.5, -70), (1, -10)], k))
            elif self.style == 'shoot':
                self.arm_l.rotation_euler.x = R(interp([(0, -45), (0.25, -88), (0.8, -88), (1, -45)], k))
                self.arm_r.rotation_euler.x = R(interp([(0, -15), (0.25, -80), (0.55, -75), (0.6, -30), (1, -15)], k))
                self.arm_r.rotation_euler.z = R(interp([(0, -10), (0.25, 25), (0.55, 60), (0.65, -10), (1, -10)], k))
        elif anim == 'hurt':
            amt = math.sin(math.pi * t)
            self.torso.rotation_euler.x = R(18 * amt)
            self.neck.rotation_euler.x = R(15 * amt)
            self.arm_l.rotation_euler.z += R(25 * amt)
            self.arm_r.rotation_euler.z -= R(25 * amt)
        elif anim == 'death':
            k = min(1.0, t * 1.15)
            fall = k * k
            self.root.rotation_euler.x = R(-88 * fall)
            self.root.location.z = 0.12 * math.sin(math.pi * k) * (1 - fall)
            self.arm_l.rotation_euler.z += R(60 * k)
            self.arm_r.rotation_euler.z -= R(60 * k)
            self.neck.rotation_euler.x = R(-20 * k)


def interp(keys, t):
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0) if t1 > t0 else 0
            u = u * u * (3 - 2 * u)
            return v0 + (v1 - v0) * u
    return keys[-1][1]

# ---------------------------------------------------------------- cena

def setup_scene():
    global COLL
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    COLL = scene.collection
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.cycles.transparent_max_bounces = 16
    scene.render.film_transparent = True
    scene.render.resolution_x = FRAME
    scene.render.resolution_y = FRAME
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.render.threads_mode = 'AUTO'

    world = bpy.data.worlds.new('world')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.62, 0.68, 0.8, 1)
    bg.inputs['Strength'].default_value = 0.9

    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 3.2
    sun.angle = R(25)
    so = link(bpy.data.objects.new('sun', sun))
    so.rotation_euler = (R(40), R(-25), R(-35))
    rim = bpy.data.lights.new('rim', 'SUN')
    rim.energy = 1.4
    ro = link(bpy.data.objects.new('rim', rim))
    ro.rotation_euler = (R(-60), 0, R(20))

    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = ORTHO_SCALE
    cam = link(bpy.data.objects.new('cam', cam_data))
    el = R(ELEVATION)
    ppu = FRAME / ORTHO_SCALE
    # Mira acima da origem para que os pés fiquem em ORIGIN_Y.
    h = (ORIGIN_Y - FRAME / 2) / ppu / math.cos(el)
    target = Vector((0, 0, h))
    cam.location = target + Vector((0, -math.cos(el), math.sin(el))) * 20
    cam.rotation_euler = (R(90 - ELEVATION), 0, 0)
    scene.camera = cam
    return scene


def add_outline(im):
    """Contorno escuro ao redor da silhueta: legibilidade em combates cheios."""
    from PIL import Image, ImageFilter
    alpha = im.getchannel('A').point(lambda a: 255 if a > 40 else 0)
    grown = alpha.filter(ImageFilter.MaxFilter(OUTLINE_PX * 2 + 1)).filter(ImageFilter.GaussianBlur(0.6))
    base = Image.new('RGBA', im.size, OUTLINE_RGB + (0,))
    base.putalpha(grown)
    base.alpha_composite(im)
    return base


def render_class(cls, teams, preview, out_root, tmp):
    from PIL import Image

    for team in teams:
        scene = setup_scene()
        rig = Rig(cls, team)
        if team == teams[0]:
            src = os.path.join(ROOT, 'assets', 'source', 'characters')
            os.makedirs(src, exist_ok=True)
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(src, f'{cls}.blend'), compress=True)
        for anim, frames in ANIMS.items():
            n = 1 if preview else frames
            sheet = Image.new('RGBA', (FRAME * n, FRAME * len(DIR_ORDER)), (0, 0, 0, 0))
            for row, d in enumerate(DIR_ORDER):
                for i in range(n):
                    t = i / frames if anim in ('idle', 'run') else i / max(1, frames - 1)
                    if preview:
                        t = 0.45 if anim in ('attack', 'death') else 0.25
                    rig.pose(anim, t)
                    rig.root.rotation_euler.z = R(DIRECTIONS[d])
                    path = os.path.join(tmp, f'f.png')
                    scene.render.filepath = path
                    bpy.ops.render.render(write_still=True)
                    sheet.paste(add_outline(Image.open(path).convert('RGBA')), (i * FRAME, row * FRAME))
            out_dir = os.path.join(out_root, cls)
            os.makedirs(out_dir, exist_ok=True)
            name = f'{cls}_{team}_{anim}{"_preview" if preview else ""}.png'
            sheet.save(os.path.join(out_dir, name), optimize=True)
            print(f'[ok] {cls} {team} {anim}', flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--classes', default=','.join(CLASSES))
    ap.add_argument('--teams', default='blue,red')
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets', 'characters'))
    args = ap.parse_args(argv)
    tmp = tempfile.mkdtemp()
    try:
        for cls in args.classes.split(','):
            render_class(cls, args.teams.split(','), args.preview, args.out, tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
