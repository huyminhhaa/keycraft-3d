"""
Dựng VỎ MẪU bằng Blender rồi xuất public/models/case.glb (web nắn theo kích thước từng bàn phím).

    blender -b --factory-startup -P scripts/models/build_case.py -- <case-template.json> <out.glb>

Mặt cắt khung vỏ (quét quanh viền bo góc, khép kín):
  đáy ngoài bo tròn -> thành ngoài thẳng -> mép vát kim cương 45° -> mặt trên phẳng
  -> mép vát miệng lỗ khoang -> thành lỗ khoang -> đáy phẳng -> về điểm đầu.
Mép vát được để sắc cạnh (pháp tuyến tách theo góc) để bắt một vệt sáng mảnh dọc viền
như nhôm CNC phay kim cương; góc bo đứng và bo đáy thì mượt.
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from meshkit import Builder, export_glb, shade  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
SPEC_PATH, OUT_PATH = argv[0], argv[1]
with open(SPEC_PATH, encoding="utf-8") as f:
    T = json.load(f)

SEGMENTS = 14


def ring_outer(b, offset, y):
    half = T["outerHalf"] + offset
    return b.ring(half, half, T["outerRadius"] + offset, y, SEGMENTS)


def ring_hole(b, offset, y):
    half = T["holeHalf"] + offset
    return b.ring(half, half, T["holeRadius"] + offset, y, SEGMENTS)


def build():
    b = Builder()
    H = T["height"]
    f, c, hc = T["bottomFillet"], T["topChamfer"], T["holeChamfer"]
    rings = []
    # 1. Bo tròn mép đáy ngoài (cung 1/4)
    for k in range(4):
        theta = (k / 3) * (math.pi / 2)
        rings.append(ring_outer(b, -f * (1 - math.sin(theta)), f * (1 - math.cos(theta))))
    # 2. Đỉnh thành ngoài, ngay dưới mép vát
    rings.append(ring_outer(b, 0.0, H - c))
    # 3. Mép vát kim cương 45° -> mặt trên
    rings.append(ring_outer(b, -c, H))
    # 4. Mặt trên tới miệng lỗ khoang, vát xuống thành lỗ
    rings.append(ring_hole(b, hc, H))
    rings.append(ring_hole(b, 0.0, H - hc))
    # 5. Thành lỗ khoang xuống đáy
    rings.append(ring_hole(b, 0.0, 0.0))
    # 6. Đáy phẳng khép về vòng đầu
    b.loft(rings, closed=True)
    obj = b.finish("case_template")
    # Mép vát 45° và góc 90° giữa đáy / thành lỗ: sắc; cung góc (6.4°/đoạn) và bo đáy: mượt
    shade(obj, 30)
    return obj


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj = build()
    verts = export_glb([obj], OUT_PATH)
    print(f"[case] 1 mesh, {verts} đỉnh -> {OUT_PATH}")


main()
