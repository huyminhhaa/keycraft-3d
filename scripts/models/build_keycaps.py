"""
Dựng keycap 1u bằng Blender (chạy nền, không mở giao diện) rồi xuất public/models/keycaps.glb.

    blender -b --factory-startup -P scripts/models/build_keycaps.py -- <keycap-specs.json> <out.glb>

Mỗi keycap (một profile x một hàng) gồm:
  - thành keycap thuôn dần lên trên, hơi phồng ra giữa thân như keycap đúc thật
  - mép trên bo cung tròn bán kính 0.6mm (fillet) -> bắt sáng mềm như nhựa thật, không sắc cạnh kiểu CG
  - mặt lõm (dish) theo ĐÚNG công thức keycapSurfaceY của web (chữ in trên web nằm khít)
  - ruột rỗng: thành dày 1.2mm, nóc dày 1.4mm (thấy được khi tách lớp / nhìn từ dưới)
Thêm node `keycap_stem`: trụ chữ thập cao 1 đơn vị, web co giãn theo chiều cao ruột từng keycap.

Toạ độ: viết theo hệ của three.js (x phải, y lên, z hướng về người dùng) rồi đổi sang Blender
(X, Y, Z) = (x, -z, y); trình xuất glTF (Y-up) đổi ngược lại đúng hệ three.js.
"""

import json
import math
import sys

import bmesh
import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    raise SystemExit("Cách dùng: blender -b -P build_keycaps.py -- <specs.json> <out.glb>")
SPEC_PATH, OUT_PATH = argv[0], argv[1]

with open(SPEC_PATH, encoding="utf-8") as f:
    DATA = json.load(f)

MM = DATA["mm"]
DISH = DATA["dishDepth"]
CORNER_SEGMENTS = 10
FILLET = 0.6 * MM        # bán kính bo mép trên
WALL = 1.2 * MM          # độ dày thành
ROOF = 1.4 * MM          # độ dày nóc
BULGE = 0.22 * MM        # độ phồng thân keycap
STEM_RADIUS = 2.75 * MM  # trụ 5.5mm
CROSS_LONG, CROSS_SHORT = 4.1 * MM, 1.17 * MM


def surface(spec, x, z):
    """Độ cao mặt phím tại (x, z) — bản Python của keycapSurfaceY (1u)."""
    tw, td = spec["topWidth"], spec["topDepth"]
    if spec["dish"] == "spherical":
        r = min(tw, td) / 2
        span = max(0.0, abs(x) - (tw / 2 - r))
        u = span / r
        v = z / (td / 2)
        dish = DISH * max(0.0, 1 - u * u - v * v)
    else:
        u = x / (tw / 2)
        dish = DISH * max(0.0, 1 - u * u)
    return spec["height"] - z * math.tan(spec["tilt"]) - dish


# Điểm chia trên cạnh trước/sau (tỉ lệ so với nửa đoạn thẳng), dày quanh trục giữa x = 0:
# phím dài được kéo giãn đúng tại x = 0, lưới dày ở đây giữ mặt lõm đúng công thức sau khi kéo
EDGE_SPLITS = [0.78, 0.55, 0.35, 0.2, 0.1, 0.04]


def outline(w, d, r):
    """
    Viền chữ nhật bo góc (x, z), thứ tự cố định: góc trước-phải -> cạnh trước -> góc trước-trái
    -> giữa cạnh trái -> góc sau-trái -> cạnh sau -> góc sau-phải -> giữa cạnh phải.
    Luôn có điểm tại x = 0 (trước/sau) và z = 0 (trái/phải). Mọi vòng có cùng số điểm.
    """
    r = max(0.15 * MM, min(r, w / 2 - 0.05 * MM, d / 2 - 0.05 * MM))
    hx, hz = w / 2 - r, d / 2 - r
    pts = []

    def corner(cx, cz, start):
        for s in range(CORNER_SEGMENTS + 1):
            a = start + (s / CORNER_SEGMENTS) * (math.pi / 2)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))

    # x từ +hx giảm dần về -hx (không gồm 2 đầu mút đã nằm trong góc bo)
    across = [hx * g for g in EDGE_SPLITS] + [0.0] + [-hx * g for g in reversed(EDGE_SPLITS)]

    corner(hx, hz, 0.0)                         # trước-phải: (w/2, hz) -> (hx, d/2)
    pts += [(x, d / 2) for x in across]         # cạnh trước, x giảm
    corner(-hx, hz, math.pi / 2)                # trước-trái: (-hx, d/2) -> (-w/2, hz)
    pts.append((-w / 2, 0.0))
    corner(-hx, -hz, math.pi)                   # sau-trái: (-w/2, -hz) -> (-hx, -d/2)
    pts += [(-x, -d / 2) for x in across]       # cạnh sau, x tăng
    corner(hx, -hz, 3 * math.pi / 2)            # sau-phải: (hx, -d/2) -> (w/2, -hz)
    pts.append((w / 2, 0.0))
    return pts


