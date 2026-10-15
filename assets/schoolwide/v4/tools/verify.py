import bpy, os, math, json, mathutils, sys
B = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(B, 'out')
for bid in sys.argv[sys.argv.index('--') + 1:]:
    d = os.path.join(OUT, bid); res = {}
    for f in [f'{bid}.glb', f'{bid}.fbx', f'{bid}.obj', f'game/v4_{bid}/v4_{bid}.gltf']:
        bpy.ops.wm.read_factory_settings(use_empty=True); p = os.path.join(d, f)
        if f.endswith(('.glb', '.gltf')): bpy.ops.import_scene.gltf(filepath=p)
        elif f.endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=p)
        else: bpy.ops.wm.obj_import(filepath=p)
        ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']; pts = [o.matrix_world @ mathutils.Vector(c) for o in ms for c in o.bound_box]
        mn = [min(v[i] for v in pts) for i in range(3)]; mx = [max(v[i] for v in pts) for i in range(3)]
        imgs = sorted({n.image.name for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image})
        res[f] = {'meshes': len(ms), 'size_m': [round(mx[i] - mn[i], 4) for i in range(3)], 'min_z': round(mn[2], 4), 'materials': sorted({s.material.name for o in ms for s in o.material_slots if s.material}), 'images': imgs, 'uv': [len(o.data.uv_layers) for o in ms]}
        print('REIMPORT', bid, f, res[f])
    json.dump(res, open(os.path.join(d, 'reimport_check.json'), 'w'), ensure_ascii=False, indent=1)
    bpy.ops.wm.open_mainfile(filepath=os.path.join(d, f'{bid}.blend'))
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 40; sc.cycles.device = 'CPU'; sc.render.resolution_x = 800; sc.render.resolution_y = 640
    w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.8
    sc.view_settings.view_transform = 'Standard'
    ld = bpy.data.lights.new('key', 'AREA'); ld.energy = 140; ld.size = 1.5; lo = bpy.data.objects.new('key', ld); sc.collection.objects.link(lo); lo.location = (1.2, -1.4, 1.9); lo.rotation_euler = (math.radians(50), 0, math.radians(40))
    bpy.ops.mesh.primitive_plane_add(size=8); fl = bpy.context.object; m = bpy.data.materials.new('floor'); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.92, 0.92, 0.92, 1); fl.data.materials.append(m)
    obj = [o for o in sc.objects if o.type == 'MESH' and not o.name.endswith('LOD1') and o.name != 'Plane'][0]; h = obj.dimensions.z; r = max(obj.dimensions) * 2.6 + 0.6
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 50
    def look(loc, tgt): cam.location = loc; dd = mathutils.Vector(tgt) - mathutils.Vector(loc); cam.rotation_euler = dd.to_track_quat('-Z', 'Y').to_euler()
    views = {'front': ((0, -r, h * 1.0), (0, 0, h / 2)), 'side': ((r, 0, h * 1.0), (0, 0, h / 2)), 'back': ((0, r, h * 1.0), (0, 0, h / 2)), 'persp': ((r * .62, -r * .76, h * 1.6), (0, 0, h * .5)), 'detail': ((obj.dimensions.x * .55 + .25, -obj.dimensions.y * .5 - .3, h * 1.05), (obj.dimensions.x * .4, 0, h * .8))}
    for n, (l, t) in views.items():
        cam.data.lens = 70 if n == 'detail' else 50; look(l, t); sc.render.filepath = os.path.join(d, f'render_{n}.png'); bpy.ops.render.render(write_still=True)
    print('RENDERED', bid)
