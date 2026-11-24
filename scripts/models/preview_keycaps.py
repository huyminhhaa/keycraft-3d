"""
Render ảnh xem trước keycaps.glb (kiểm tra hình dạng nhanh, không cần mở Blender):

    blender -b --factory-startup -P scripts/models/preview_keycaps.py -- public/models/keycaps.glb <out.png>
"""

import math
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, OUT = argv[0], argv[1]
VIEW = argv[2] if len(argv) > 2 else "lineup"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
meshes = {o.name: o for o in bpy.context.scene.objects if o.type == "MESH"}

pbt = bpy.data.materials.new("pbt")
pbt.use_nodes = True
bsdf = pbt.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.02, 0.02, 0.022, 1)
bsdf.inputs["Roughness"].default_value = 0.62
red = pbt.copy()
red.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.45, 0.02, 0.03, 1)

for o in meshes.values():
    o.hide_render = True

lineup = [
    ("keycap_cherry_r1", pbt), ("keycap_cherry_r2", pbt), ("keycap_cherry_r3", red),
    ("keycap_cherry_r4", pbt), ("keycap_moa_r3", red), ("keycap_sa_r3", pbt),
]
pitch = 0.42
for i, (name, mat) in enumerate(lineup):
    o = meshes[name].copy()
    o.data = meshes[name].data.copy()
    o.data.materials.clear()
    o.data.materials.append(mat)
    o.location = ((i - (len(lineup) - 1) / 2) * pitch, 0, 0)
    o.hide_render = False
    bpy.context.collection.objects.link(o)

# Một keycap lật ngửa để thấy ruột rỗng + trụ chữ thập
flip = meshes["keycap_cherry_r3"].copy()
flip.data = meshes["keycap_cherry_r3"].data.copy()
flip.data.materials.append(pbt)
flip.rotation_mode = "XYZ"  # glTF importer dùng quaternion
flip.rotation_euler = (math.pi, 0, 0)
flip.location = (0.2, -0.55, 0.2)
flip.hide_render = False
bpy.context.collection.objects.link(flip)
stem = meshes["keycap_stem"].copy()
stem.data = meshes["keycap_stem"].data.copy()
stem.data.materials.append(pbt)
stem.scale = (1, 1, 0.1)
stem.rotation_mode = "XYZ"
stem.rotation_euler = (math.pi, 0, 0)
stem.location = (0.2, -0.55, 0.2 - 0.024)
stem.hide_render = False
bpy.context.collection.objects.link(stem)

# Sàn + đèn softbox
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
floor = bpy.context.active_object
fm = bpy.data.materials.new("floor")
fm.use_nodes = True
fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.5, 0.47, 0.43, 1)
floor.data.materials.append(fm)

for loc, size, energy in [((-1.2, -1.0, 2.2), 1.6, 220), ((1.6, 1.2, 1.6), 1.0, 90), ((0, 2.5, 1.0), 2.5, 60)]:
    bpy.ops.object.light_add(type="AREA", location=loc)
    light = bpy.context.active_object
    light.data.size = size
    light.data.energy = energy
    direction = -light.location
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

bpy.ops.object.camera_add(location=(0.0, -3.4, 1.9) if VIEW == "lineup" else (0.2, -0.62, 1.6))
cam = bpy.context.active_object
cam.data.lens = 50 if VIEW == "lineup" else 120
target = bpy.data.objects.new("target", None)
target.location = (0, -0.15, 0.05) if VIEW == "lineup" else (0.2, -0.55, 0.2)
bpy.context.collection.objects.link(target)
track = cam.constraints.new("TRACK_TO")
track.target = target
bpy.context.scene.camera = cam

world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.08, 0.08, 0.09, 1)
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.device = "CPU"
scene.render.resolution_x = 1280
scene.render.resolution_y = 640
scene.view_settings.view_transform = "AgX"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("[preview] ->", OUT)
