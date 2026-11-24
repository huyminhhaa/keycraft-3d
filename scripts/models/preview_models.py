"""
Render ảnh xem trước switch.glb / case.glb (kiểm tra hình dạng nhanh, không cần mở Blender):

    blender -b --factory-startup -P scripts/models/preview_models.py -- switch public/models/switch.glb out.png
    blender -b --factory-startup -P scripts/models/preview_models.py -- case public/models/case.glb out.png
"""

import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
KIND, GLB, OUT = argv[0], argv[1], argv[2]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
meshes = {o.name: o for o in bpy.context.scene.objects if o.type == "MESH"}


def material(name, color, rough, metal=0.0, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Transmission Weight"].default_value = transmission
    return m


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


if KIND == "switch":
    assign(meshes["switch_top"], material("pc", (0.9, 0.9, 0.92), 0.08, transmission=0.95))
    assign(meshes["switch_bottom"], material("nylon", (0.02, 0.02, 0.025), 0.45))
    assign(meshes["switch_stem"], material("stem", (0.6, 0.05, 0.04), 0.4))
    assign(meshes["switch_spring"], material("steel", (0.8, 0.8, 0.82), 0.25, metal=1.0))
    # Bản thứ hai tách rời (exploded) đặt cạnh để thấy từng bộ phận
    for name, dy in [("switch_top", 0.16), ("switch_stem", 0.09), ("switch_spring", 0.02), ("switch_bottom", -0.06)]:
        src = meshes[name]
        copy = src.copy()
        copy.data = src.data.copy()
        copy.location = (0.55, 0, dy)
        bpy.context.collection.objects.link(copy)
    target, distance, lens = Vector((0.27, 0, 0.03)), 1.35, 60
else:
    assign(meshes["case_template"], material("anodized", (0.35, 0.02, 0.03), 0.38, metal=0.92))
    # Soi góc trước-phải: mép vát kim cương, bo đáy, vát miệng lỗ khoang
    target, distance, lens = Vector((1.55, -1.55, 0.75)), 1.5, 35

for loc, size, energy in [((-2, -2, 3), 3, 600), ((2.5, 1.5, 2), 2, 250), ((0, 3, 1.2), 4, 150)]:
    bpy.ops.object.light_add(type="AREA", location=loc)
    light = bpy.context.active_object
    light.data.size = size
    light.data.energy = energy
    light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()

direction = Vector((0.55, -1.0, 0.75)).normalized()
bpy.ops.object.camera_add(location=target + direction * distance)
cam = bpy.context.active_object
cam.data.lens = lens
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam

world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.25, 0.25, 0.27, 1)
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.device = "CPU"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.view_settings.view_transform = "AgX"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("[preview] ->", OUT)
