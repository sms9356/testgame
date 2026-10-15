import bpy, sys, os, json
argv = sys.argv[sys.argv.index('--') + 1:]; mode, src, outdir, name = argv
bpy.ops.wm.open_mainfile(filepath=src)
if mode == 'list':
    out = {im.name: bpy.path.abspath(im.filepath) for im in bpy.data.images if im.source == 'FILE'}
    json.dump(out, open(os.path.join(outdir, 'imgs.json'), 'w'), indent=1); print('LISTED', len(out)); sys.exit(0)
m = json.load(open(os.path.join(outdir, 'map.json')))
for im in bpy.data.images:
    if im.name in m: im.filepath = m[im.name]; im.reload()
bpy.ops.file.make_paths_relative()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(outdir, f'{name}.blend'), relative_remap=True)
bpy.ops.export_scene.fbx(filepath=os.path.join(outdir, f'{name}.fbx'), path_mode='RELATIVE', embed_textures=False, add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False, axis_forward='-Z', axis_up='Y')
bpy.ops.wm.obj_export(filepath=os.path.join(outdir, f'{name}.obj'), export_selected_objects=False, apply_modifiers=False, path_mode='RELATIVE', export_materials=True)
for f in sorted(os.listdir(outdir)): p = os.path.join(outdir, f); print('OUT', f, round(os.path.getsize(p) / 1e6, 2) if os.path.isfile(p) else 'dir')
