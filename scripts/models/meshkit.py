"""
Hàm dùng chung cho các script dựng model Blender của KeyCraft (vỏ, switch).

Quy ước toạ độ: viết theo hệ three.js (x phải, y lên, z hướng về người dùng), đổi sang Blender
(X, Y, Z) = (x, -z, y). Trình xuất glTF (Y-up) đổi ngược lại đúng hệ three.js.
"""

import math

import bmesh
import bpy


def outline(hx, hz, r, segments=12):
    """
    Viền chữ nhật bo góc nửa rộng hx, nửa sâu hz, bán kính r. Thứ tự cố định (mọi vòng cùng số điểm):
    góc trước-phải -> giữa cạnh trước (x = 0) -> góc trước-trái -> giữa cạnh trái (z = 0)
    -> góc sau-trái -> giữa cạnh sau -> góc sau-phải -> giữa cạnh phải.
    Chỉ có điểm ở góc và đúng giữa các cạnh thẳng: web kéo giãn phần giữa không làm gập tam giác.
    """
    r = max(1e-4, min(r, hx - 1e-5, hz - 1e-5))
    cx, cz = hx - r, hz - r
    pts = []

    def corner(ccx, ccz, start):
        for s in range(segments + 1):
            a = start + (s / segments) * (math.pi / 2)
            pts.append((ccx + r * math.cos(a), ccz + r * math.sin(a)))

    corner(cx, cz, 0.0)
    pts.append((0.0, hz))
    corner(-cx, cz, math.pi / 2)
    pts.append((-hx, 0.0))
    corner(-cx, -cz, math.pi)
    pts.append((0.0, -hz))
    corner(cx, -cz, 3 * math.pi / 2)
    pts.append((hx, 0.0))
    return pts


class Builder:
    """Gom các vòng viền thành lưới kín (bmesh), toạ độ theo hệ three.js."""

    def __init__(self):
        self.bm = bmesh.new()

    def vert(self, x, y, z):
        return self.bm.verts.new((x, -z, y))

    def ring(self, hx, hz, r, y, segments=12, dx=0.0, dz=0.0):
        """Một vòng viền ở độ cao y (y có thể là hàm của (x, z))."""
        out = []
        for (x, z) in outline(hx, hz, r, segments):
            yy = y(x, z) if callable(y) else y
            out.append(self.vert(x + dx, yy, z + dz))
        return out

    def stitch(self, a, b):
        n = len(a)
        for i in range(n):
            j = (i + 1) % n
            self.bm.faces.new((a[i], a[j], b[j], b[i]))

    def loft(self, rings, closed=False):
        for a, b in zip(rings, rings[1:]):
            self.stitch(a, b)
        if closed:
            self.stitch(rings[-1], rings[0])

    def cap(self, ring, y=None):
        """Đóng một vòng bằng quạt tam giác quanh tâm."""
        cx = sum(v.co.x for v in ring) / len(ring)
        cy = sum(v.co.y for v in ring) / len(ring)
        cz = sum(v.co.z for v in ring) / len(ring)
        center = self.bm.verts.new((cx, cy, cz))
        n = len(ring)
        for i in range(n):
            self.bm.faces.new((ring[i], ring[(i + 1) % n], center))

    def finish(self, name):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj


def add_box(name, sx, sy, sz, x, y, z, bevel=0.0):
    """Hộp kích thước (sx, sy, sz) theo hệ three.js, tâm tại (x, y, z), bo cạnh nếu bevel > 0."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, -z, y))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "NONE"
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def add_cylinder(name, radius, height, x, y, z, vertices=24, bevel=0.0):
    """Trụ đứng (theo trục y của three.js), tâm tại (x, y, z)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=height, location=(x, -z, y))
    obj = bpy.context.active_object
    obj.name = name
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def join(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    return obj


def shade(obj, angle_deg):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle_deg))


def bake_transforms(objects):
    """
    Nướng vị trí / xoay / tỉ lệ của object vào lưới. Web chỉ đọc geometry của mesh (không đọc
    transform của node glTF), nên mọi đỉnh phải nằm sẵn đúng toạ độ.
    """
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def export_glb(objects, path):
    bake_transforms(objects)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=False,
        export_materials="NONE",
        export_animations=False,
    )
    verts = sum(len(o.data.vertices) for o in objects)
    return verts
