"""
Dựng switch MX bằng Blender rồi xuất public/models/switch.glb.

    blender -b --factory-startup -P scripts/models/build_switch.py -- <switch-specs.json> <out.glb>

Gốc toạ độ: tâm switch, y = 0 tại MẶT TRÊN plate (giống switchGeometry.ts). Gồm 4 bộ phận
(web tô màu riêng từng phần theo switch thật của mỗi mẫu):
  switch_top    : vỏ trên RỖNG, thành 1mm, vuốt thon, bo mép trên, lỗ vuông cho stem, 4 ngàm kẹp
  switch_bottom : vỏ dưới bo cạnh lọt qua plate + 2 lẫy bám plate + trụ định vị giữa + 2 chân nhựa
  switch_stem   : stem chữ thập vát đầu + thân stem có ray trượt
  switch_spring : lò xo xoắn (thấy được qua vỏ trên trong suốt)
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from meshkit import Builder, add_box, add_cylinder, export_glb, join, shade  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
SPEC_PATH, OUT_PATH = argv[0], argv[1]
with open(SPEC_PATH, encoding="utf-8") as f:
    S = json.load(f)

MM = S["mm"]
TOP_H = S["topHousingHeightMm"] * MM
PCB = S["plateToPcbMm"] * MM
STEM_TOP = S["stemTopMm"] * MM


def mm(v):
    return v * MM


def top_housing():
    """Vỏ trên rỗng: mặt ngoài vuốt thon + bo mép trên, lỗ vuông cho stem, ruột rỗng thành 1mm."""
    b = Builder()
    wall = mm(1.0)
    fillet = mm(0.6)
    bx, bz = mm(7.8), mm(7.8)          # đáy 15.6 x 15.6
    tx, tz = mm(5.6), mm(5.8)          # đỉnh 11.2 x 11.6
    hole = mm(3.0)                     # lỗ stem 6 x 6
    rings = [b.ring(bx, bz, mm(0.8), 0.0)]
    # Thành ngoài vuốt thon tới chân bo mép
    for t in (0.5, 1.0):
        x = bx + (tx + fillet - bx) * t
        z = bz + (tz + fillet - bz) * t
        rings.append(b.ring(x, z, mm(0.8) + (mm(1.4) + fillet - mm(0.8)) * t, (TOP_H - fillet) * t))
    # Bo mép trên (cung 1/4 tròn bán kính `fillet`), nối liền với đỉnh thành
    for k in range(1, 4):
        a = (k / 3) * (math.pi / 2)
        off = fillet * math.cos(a)
        rings.append(b.ring(tx + off, tz + off, mm(1.4) + off, TOP_H - fillet + fillet * math.sin(a)))
    # Mặt trên -> miệng lỗ stem -> thành lỗ xuống 1mm
    rings.append(b.ring(hole, hole, mm(0.5), TOP_H))
    rings.append(b.ring(hole, hole, mm(0.5), TOP_H - wall))
    # Trần trong -> thành trong xuống đáy -> vành đáy
    rings.append(b.ring(tx + fillet - wall, tz + fillet - wall, mm(0.9), TOP_H - wall))
    rings.append(b.ring(bx - wall, bz - wall, mm(0.5), 0.0))
    b.loft(rings, closed=True)
    shell = b.finish("switch_top_shell")
    shade(shell, 40)

    # 4 ngàm kẹp hai bên (giữ vỏ trên vào vỏ dưới)
    clips = []
    for side in (-1, 1):
        for z in (-3.6, 3.6):
            clips.append(add_box("clip", mm(1.0), mm(1.8), mm(3.2), side * mm(7.9), mm(1.1), mm(z), bevel=mm(0.2)))
    for c in clips:
        shade(c, 40)
    return join([shell] + clips, "switch_top")


def bottom_housing():
    """Vỏ dưới: khối bo cạnh từ mặt plate xuống PCB, 2 lẫy bám plate, trụ định vị, 2 chân nhựa."""
    b = Builder()
    half = mm(7.0)
    r = mm(0.8)
    f = mm(0.5)
    rings = [
        b.ring(half - f, half - f, r - f, -mm(0.05)),
        b.ring(half, half, r, -mm(0.05) - f),
        b.ring(half, half, r, -PCB + f),
        b.ring(half - f, half - f, r - f, -PCB),
    ]
    b.loft(rings)
    b.cap(rings[0])
    b.cap(rings[-1])
    body = b.finish("switch_bottom_body")
    shade(body, 40)

    parts = [body]
    # Lẫy bám plate ở mặt trước / sau (nhô ra dưới plate)
    for sz in (-1, 1):
        parts.append(add_box("latch", mm(4.0), mm(1.4), mm(0.8), 0, -mm(1.6), sz * mm(7.3), bevel=mm(0.15)))
    # Trụ định vị giữa + 2 chân nhựa xuyên PCB
    parts.append(add_cylinder("pole", mm(1.95), mm(3.0), 0, -PCB - mm(1.5), 0, vertices=24, bevel=mm(0.2)))
    for (x, z) in S["pegsMm"]:
        parts.append(add_cylinder("peg", mm(0.85), mm(3.0), mm(x), -PCB - mm(1.5), mm(z), vertices=16, bevel=mm(0.15)))
    for p in parts[1:]:
        shade(p, 40)
    return join(parts, "switch_bottom")


def stem():
    """Stem: chữ thập MX vát đầu + vách chống bụi + thân stem có 2 ray trượt hai bên."""
    arm_h = STEM_TOP - mm(4.8)
    y = (mm(4.8) + STEM_TOP) / 2
    parts = [
        add_box("arm_x", mm(4.0), arm_h, mm(1.17), 0, y, 0, bevel=mm(0.18)),
        add_box("arm_z", mm(1.17), arm_h, mm(4.0), 0, y, 0, bevel=mm(0.18)),
        # Vách chống bụi ló khỏi vỏ trên
        add_box("dust", mm(5.6), mm(1.2), mm(5.6), 0, mm(4.2), 0, bevel=mm(0.2)),
        # Thân stem trong vỏ (thấy qua vỏ trong) + 2 ray trượt
        add_box("body", mm(5.2), mm(4.6), mm(5.2), 0, mm(1.3), 0, bevel=mm(0.25)),
        add_box("rail", mm(7.2), mm(3.4), mm(1.2), 0, mm(0.9), 0, bevel=mm(0.2)),
    ]
    for p in parts:
        shade(p, 40)
    return join(parts, "switch_stem")


def spring():
    """Lò xo xoắn: ống tròn quét theo đường xoắn ốc quanh trụ định vị."""
    bm = bmesh.new()
    coil_r, wire_r = mm(2.35), mm(0.28)
    y0, y1 = -mm(4.6), mm(2.6)
    turns, per_turn, sides = 7.5, 20, 6
    steps = int(turns * per_turn)
    rings = []
    for s in range(steps + 1):
        a = (s / per_turn) * 2 * math.pi
        y = y0 + (y1 - y0) * s / steps
        cx, cz = coil_r * math.cos(a), coil_r * math.sin(a)
        # Hệ trục tại điểm: hướng bán kính (ra ngoài) và trục y (lên)
        nx, nz = math.cos(a), math.sin(a)
        ring = []
        for k in range(sides):
            phi = 2 * math.pi * k / sides
            ox, oy = wire_r * math.cos(phi), wire_r * math.sin(phi)
            x, z = cx + nx * ox, cz + nz * ox
            ring.append(bm.verts.new((x, -z, y + oy)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for k in range(sides):
            j = (k + 1) % sides
            bm.faces.new((a[k], a[j], b[j], b[k]))
    for ring in (rings[0], rings[-1]):
        bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("switch_spring")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("switch_spring", mesh)
    bpy.context.collection.objects.link(obj)
    shade(obj, 80)
    return obj


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objects = [top_housing(), bottom_housing(), stem(), spring()]
    verts = export_glb(objects, OUT_PATH)
    print(f"[switch] {len(objects)} mesh, {verts} đỉnh -> {OUT_PATH}")


main()