def build_keycap(spec):
    bm = bmesh.new()

    def vert(x, y, z):
        return bm.verts.new((x, -z, y))

    def stitch(a, b):
        n = len(a)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))

    def fan(ring, center):
        n = len(ring)
        for i in range(n):
            bm.faces.new((ring[i], ring[(i + 1) % n], center))

    bw, bd = spec["bottomWidth"], spec["bottomDepth"]
    tw, td = spec["topWidth"], spec["topDepth"]
    cb, ct = spec["cornerBottom"], spec["cornerTop"]

    face_edge = outline(tw, td, ct)                                   # mép mặt phím
    rim = outline(tw + 2 * FILLET, td + 2 * FILLET, ct + FILLET)      # đỉnh thành keycap
    bottom = outline(bw, bd, cb)
    heights = [surface(spec, x, z) for (x, z) in face_edge]
    count = len(face_edge)
    assert len(rim) == count and len(bottom) == count

    # 1. Thành keycap: từ đáy lên đỉnh thành, phồng nhẹ ở giữa thân
    walls = []
    for t in [0.0, 0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.91, 1.0]:
        ring = []
        for i in range(count):
            (bx, bz), (rx, rz) = bottom[i], rim[i]
            x, z = bx + (rx - bx) * t, bz + (rz - bz) * t
            dx, dz = bx - rx, bz - rz
            length = math.hypot(dx, dz) or 1.0
            bulge = BULGE * math.sin(math.pi * t)
            x, z = x + dx / length * bulge, z + dz / length * bulge
            ring.append(vert(x, (heights[i] - FILLET) * t, z))
        walls.append(ring)

    # 2. Bo mép trên: cung 1/4 tròn từ đỉnh thành sang mặt phím
    fillets = []
    for k in range(1, 7):
        theta = (k / 6) * (math.pi / 2)
        off = FILLET * math.cos(theta)
        pts = outline(tw + 2 * off, td + 2 * off, ct + off)
        fillets.append([vert(x, heights[i] - FILLET + FILLET * math.sin(theta), z) for i, (x, z) in enumerate(pts)])

    # 3. Mặt phím lõm: các vòng thu nhỏ dần về tâm
    tops = []
    for s in [0.86, 0.71, 0.56, 0.41, 0.27, 0.13]:
        tops.append([vert(x * s, surface(spec, x * s, z * s), z * s) for (x, z) in face_edge])
    top_center = vert(0.0, surface(spec, 0.0, 0.0), 0.0)

    outer = walls + fillets + tops
    for a, b in zip(outer, outer[1:]):
        stitch(a, b)
    fan(tops[-1], top_center)

    # 4. Ruột rỗng: thành trong + nóc trong (dày đều theo mặt lõm)
    inner_bottom = outline(bw - 2 * WALL, bd - 2 * WALL, max(cb - WALL, 0.3 * MM))
    inner_top = outline(tw + 2 * FILLET - 2 * WALL, td + 2 * FILLET - 2 * WALL, max(ct + FILLET - WALL, 0.3 * MM))
    inner = []
    for t in [0.0, 0.5, 1.0]:
        ring = []
        for i in range(count):
            (bx, bz), (tx, tz) = inner_bottom[i], inner_top[i]
            x, z = bx + (tx - bx) * t, bz + (tz - bz) * t
            ring.append(vert(x, (surface(spec, tx, tz) - ROOF) * t, z))
        inner.append(ring)
    for s in [0.66, 0.33]:
        inner.append([vert(x * s, surface(spec, x * s, z * s) - ROOF, z * s) for (x, z) in inner_top])
    ceiling_center = vert(0.0, surface(spec, 0.0, 0.0) - ROOF, 0.0)
    for a, b in zip(inner, inner[1:]):
        stitch(a, b)
    fan(inner[-1], ceiling_center)

    # 5. Vành đáy nối thành ngoài với thành trong
    stitch(walls[0], inner[0])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(spec["name"])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(spec["name"], mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def build_stem():
    """Trụ chữ thập cao 1 đơn vị (đáy y = 0), web tự co giãn theo chiều cao ruột keycap."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=STEM_RADIUS, depth=1.0, location=(0, 0, 0.5))
    stem = bpy.context.active_object
    stem.name = "keycap_stem"
    for (sx, sy) in [(CROSS_LONG, CROSS_SHORT), (CROSS_SHORT, CROSS_LONG)]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.25))
        cutter = bpy.context.active_object
        cutter.scale = (sx, sy, 0.55)          # lỗ chữ thập sâu ~ nửa chiều cao trụ, mở từ đáy
        mod = stem.modifiers.new("cross", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = cutter
        bpy.context.view_layer.objects.active = stem
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    return stem


def shade(obj, angle_deg):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle_deg))


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    built = []
    for spec in DATA["keycaps"]:
        obj = build_keycap(spec)
        shade(obj, 50)
        built.append(obj)
    stem = build_stem()
    shade(stem, 35)
    built.append(stem)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=OUT_PATH,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=False,
        export_materials="NONE",
        export_animations=False,
    )
    verts = sum(len(o.data.vertices) for o in built)
    print(f"[keycaps] {len(built)} mesh, {verts} đỉnh -> {OUT_PATH}")


main()
