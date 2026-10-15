# 동작 검사 렌더: (동작, 진행률) 목록 × 시점(3/4 · 옆) — 바닥 z=0 표시
import bpy, sys, os, math, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]; blend, out = argv[0], argv[1]; items = [a.split('@') for a in argv[2].split(',')]; views = argv[3].split(',') if len(argv) > 3 else ['q34', 'side']
bpy.ops.wm.open_mainfile(filepath=blend); sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'CYCLES'
if sc.render.engine == 'CYCLES': sc.cycles.samples = 10; sc.cycles.device = 'CPU'
sc.render.resolution_x = 300; sc.render.resolution_y = 360; sc.view_settings.view_transform = 'AgX'
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.35, .37, .4, 1)
for nm, loc, en in [('key', (1.6, -2.4, 2.6), 450), ('fill', (-2.2, -1.6, 1.6), 160)]:
    ld = bpy.data.lights.new(nm, 'AREA'); ld.energy = en; ld.size = 2; lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (mathutils.Vector((0, 0, 1.0)) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=6); m = bpy.data.materials.new('f'); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.45, .45, .45, 1); bpy.context.object.data.materials.append(m)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 40
V = {'q34': ((2.2, -2.8, 1.1), (0, .1, .6)), 'side': ((3.4, .1, .7), (0, .1, .6)), 'front': ((0, -3.4, .8), (0, 0, .6))}
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for act, u in items:
    a = bpy.data.actions[act]; arm.animation_data.action = a; f0, f1 = a.frame_range; sc.frame_set(int(round(f0 + (f1 - f0) * float(u))))
    for v in views:
        l, t = V[v]; cam.location = l; cam.rotation_euler = (mathutils.Vector(t) - mathutils.Vector(l)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = f'{out}_{act}_{u}_{v}.png'; bpy.ops.render.render(write_still=True)
print('DONE')
