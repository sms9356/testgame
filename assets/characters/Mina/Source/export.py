# 캐릭터 내보내기: .blend · GLB(게임: WebP 텍스처 · 스킨 · 모프 · 동작) · FBX · OBJ · LOD1/LOD2 GLB → 다시 가져와 검사
import bpy, sys, os, json, shutil
argv = sys.argv[sys.argv.index('--') + 1:]; src, outdir, name, rig = argv[0], argv[1], argv[2], argv[3]
os.makedirs(outdir, exist_ok=True); R = {}
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects[rig]; arm.animation_data.action = None
for pb in arm.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(outdir, f'{name}.blend'), copy=True)
def stats():
    dg = bpy.context.evaluated_depsgraph_get(); ms = [o for o in bpy.data.objects if o.type == 'MESH']; tris = 0
    for o in ms:
        me = o.data; me.calc_loop_triangles(); tris += len(me.loop_triangles)
    return {'meshes': len(ms), 'triangles': tris, 'bones': sum(len(o.data.bones) for o in bpy.data.objects if o.type == 'ARMATURE'),
            'materials': len({s.material.name for o in ms for s in o.material_slots if s.material}), 'actions': sorted(a.name for a in bpy.data.actions),
            'shape_keys': sorted({k.name for o in ms if o.data.shape_keys for k in o.data.shape_keys.key_blocks}), 'images': sorted({(i.name, i.size[0]) for i in bpy.data.images if i.size[0]})}
R['source'] = stats()
GL = dict(export_format='GLB', export_yup=True, export_skins=True, export_morph=True, export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_image_format='WEBP', export_image_quality=86, export_apply=False)
bpy.ops.export_scene.gltf(filepath=os.path.join(outdir, f'{name}.glb'), **GL)
bpy.ops.export_scene.fbx(filepath=os.path.join(outdir, f'{name}.fbx'), path_mode='COPY', embed_textures=True, add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False, axis_forward='-Z', axis_up='Y')
bpy.ops.wm.obj_export(filepath=os.path.join(outdir, f'{name}.obj'), export_selected_objects=False, apply_modifiers=False, path_mode='COPY', export_materials=True)
# LOD: 표정 모프 없이 감쇠 (LOD1 50% · LOD2 25%)
for lod, ratio in (('lod1', .5), ('lod2', .25)):
    bpy.ops.wm.open_mainfile(filepath=src); a2 = bpy.data.objects[rig]; a2.animation_data.action = None
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        if o.data.shape_keys:
            bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.shape_key_remove(all=True); o.select_set(False)
        if len(o.data.polygons) > 400:
            md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = ratio; bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_move_to_index(modifier='dec', index=0); bpy.ops.object.modifier_apply(modifier='dec')
    R[lod] = stats(); bpy.ops.export_scene.gltf(filepath=os.path.join(outdir, f'{name}_{lod}.glb'), **GL)
# 재임포트 검사
for f in (f'{name}.glb', f'{name}.fbx', f'{name}.obj', f'{name}.blend'):
    p = os.path.join(outdir, f)
    if f.endswith('.blend'): bpy.ops.wm.open_mainfile(filepath=p)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        if f.endswith('.glb'): bpy.ops.import_scene.gltf(filepath=p)
        elif f.endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=p)
        else: bpy.ops.wm.obj_import(filepath=p)
    s = stats(); import mathutils
    zs = [(o.matrix_world @ mathutils.Vector(c)).z for o in bpy.data.objects if o.type == 'MESH' for c in o.bound_box]
    s['height_m'] = round(max(zs) - min(zs), 3); s['size_mb'] = round(os.path.getsize(p) / 1e6, 2); s.pop('images', None); R['reimport_' + f] = s
json.dump(R, open(os.path.join(outdir, 'export_report.json'), 'w'), ensure_ascii=False, indent=1)
for k, v in R.items(): print('REPORT', k, {kk: (vv if not isinstance(vv, list) or len(vv) < 12 else f'{len(vv)} items') for kk, vv in v.items()})
