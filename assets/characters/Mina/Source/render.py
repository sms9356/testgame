# 미리보기 렌더: 정면 · 측면 · 후면 · 3/4 · 얼굴 (Cycles)
import bpy, sys, os, math, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]; blend, out = argv[0], argv[1]; views = argv[2].split(',') if len(argv) > 2 else ['front', 'side', 'back', 'q34', 'face']
samples = int(argv[3]) if len(argv) > 3 else 32
bpy.ops.wm.open_mainfile(filepath=blend); sc = bpy.context.scene
ACT = os.environ.get('ACT')
for a in [o for o in bpy.data.objects if o.type == 'ARMATURE']:
    if a.animation_data: a.animation_data.action = bpy.data.actions[ACT] if ACT else None
    if ACT: sc.frame_set(int(os.environ.get('FRAME', '1')))
    else:
        for pb in a.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
sc.render.engine = 'CYCLES'; sc.cycles.samples = samples; sc.cycles.device = 'CPU'; sc.render.resolution_x = 720; sc.render.resolution_y = 960; sc.view_settings.view_transform = 'AgX'
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.32, .34, .38, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .6
for nm, loc, en, sz in [('key', (1.6, -2.4, 2.6), 400, 2.0), ('fill', (-2.2, -1.6, 1.6), 140, 2.5), ('rim', (0.5, 2.6, 2.4), 250, 1.5)]:
    ld = bpy.data.lights.new(nm, 'AREA'); ld.energy = en; ld.size = sz; lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (mathutils.Vector((0, 0, 1.0)) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=10); fl = bpy.context.object; m = bpy.data.materials.new('floor'); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.5, .5, .5, 1); fl.data.materials.append(m)
H = max((o.matrix_world @ mathutils.Vector(c)).z for o in sc.objects if o.type == 'MESH' and o.name != 'Plane' for c in o.bound_box)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
def look(loc, tgt): cam.location = loc; cam.rotation_euler = (mathutils.Vector(tgt) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
V = {'front': ((0, -4.2, H * .55), (0, 0, H * .5), 50), 'side': ((4.2, 0, H * .55), (0, 0, H * .5), 50), 'back': ((0, 4.2, H * .55), (0, 0, H * .5), 50),
     'q34': ((2.6, -3.3, H * .62), (0, 0, H * .5), 50), 'face': ((0.35, -0.95, H * .93), (0, 0, H * .925), 85), 'faceside': ((1.0, -0.2, H * .93), (0, 0, H * .925), 85)}
for v in views:
    l, t, lens = V[v]; cam.data.lens = lens; look(l, t); sc.render.filepath = f'{out}_{v}.png'; bpy.ops.render.render(write_still=True); print('RENDERED', v)
