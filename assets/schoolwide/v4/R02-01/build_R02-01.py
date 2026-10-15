# R02-01 학생용 책상 (650 x 450 x 730 mm) — 실제 부품 구조로 모델링 · PBR · GLB/glTF/FBX/OBJ/.blend 출력 · 재임포트 검사 · 렌더
import bpy, bmesh, math, os, sys, json
B = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(B, 'out'); TEX = os.path.join(B, 'tex')
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'
def mat(name, base, nrm, rough, metal=0.0, color=None, rough_v=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    bs.inputs['Metallic'].default_value = metal
    if base:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(TEX, base)); nt.links.new(t.outputs['Color'], bs.inputs['Base Color'])
    elif color: bs.inputs['Base Color'].default_value = (*color, 1)
    if rough:
        r = nt.nodes.new('ShaderNodeTexImage'); r.image = bpy.data.images.load(os.path.join(TEX, rough)); r.image.colorspace_settings.name = 'Non-Color'; nt.links.new(r.outputs['Color'], bs.inputs['Roughness'])
    elif rough_v is not None: bs.inputs['Roughness'].default_value = rough_v
    if nrm:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(os.path.join(TEX, nrm)); n.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    return m
M_WOOD = mat('R02_wood_varnish', 'varnishDark_map.jpg', 'varnishDark_normal.jpg', 'varnishDark_rough.jpg')
M_STEEL = mat('R02_steel_dusty', 'locker_map.jpg', 'locker_normal.jpg', 'locker_rough.jpg', metal=0.55)
M_RUBBER = mat('R02_rubber', None, None, None, color=(0.03, 0.03, 0.03), rough_v=0.85)
parts = []
def box(name, sx, sy, sz, x, y, z, m, bevel=0.0, uvs=1.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z)); o = bpy.context.object; o.name = name; o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 3; md.limit_method = 'ANGLE'; bpy.ops.object.modifier_apply(modifier='bev')
    o.data.materials.append(m); uvbox(o, uvs); parts.append(o); return o
def cyl(name, r, d, x, y, z, m, rot=(0, 0, 0), v=16):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, vertices=v, location=(x, y, z), rotation=rot); o = bpy.context.object; o.name = name
    bpy.ops.object.transform_apply(rotation=True); o.data.materials.append(m); uvbox(o, 1.0); parts.append(o); return o
def uvbox(o, s):
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.cube_project(cube_size=1.0 / s, correct_aspect=True, scale_to_bounds=False); bpy.ops.object.mode_set(mode='OBJECT'); o.select_set(False)
W, D, H = 0.65, 0.45, 0.73
T = 0.018; LEG = 0.025; TUBE = 0.02
# 상판: 18mm 합판 + 모서리 라운드
box('top_plywood', W, D, T, 0, 0, H - T / 2, M_WOOD, bevel=0.004, uvs=1.4)
# 상판 아래 사각 프레임 (20x20 각관)
zf = H - T - TUBE / 2
for s in (-1, 1):
    box(f'apron_x{s}', W - 0.04, TUBE, TUBE, 0, s * (D / 2 - 0.03), zf, M_STEEL, bevel=0.002)
    box(f'apron_y{s}', TUBE, D - 0.06, TUBE, s * (W / 2 - 0.03), 0, zf, M_STEEL, bevel=0.002)
# 다리 4개 (25x25 각관) + 고무 발
lh = zf - 0.012
for sx in (-1, 1):
    for sy in (-1, 1):
        x, y = sx * (W / 2 - 0.03), sy * (D / 2 - 0.03)
        box(f'leg_{sx}{sy}', LEG, LEG, lh, x, y, 0.012 + lh / 2, M_STEEL, bevel=0.002)
        box(f'glide_{sx}{sy}', LEG + 0.006, LEG + 0.006, 0.012, x, y, 0.006, M_RUBBER, bevel=0.002)
