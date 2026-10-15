# 사용법: python3 tools/ghost_blend_to_glb.py -- <face_body.blend> <출력 폴더> <텍스처 크기 2048> <몸 삼각형 30000>  (Blender 5 · bpy 모듈)
# 사용자 유령 .blend(정적 · 무리깅, 약 8~10만 면 + 곡선 머리카락 2만 가닥) → 게임용 GLB
#  1) 배경 디오라마(벽 · 창 · 피아노 · 세면대 · 사물함 · 책걸상 · 물결 · 안개 · 떠다니는 실) 제거, 캐릭터만 남김
#  2) 모디파이어 적용 → 저폴리 사본(감쇠) + 스마트 UV
#  3) 원본 고폴리의 절차적 재질 색을 저폴리 아틀라스로 굽기 (Cycles, selected-to-active, DIFFUSE color)
#  4) 머리카락 곡선 → 가닥 일부만 납작한 띠(리본) 메시로 (정점 색: 뿌리 어둡게 · 끝 약간 푸르게)
#  5) GLB (WebP 텍스처) 내보내기 + 다시 가져와 검사
import bpy, bmesh, sys, os, re, json, random, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out, tex_size, target = argv[0], argv[1], int(argv[2]), int(argv[3])
bpy.ops.wm.open_mainfile(filepath=src, load_ui=False, use_scripts=False)
D, C = bpy.data, bpy.context
scene = C.scene
R = {'src': os.path.basename(os.path.dirname(src))}

ENV = re.compile(r'^(Backdrop|Diorama|Window|Moonlit|Railing|Porcelain_wall|Pool_|Ladder|Kickboard|Water_ripple|Staff_line|Ivory_key|Ebony_key|Piano|Stool|Aged_sheet_music|Easel|Canvas|Palette_paint|Paint_palette|Paintbrush|Basin|Sink|Mirror|Faucet|Door_|Locker|Scattered_note|Classroom_door|Chalk|Chair_|Desk_|Book_page|Closed_schoolbook|Ghost_mist|Spectral_drifting|Frayed_skirt_thread)')
HAIR = {'V3_6160_individual_hair_strands': (950, .003, 8), 'V3_fringe_fibers': (360, .002, 7), 'V007_fine_groom': (220, .0018, 8),
        'V3_fine_wind_flyaways': (60, .0014, 4), 'V3_individual_brow_hairs': (210, .0008, 3)}

base = lambda n: re.sub(r'(\.\d+)+$', '', n)
body = next(o for o in D.objects if o.type == 'MESH' and base(o.name).startswith('V007_continuous'))
bw = [body.matrix_world @ Vector(c) for c in body.bound_box]
lo, hi = Vector([min(v[i] for v in bw) for i in range(3)]), Vector([max(v[i] for v in bw) for i in range(3)])
R['body_bbox'] = [list(map(lambda x: round(x, 3), lo)), list(map(lambda x: round(x, 3), hi))]

def inside(o, pad=.22):
    w = [o.matrix_world @ Vector(c) for c in o.bound_box]; c = sum(w, Vector()) / 8
    return all(lo[i] - pad <= c[i] <= hi[i] + pad for i in range(3))

keep, drop = [], []
for o in list(D.objects):
    b = base(o.name)
    if o.type == 'MESH' and not ENV.match(b) and inside(o) and not o.hide_render and not any(s.material and 'Hidden_unused' in s.material.name and len(o.material_slots) == 1 for s in o.material_slots):
        keep.append(o)
    elif o.type == 'CURVE' and b in HAIR: pass
    else: drop.append(o)
R['kept'] = sorted({base(o.name) for o in keep}); R['dropped'] = sorted({base(o.name) for o in drop if o.type == 'MESH'})
hair_src = [o for o in D.objects if o.type == 'CURVE' and base(o.name) in HAIR]
# 머리 중심(가닥 방향 계산용): 얼굴 메시 경계 상자 가운데
face = next((o for o in keep if 'face' in o.name.lower()), body)
fw = [face.matrix_world @ Vector(c) for c in face.bound_box]; head_c = sum(fw, Vector()) / 8

