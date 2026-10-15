# MakeHuman 1.2 자산(CC0) 을 직접 읽어 Blender 캐릭터를 만드는 자체 로더 (MakeHuman 의 AGPL 코드는 쓰지 않는다)
# 좌표: MakeHuman 은 Y-up · 데시미터 → Blender Z-up · 미터 (x, -z, y) * 0.1
import numpy as np, json, os, math, bpy
MH = os.environ.get('MH_DATA', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mh', 'x', 'makehuman', 'data'))
_T = None
def T():
    global _T
    if _T is None: _T = np.load(os.path.join(MH, 'targets.npz'))
    return _T
def has_target(n): return f'targets/{n}.index' in T().files
def target(n):
    t = T(); return t[f'targets/{n}.index'].astype(np.int64), t[f'targets/{n}.vector'].astype(np.float32) * 1e-3
def sstr(a): return a.tobytes().decode('utf8', 'ignore')
def load_mesh(path):
    b = np.load(path); gs = sstr(b['fgstr']); gi = list(b['fgidx']) + [len(gs)]
    names = [gs[gi[i]:gi[i + 1]] for i in range(len(gi) - 1)]
    return dict(coord=b['coord'].astype(np.float64), fvert=b['fvert'].astype(np.int64), fuvs=b['fuvs'].astype(np.int64), texco=b['texco'].astype(np.float64), group=b['group'].astype(np.int64), gnames=names)
# ── 매크로 (성별 · 나이 · 인종 · 근육 · 체중 · 키 · 비율) → 타깃 가중치
def _age_w(a):
    if a < .1875: return {'baby': 1 - a / .1875, 'child': a / .1875}
    if a < .5: k = (a - .1875) / (.5 - .1875); return {'child': 1 - k, 'young': k}
    k = (a - .5) / .5; return {'young': 1 - k, 'old': k}
def _tri(v, lo, mid, hi):
    return {lo: 1 - v / .5, mid: v / .5} if v < .5 else {mid: 1 - (v - .5) / .5, hi: (v - .5) / .5}
def age_value(years):
    if years < 11: return (years - 1) / 10 * .1875
    if years < 25: return .1875 + (years - 11) / 14 * .3125
    return .5 + (years - 25) / 65 * .5
def macro_targets(gender, years, race, muscle=.5, weight=.5, height=.5, prop=.5):
    G = {'female': 1 - gender, 'male': gender}; A = _age_w(age_value(years))
    M = _tri(muscle, 'minmuscle', 'averagemuscle', 'maxmuscle'); W = _tri(weight, 'minweight', 'averageweight', 'maxweight')
    H = {'minheight': (.5 - height) / .5} if height < .5 else {'maxheight': (height - .5) / .5}
    P = {'uncommonproportions': (.5 - prop) / .5} if prop < .5 else {'idealproportions': (prop - .5) / .5}
    out = {}
    def add(n, w):
        if w > 1e-5 and has_target(n): out[n] = out.get(n, 0) + w
    for g, gw in G.items():
        for a, aw in A.items():
            for r, rw in race.items(): add(f'macrodetails/{r}-{g}-{a}', gw * aw * rw)
            for m, mw in M.items():
                for w, ww in W.items():
                    add(f'macrodetails/universal-{g}-{a}-{m}-{w}', gw * aw * mw * ww)
                    for h, hw in H.items(): add(f'macrodetails/height/{g}-{a}-{m}-{w}-{h}', gw * aw * mw * ww * hw)
                    for pp, pw in P.items(): add(f'macrodetails/proportions/{g}-{a}-{m}-{w}-{pp}', gw * aw * mw * ww * pw)
    return out
def find_target(name, v):
    """모델링 수치(-1~1) → incr/decr 타깃 (예: 'mouth/mouth-laugh-lines', 0.6)"""
    if v >= 0:
        for s in ['-incr', '-up', '-in', '-out', '-forward', '']: 
            if has_target(name + s): return name + s, v
    for s in ['-decr', '-down', '-backward', '-less']:
        if has_target(name + s): return name + s, -v
    if has_target(name): return name, abs(v)
    raise KeyError(name)
def apply_targets(coord, tw):
    c = coord.copy()
    for n, w in tw.items(): i, v = target(n); c[i] += v * w
    return c
# ── 프록시(옷 · 머리카락 · 눈 · 눈썹 · 치아): 기준 정점 3개 가중합 + 크기 보정 오프셋
def load_proxy(dirpath, name):
    p = np.load(os.path.join(dirpath, name + '.mhpxy')); m = load_mesh(os.path.join(dirpath, name + '.npz')); f = p.files
    ref = p['ref_vIdxs'].astype(np.int64); w = p['weights'].astype(np.float64)
    if ref.ndim == 1: ref = np.stack([ref, ref, ref], 1); w = np.stack([np.ones(len(ref)), np.zeros(len(ref)), np.zeros(len(ref))], 1)
    off = p['offsets'].astype(np.float64) if 'offsets' in f else np.zeros((len(ref), 3))
    return dict(ref=ref, w=w, off=off, sidx=p['tmat_scale_idx'].astype(np.int64) if 'tmat_scale_idx' in f else np.zeros(6, np.int64), sden=p['tmat_scale'].astype(np.float64) if 'tmat_scale' in f else np.zeros(3),
                delete=p['deleteVerts'].astype(bool) if 'deleteVerts' in f else np.zeros(19158, bool), mat=sstr(p['material_file']) if 'material_file' in f else '', mesh=m, dir=dirpath, name=name)
def fit_proxy(px, coord):
    sc = np.ones(3)
    for ax in range(3 if len(px['sidx']) >= 6 else 0):
        a, b, den = px['sidx'][ax * 2], px['sidx'][ax * 2 + 1], px['sden'][ax]
        if den: sc[ax] = abs(coord[a][ax] - coord[b][ax]) / den
    r, w = px['ref'], px['w']
    return coord[r[:, 0]] * w[:, :1] + coord[r[:, 1]] * w[:, 1:2] + coord[r[:, 2]] * w[:, 2:3] + px['off'] * sc
def mhmat(path):
    d = {}
    for ln in open(path, encoding='utf8', errors='ignore'):
        ln = ln.strip()
        if not ln or ln.startswith('#'): continue
        k, _, v = ln.partition(' '); d[k] = v
    return d
def to_blender(c): return np.stack([c[:, 0], -c[:, 2], c[:, 1]], 1) * .1
# ── Blender 메시 생성 (사각형/삼각형 혼합, 면별 UV)
def make_obj(name, coord_bl, fvert, fuvs, texco, face_mask=None, collection=None):
    keep = np.ones(len(fvert), bool) if face_mask is None else face_mask
    fv, fu = fvert[keep], fuvs[keep]
    used = np.unique(fv); remap = -np.ones(len(coord_bl), np.int64); remap[used] = np.arange(len(used))
    faces = []; uvs = []
    for q, u in zip(fv, fu):
        if q[3] == q[2] or q[3] == q[0]: faces.append([remap[q[0]], remap[q[1]], remap[q[2]]]); uvs.append(u[:3])
        else: faces.append(list(remap[q])); uvs.append(u)
    me = bpy.data.meshes.new(name); me.from_pydata(coord_bl[used].tolist(), [], faces); me.update()
    uvl = me.uv_layers.new(name='UVMap'); flat = np.concatenate(uvs); uvl.data.foreach_set('uv', texco[flat].astype(np.float32).ravel())
    ob = bpy.data.objects.new(name, me); (collection or bpy.context.scene.collection).objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    return ob, used
def tex_mat(name, diffuse=None, normal=None, ao=None, rough=.6, metal=0., alpha=False, color=None, tint=None, normal_strength=1.):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = metal
    if diffuse:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(diffuse); nt.links.new(t.outputs['Color'], bs.inputs['Base Color'])
        if alpha:
            nt.links.new(t.outputs['Alpha'], bs.inputs['Alpha'])
            try: m.surface_render_method = 'DITHERED'
            except Exception: pass
    elif color: bs.inputs['Base Color'].default_value = (*color, 1)
    if normal:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(normal); n.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal_strength; nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    if ao:
        g = bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        if 'Occlusion' not in [s.name for s in g.interface.items_tree]: g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
        a = nt.nodes.new('ShaderNodeTexImage'); a.image = bpy.data.images.load(ao); a.image.colorspace_settings.name = 'Non-Color'
        sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(a.outputs['Color'], sep.inputs['Color'])
        go = nt.nodes.new('ShaderNodeGroup'); go.node_tree = g; nt.links.new(sep.outputs['Red'], go.inputs['Occlusion'])
    return m
# ── 리그: game_engine.mhskel (UE 마네킹 이름 53본) — 관절 위치 = 보조 관절 정점 평균, 가중치 = 기본 리그 가중치를 weights_reference 로 합침
def load_skel(name='game_engine'):
    return json.load(open(os.path.join(MH, 'rigs', name + '.mhskel')))
def base_weights(skel):
    W = json.load(open(os.path.join(MH, 'rigs', 'default_weights.mhw')))['weights']
    out = {}
    for bn, b in skel['bones'].items():
        refs = b.get('weights_reference') or b.get('reference') or []
        acc = {}
        for r in refs:
            for vi, w in W.get(r, []): acc[vi] = acc.get(vi, 0) + w
        if acc: out[bn] = acc
    return out
def build_armature(name, coord_mh, skel, collection=None):
    J = {k: to_blender(coord_mh[np.array(v)])[:].mean(0) for k, v in skel['joints'].items()}
    arm = bpy.data.armatures.new(name); ob = bpy.data.objects.new(name, arm); (collection or bpy.context.scene.collection).objects.link(ob)
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.mode_set(mode='EDIT')
    for bn, b in skel['bones'].items():
        eb = arm.edit_bones.new(bn); eb.head = J[b['head']]; eb.tail = J[b['tail']]
        if (eb.tail - eb.head).length < 1e-4: eb.tail = eb.head + mathutils_vec((0, 0, .02))
        eb.roll = b.get('roll', 0)
    for bn, b in skel['bones'].items():
        if b['parent']: arm.edit_bones[bn].parent = arm.edit_bones[b['parent']]; arm.edit_bones[bn].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT'); return ob
def mathutils_vec(t):
    import mathutils; return mathutils.Vector(t)
def proxy_weights(px, bw):
    """프록시 정점 가중치 = 기준 정점 3개의 가중치를 프록시 가중치로 섞음"""
    out = {}
    r, w = px['ref'], px['w']
    for bn, acc in bw.items():
        vals = np.zeros(len(r))
        for j in range(3):
            vals += np.array([acc.get(int(v), 0.) for v in r[:, j]]) * w[:, j]
        if vals.max() > 1e-4: out[bn] = vals
    return out
def assign_weights(ob, per_bone, armature, limit=4):
    names = list(per_bone); M = np.stack([per_bone[n] for n in names], 1)   # (verts, bones)
    if limit:
        idx = np.argsort(-M, 1)[:, limit:]; np.put_along_axis(M, idx, 0, 1)
    s = M.sum(1, keepdims=True); M = np.where(s > 0, M / np.maximum(s, 1e-8), 0)
    for j, n in enumerate(names):
        vs = np.nonzero(M[:, j] > 1e-4)[0]
        if not len(vs): continue
        g = ob.vertex_groups.new(name=n)
        for v in vs: g.add([int(v)], float(M[v, j]), 'REPLACE')
    md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = armature; ob.parent = armature
    return (s[:, 0] <= 0).sum()
def body_bone_weights(bw, used):
    return {bn: np.array([acc.get(int(v), 0.) for v in used]) for bn, acc in bw.items()}