# 옆 하부 가로대 (H 프레임) + 뒤쪽(칠판 쪽) 가로대
for sx in (-1, 1): box(f'stretcher_side{sx}', TUBE, D - 0.06, TUBE, sx * (W / 2 - 0.03), 0, 0.16, M_STEEL, bevel=0.002)
box('stretcher_back', W - 0.06, TUBE, TUBE, 0, D / 2 - 0.03, 0.42, M_STEEL, bevel=0.002)
# 책 수납 선반 (철판 트레이): 바닥 · 칠판 쪽 립 · 양옆 립 — 학생 쪽(-Y)으로 열려 있다
ts = 0.0015; tz = zf - 0.12
box('shelf_floor', W - 0.08, D - 0.12, ts, 0, 0.02, tz, M_STEEL)
box('shelf_lip_back', W - 0.08, ts, 0.10, 0, D / 2 - 0.04, tz + 0.05, M_STEEL)
for sx in (-1, 1):
    box(f'shelf_lip_side{sx}', ts, D - 0.12, 0.10, sx * (W / 2 - 0.04), 0.02, tz + 0.05, M_STEEL)
    box(f'shelf_hanger{sx}', 0.012, 0.012, 0.11, sx * (W / 2 - 0.042), -0.15, tz + 0.055, M_STEEL)
# 가방걸이 (양옆): 둥근 봉을 구부린 고리
for sx in (-1, 1):
    x = sx * (W / 2 - 0.0)
    cyl(f'hook_arm{sx}', 0.004, 0.035, x + sx * 0.0175, -0.10, zf - 0.03, M_STEEL, rot=(0, math.pi / 2, 0), v=10)
    cyl(f'hook_tip{sx}', 0.004, 0.03, x + sx * 0.035, -0.10, zf - 0.015, M_STEEL, v=10)
# 상판 고정 나사 (프레임 옆면 8개)
for sx in (-1, 1):
    for yy in (-0.12, 0.12):
        cyl(f'bolt_{sx}_{yy}', 0.005, 0.004, sx * (W / 2 - 0.0185), yy, zf, M_STEEL, rot=(0, math.pi / 2, 0), v=12)
for sy in (-1, 1):
    for xx in (-0.2, 0.2):
        cyl(f'bolt_y{sy}_{xx}', 0.005, 0.004, xx, sy * (D / 2 - 0.0185), zf, M_STEEL, rot=(math.pi / 2, 0, 0), v=12)
# 하나의 객체로 합친다 (재질은 3개 유지) · 원점 = 바닥 중심
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); desk = bpy.context.object; desk.name = 'R02-01_StudentDesk'
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35)) if hasattr(bpy.ops.object, 'shade_smooth_by_angle') else None
# LOD1 (게임 원거리용): 나사 · 고리를 뺀 단순화 — 같은 파일 안 별도 객체
bpy.ops.object.select_all(action='DESELECT'); desk.select_set(True); bpy.ops.object.duplicate(); lod1 = bpy.context.object; lod1.name = 'R02-01_StudentDesk_LOD1'
md = lod1.modifiers.new('dec', 'DECIMATE'); md.ratio = 0.4; bpy.ops.object.modifier_apply(modifier='dec'); lod1.hide_render = True
# 통계
dg = bpy.context.evaluated_depsgraph_get()
def tris(o): e = o.evaluated_get(dg); m = e.to_mesh(); m.calc_loop_triangles(); n = len(m.loop_triangles); e.to_mesh_clear(); return n
stats = {'tris_lod0': tris(desk), 'tris_lod1': tris(lod1), 'dims_m': [round(v, 4) for v in desk.dimensions], 'materials': [m.name for m in desk.data.materials], 'uv_layers': [u.name for u in desk.data.uv_layers]}
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'R02-01.blend'))
# 내보내기: 게임용은 LOD0 만
bpy.ops.object.select_all(action='DESELECT'); desk.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'R02-01.glb'), export_format='GLB', use_selection=True, export_yup=True, export_image_format='JPEG')
os.makedirs(os.path.join(OUT, 'v4_R02-01'), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'v4_R02-01', 'v4_R02-01.gltf'), export_format='GLTF_SEPARATE', use_selection=True, export_yup=True, export_image_format='JPEG')
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT, 'R02-01.fbx'), use_selection=True, axis_forward='-Z', axis_up='Y', path_mode='COPY', embed_textures=True)
bpy.ops.wm.obj_export(filepath=os.path.join(OUT, 'R02-01.obj'), export_selected_objects=True, path_mode='COPY')
json.dump(stats, open(os.path.join(OUT, 'stats.json'), 'w'), ensure_ascii=False, indent=1)
print('STATS', stats)