# 고폴리 원본: 모디파이어 적용된 메시로 굳힌다 (굽기 원본)
dg = C.evaluated_depsgraph_get()
highs, hair_meshes = [], []
for o in keep:
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    me.transform(o.matrix_world)
    # 숨겨 둔 보조 면(안 쓰는 엉덩이 조각 · 투명 눈 표면)은 지운다
    bad = {i for i, m in enumerate(me.materials) if m and re.search(r'Hidden_unused|hidden_eye_surface', m.name)}
    if bad:
        bm0 = bmesh.new(); bm0.from_mesh(me); bmesh.ops.delete(bm0, geom=[f for f in bm0.faces if f.material_index in bad], context='FACES'); bm0.to_mesh(me); bm0.free()
    if not len(me.polygons): continue
    h = bpy.data.objects.new('HI_' + o.name, me); scene.collection.objects.link(h)
    if me.materials and all(m and re.search(r'hair', m.name, re.I) for m in me.materials): hair_meshes.append(h)   # 젖은 머리 덩어리 → 굽지 않고 머리카락 재질로
    else: highs.append(h)
for o in drop + keep:
    bpy.data.objects.remove(o, do_unlink=True)
R['high_faces'] = sum(len(h.data.polygons) for h in highs)

# 저폴리: 합친 사본 → 감쇠
C.view_layer.update()
for o in scene.objects: o.select_set(False)
copies = []
for h in highs:
    c = h.copy(); c.data = h.data.copy(); scene.collection.objects.link(c); copies.append(c)
C.view_layer.objects.active = copies[0]
for c in copies: c.select_set(True)
bpy.ops.object.join(); low = C.view_layer.objects.active; low.name = 'GhostBody'; low.data.name = 'GhostBody'
me = low.data
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=.0002); bpy.ops.object.mode_set(mode='OBJECT')
me.calc_loop_triangles(); ratio = min(1, target / max(1, len(me.loop_triangles)))   # target = 삼각형 수
if ratio < 1:
    md = low.modifiers.new('dec', 'DECIMATE'); md.ratio = ratio; md.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
R['low_faces'] = len(low.data.polygons)
while len(low.data.materials): low.data.materials.pop()
for uv in list(low.data.uv_layers): low.data.uv_layers.remove(uv)
low.data.uv_layers.new(name='UVMap')
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=.004, area_weight=0.0, scale_to_bounds=False)
bpy.ops.uv.pack_islands(margin=.004)
bpy.ops.object.mode_set(mode='OBJECT')
for p in low.data.polygons: p.use_smooth = True

