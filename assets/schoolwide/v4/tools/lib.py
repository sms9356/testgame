# V4 실사 소품 공통: Poly Haven CC0 2K PBR (BaseColor · Normal(GL) · ARM = AO/Roughness/Metallic → glTF ORM 그대로) · 부품 헬퍼 · 내보내기 · 통계
import bpy, math, os, json, mathutils
B = os.path.dirname(os.path.abspath(__file__)); TEX = os.environ.get('V4_TEX', os.path.join(B, '..', '..', '..', 'models', 'v4_tex'))   # 게임과 같은 텍스처 (assets/models/v4_tex)
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.context.scene.unit_settings.system = 'METRIC'
def _gltf_out():
    g = bpy.data.node_groups.get('glTF Material Output')
    if g: return g
    g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat'); return g
def pbr(name, tex, metal_scale=1.0, tint=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    img = lambda f, nc: (lambda n: (setattr(n, 'image', bpy.data.images.load(os.path.join(TEX, f))), n.image.colorspace_settings.__setattr__('name', 'Non-Color') if nc else None, n)[-1])(nt.nodes.new('ShaderNodeTexImage'))
    d = img(f'{tex}_diff.jpg', False)
    if tint:
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0; mix.inputs['B'].default_value = (*tint, 1)
        nt.links.new(d.outputs['Color'], mix.inputs['A']); nt.links.new(mix.outputs['Result'], bs.inputs['Base Color'])
    else: nt.links.new(d.outputs['Color'], bs.inputs['Base Color'])
    arm = img(f'{tex}_arm.jpg', True); sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(arm.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], bs.inputs['Roughness']); nt.links.new(sep.outputs['Blue'], bs.inputs['Metallic'])
    n = img(f'{tex}_nor_gl.jpg', True); nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    go = nt.nodes.new('ShaderNodeGroup'); go.node_tree = _gltf_out(); nt.links.new(sep.outputs['Red'], go.inputs['Occlusion'])
    return m
def flat(name, color, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*color, 1); bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = metal; return m
parts = []
def uvbox(o, s):
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.cube_project(cube_size=1.0 / s, correct_aspect=True, scale_to_bounds=False); bpy.ops.object.mode_set(mode='OBJECT'); o.select_set(False)
def box(name, sx, sy, sz, x, y, z, m, bevel=0.0, uvs=1.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z), rotation=rot); o = bpy.context.object; o.name = name; o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    if bevel > 0:
        md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 3; md.limit_method = 'ANGLE'; bpy.ops.object.modifier_apply(modifier='bev')
    o.data.materials.append(m); uvbox(o, uvs * (0.5 if m.name.startswith('V4_steel') else 1)); parts.append(o); return o
def cyl(name, r, d, x, y, z, m, rot=(0, 0, 0), v=16):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, vertices=v, location=(x, y, z), rotation=rot); o = bpy.context.object; o.name = name
    bpy.ops.object.transform_apply(rotation=True); o.data.materials.append(m); uvbox(o, 1.0); parts.append(o); return o
def tube(name, r, a, b, m, v=12):   # 두 점 사이 둥근 관
    a, b = mathutils.Vector(a), mathutils.Vector(b); d = b - a; mid = (a + b) / 2
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, vertices=v, location=mid); o = bpy.context.object; o.name = name
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); bpy.ops.object.transform_apply(rotation=True)
    o.data.materials.append(m); uvbox(o, 1.0); parts.append(o); return o
def finish(name, out_dir, lod_ratio=0.4):
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); obj = bpy.context.object; obj.name = name
    if hasattr(bpy.ops.object, 'shade_smooth_by_angle'): bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.ops.object.duplicate(); lod = bpy.context.object; lod.name = name + '_LOD1'
    md = lod.modifiers.new('dec', 'DECIMATE'); md.ratio = lod_ratio; bpy.ops.object.modifier_apply(modifier='dec'); lod.hide_render = True
    dg = bpy.context.evaluated_depsgraph_get()
    def tris(o): e = o.evaluated_get(dg); me = e.to_mesh(); me.calc_loop_triangles(); n = len(me.loop_triangles); e.to_mesh_clear(); return n
    stats = {'name': name, 'tris_lod0': tris(obj), 'tris_lod1': tris(lod), 'dims_m_xyz_zup': [round(v, 4) for v in obj.dimensions], 'materials': [s.name for s in obj.data.materials], 'uv_layers': [u.name for u in obj.data.uv_layers]}
    os.makedirs(out_dir, exist_ok=True); bid = name.split('_')[0]
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, f'{bid}.blend'))
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, f'{bid}.glb'), export_format='GLB', use_selection=True, export_yup=True, export_image_format='JPEG', export_jpeg_quality=82)
    gdir = os.path.join(out_dir, 'game', f'v4_{bid}'); os.makedirs(gdir, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(gdir, f'v4_{bid}.gltf'), export_format='GLTF_SEPARATE', use_selection=True, export_yup=True, export_image_format='JPEG', export_jpeg_quality=82, export_texture_dir='../v4_tex')
    bpy.ops.export_scene.fbx(filepath=os.path.join(out_dir, f'{bid}.fbx'), use_selection=True, axis_forward='-Z', axis_up='Y', path_mode='COPY', embed_textures=True)
    bpy.ops.wm.obj_export(filepath=os.path.join(out_dir, f'{bid}.obj'), export_selected_objects=True, path_mode='COPY')
    json.dump(stats, open(os.path.join(out_dir, 'stats.json'), 'w'), ensure_ascii=False, indent=1); print('STATS', stats); return obj