# 굽기
img = bpy.data.images.new('ghost_albedo', tex_size, tex_size, alpha=False); img.colorspace_settings.name = 'sRGB'
mat = bpy.data.materials.new('GhostBodyMat'); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes.get('Principled BSDF'); tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img
nt.links.new(tn.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = .78
low.data.materials.append(mat); nt.nodes.active = tn
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 4
bk = scene.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = .012; bk.max_ray_distance = .05; bk.margin = 6
bk.use_pass_direct = False; bk.use_pass_indirect = False; bk.use_pass_color = True
C.view_layer.update()
for o in scene.objects: o.select_set(False)
for h in highs: h.select_set(True)
low.select_set(True); C.view_layer.objects.active = low
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
img.filepath_raw = os.path.join(out, 'albedo.png'); img.file_format = 'PNG'; img.save()
img.pack()
for h in highs: bpy.data.objects.remove(h, do_unlink=True)

# 머리카락 띠
rng = random.Random(7)
bm = bmesh.new(); col = bm.loops.layers.color.new('Col')
hair_faces = 0
for o in hair_src:
    n, w, K = HAIR[base(o.name)]
    sp = [s for s in o.data.splines if len(s.points) + len(s.bezier_points) >= 2]
    rng.shuffle(sp); sp = sp[:n]
    M = o.matrix_world
    for s in sp:
        pts = [M @ (p.co.xyz if hasattr(p.co, 'xyz') else p.co) for p in (s.points if len(s.points) else s.bezier_points)]
        # 균일 재표본 K 점
        L = [0]
        for i in range(1, len(pts)): L.append(L[-1] + (pts[i] - pts[i - 1]).length)
        if L[-1] < 1e-4: continue
        rs = []
        for k in range(K):
            t = L[-1] * k / (K - 1); j = max(1, next((i for i in range(1, len(L)) if L[i] >= t), len(L) - 1))
            a = (t - L[j - 1]) / max(1e-9, L[j] - L[j - 1]); rs.append(pts[j - 1].lerp(pts[j], min(1, max(0, a))))
        vs = []
        for k, p in enumerate(rs):
            tg = (rs[min(K - 1, k + 1)] - rs[max(0, k - 1)]).normalized()
            side = tg.cross((p - head_c).normalized());
            if side.length < 1e-4: side = tg.cross(Vector((0, 0, 1)))
            side.normalize(); ww = w * (1 - .55 * k / (K - 1))
            vs.append((bm.verts.new(p - side * ww), bm.verts.new(p + side * ww)))
        for k in range(K - 1):
            f = bm.faces.new((vs[k][0], vs[k][1], vs[k + 1][1], vs[k + 1][0])); hair_faces += 1
            for li, l in enumerate(f.loops):
                kk = k if li < 2 else k + 1; t = kk / (K - 1)
                l[col] = (.035 + .05 * t, .033 + .05 * t, .05 + .085 * t, 1)
for o in hair_src: bpy.data.objects.remove(o, do_unlink=True)
for hm0 in hair_meshes:
    if len(hm0.data.polygons) > 3000:   # 젖은 머리 덩어리는 절반으로 감쇠
        b0 = bmesh.new(); b0.from_mesh(hm0.data); bmesh.ops.triangulate(b0, faces=b0.faces[:]); b0.to_mesh(hm0.data); b0.free()
        md = hm0.modifiers.new('dec', 'DECIMATE'); md.ratio = .5; dg2 = C.evaluated_depsgraph_get()
        me2 = bpy.data.meshes.new_from_object(hm0.evaluated_get(dg2), depsgraph=dg2); hm0.modifiers.clear(); hm0.data = me2
    off = len(bm.verts); vmap = [bm.verts.new(v.co) for v in hm0.data.vertices]
    for p in hm0.data.polygons:
        try:
            f = bm.faces.new([vmap[i] for i in p.vertices])
        except ValueError: continue
        hair_faces += 1
        for l in f.loops: z = (l.vert.co - head_c).z; t = min(1, max(0, -z / .6)); l[col] = (.03 + .03 * t, .03 + .03 * t, .045 + .05 * t, 1)
    bpy.data.objects.remove(hm0, do_unlink=True)
hme = bpy.data.meshes.new('GhostHair'); bm.to_mesh(hme); bm.free()
hair = bpy.data.objects.new('GhostHair', hme); scene.collection.objects.link(hair)
hme.color_attributes.active_color_index = 0; hme.color_attributes.render_color_index = 0
hm = bpy.data.materials.new('GhostHairMat'); hm.use_nodes = True; hm.use_backface_culling = False
hb = hm.node_tree.nodes.get('Principled BSDF'); vc = hm.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
hm.node_tree.links.new(vc.outputs['Color'], hb.inputs['Base Color']); hb.inputs['Roughness'].default_value = .45
hme.materials.append(hm)
R['hair_faces'] = hair_faces

# 나머지(카메라 · 조명 등) 정리, 발바닥을 원점으로 · 앞(-Y) 유지
for o in list(D.objects):
    if o not in (low, hair): bpy.data.objects.remove(o, do_unlink=True)
zs = [(low.matrix_world @ Vector(c)).z for c in low.bound_box]; cx = (lo.x + hi.x) / 2; cy = (lo.y + hi.y) / 2
for o in (low, hair):
    o.data.transform(__import__('mathutils').Matrix.Translation((-cx, -cy, -min(zs))))
R['height_m'] = round(max(zs) - min(zs), 3)
GL = dict(export_format='GLB', export_yup=True, export_image_format='WEBP', export_image_quality=88, export_apply=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_attributes=False)
try:
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'ghost.glb'), **GL)
except TypeError:
    GL.pop('export_vertex_color', None); GL.pop('export_all_vertex_colors', None); bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'ghost.glb'), **GL)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'ghost_game.blend'), compress=True)
R['glb_mb'] = round(os.path.getsize(os.path.join(out, 'ghost.glb')) / 1e6, 2)
# 다시 가져와 검사
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=os.path.join(out, 'ghost.glb'))
ms = [o for o in bpy.data.objects if o.type == 'MESH']
for o in ms: o.data.calc_loop_triangles()
R['reimport'] = {'meshes': len(ms), 'tris': sum(len(o.data.loop_triangles) for o in ms), 'images': [(i.name, i.size[:]) for i in bpy.data.images], 'colors': [list(o.data.color_attributes.keys()) for o in ms]}
json.dump(R, open(os.path.join(out, 'report.json'), 'w'), ensure_ascii=False, indent=1)
print('REPORT', json.dumps(R, ensure_ascii=False))
