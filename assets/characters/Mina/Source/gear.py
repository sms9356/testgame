# 경비원 장비 직접 모델링 (몸 표면에 레이캐스트로 맞춤) — 각 장비는 한 본에 단단히 묶인 스킨 메시
import bpy, bmesh, math, numpy as np, mathutils, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
V = Vector
def bvh(ob):
    dg = bpy.context.evaluated_depsgraph_get(); e = ob.evaluated_get(dg); me = e.to_mesh(); me.transform(ob.matrix_world)
    t = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [list(p.vertices) for p in me.polygons]); e.to_mesh_clear(); return t
def hit(tree, origin, direction):
    loc, nor, i, d = tree.ray_cast(V(origin), V(direction).normalized(), 5.0); return (loc, nor) if loc else (None, None)
def new_obj(name, bm, mat, bone, arm, col=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(name, me); (col or bpy.context.scene.collection).objects.link(ob)
    if isinstance(mat, list):
        for m in mat: me.materials.append(m)
    else: me.materials.append(mat)
    if bone:
        g = ob.vertex_groups.new(name=bone); g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
        md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm; ob.parent = arm
    for p in me.polygons: p.use_smooth = True
    return ob
def uv_box(ob, s=1.):
    bpy.context.view_layer.objects.active = ob; [o.select_set(False) for o in bpy.context.selected_objects]; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.cube_project(cube_size=1 / s, scale_to_bounds=False); bpy.ops.object.mode_set(mode='OBJECT'); ob.select_set(False)
def mod_apply(ob, kind, **kw):
    m = ob.modifiers.new(kind, kind)
    for k, v in kw.items(): setattr(m, k, v)
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier=m.name)
def decal(name, center, normal, up, w, h, mat, bone, arm, offset=.003, tree=None, segs=6):
    """몸 표면 위 곡면 데칼 (패치 · 명찰): 격자를 표면에 다시 투영해 곡면을 따라가게"""
    n = V(normal).normalized(); u = V(up).normalized(); u = (u - n * u.dot(n)).normalized(); r = u.cross(n)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); grid = []
    for j in range(segs + 1):
        row = []
        for i in range(segs + 1):
            p = V(center) + r * (w * (i / segs - .5)) + u * (h * (j / segs - .5))
            if tree:
                l, nn = hit(tree, p + n * .05, -n)
                if l: p = l
            row.append(bm.verts.new(p + n * offset))
        grid.append(row)
    for j in range(segs):
        for i in range(segs):
            f = bm.faces.new([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]])
            for lp, (a, b) in zip(f.loops, [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]): lp[uvl].uv = (a / segs, b / segs)
    return new_obj(name, bm, mat, bone, arm)
def mat_simple(name, color, rough=.5, metal=0., emit=None, alpha_tex=None, tex=None, normal=None, rough_tex=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*color, 1); bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = metal
    if emit: bs.inputs['Emission Color'].default_value = (*emit[0], 1); bs.inputs['Emission Strength'].default_value = emit[1]
    if tex:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(tex); nt.links.new(t.outputs['Color'], bs.inputs['Base Color'])
        if alpha_tex: nt.links.new(t.outputs['Alpha'], bs.inputs['Alpha'])
    if normal:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(normal); n.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    if rough_tex:
        r = nt.nodes.new('ShaderNodeTexImage'); r.image = bpy.data.images.load(rough_tex); r.image.colorspace_settings.name = 'Non-Color'; nt.links.new(r.outputs['Color'], bs.inputs['Roughness'])
    return m
# ── 민아 장비 (직접 모델링): 앞머리 · 리본 · 교표 · 단추 · 백팩(어깨끈 · 지퍼 · 토끼 키링)
def sweep(name, path, width, normal_fn, mat, bone, arm, thick=.004, uvs=8.):
    """곡선(path) 을 따라 폭 width 의 띠를 만든다 — 어깨끈 · 리본 꼬리"""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); rows = []
    for i, p in enumerate(path):
        t = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized(); n = normal_fn(p, i); s = t.cross(n).normalized()
        w = width(i / (len(path) - 1)) if callable(width) else width
        rows.append((bm.verts.new(p - s * w / 2), bm.verts.new(p + s * w / 2)))
    for i in range(len(rows) - 1):
        f = bm.faces.new([rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]])
        for lp, (a, b) in zip(f.loops, [(0, i), (1, i), (1, i + 1), (0, i + 1)]): lp[uvl].uv = (a, b / uvs)
    ob = new_obj(name, bm, mat, bone, arm)
    if thick: mod_apply(ob, 'SOLIDIFY', thickness=thick, offset=0)
    return ob
def build(arm, suit, hair, body, TEX):
    B = arm.data.bones; HB = lambda n: B[n].head_local.copy(); TB = lambda n: B[n].tail_local.copy()
    ts = bvh(suit); th = bvh(hair); tb = bvh(body)
    M = {'ribbon': mat_simple('Mina_Ribbon', (.3, .045, .07), .38), 'gold': mat_simple('Mina_Emblem', (1, 1, 1), .35, .9, tex=os.path.join(TEX, 'emblem.png'), alpha_tex=True),
         'button': mat_simple('Mina_Button', (.75, .6, .3), .3, 1.), 'bag': mat_simple('Mina_Backpack', (.025, .026, .03), .7, tex=os.path.join(TEX, 'nylon_diffuse.png'), normal=os.path.join(TEX, 'nylon_normal.png')),
         'strap': mat_simple('Mina_Strap', (.02, .02, .022), .6), 'zip': mat_simple('Mina_Zipper', (.55, .55, .55), .3, .9),
         'bunny': mat_simple('Mina_Bunny', (.94, .8, .82), .95), 'eye': mat_simple('Mina_BunnyEye', (.02, .02, .02), .2),
         'bangs': mat_simple('Mina_Bangs', (1, 1, 1), .55, tex=os.path.join(TEX, 'bangs.png'), alpha_tex=True)}
    for k in ('gold', 'bangs'):
        try: M[k].surface_render_method = 'DITHERED'
        except Exception: pass
    out = {}
    # ── 앞머리 (시스루 뱅): 머리 정중면 호를 따라 머리카락 · 이마 표면에 레이캐스트한 격자에 가닥 텍스처
    hd = HB('head'); hv = [hair.matrix_world @ v.co for v in hair.data.vertices]
    top = max(p.z for p in hv); fy = min(v.co.y for v in body.data.vertices if v.co.z > hd.z + .02 and abs(v.co.x) < .02)
    c0 = V((0, fy + .1, hd.z + .07))   # 머리 중심 근사
    ev = [v.co for v in bpy.data.objects['Mina_Eyes'].data.vertices]; eye_z = sum(p.z for p in ev) / len(ev); eye_top = max(p.z for p in ev)
    c0 = V((0, sum(p.y for p in ev) / len(ev) + .085, eye_z + .02))
    def surf(d):
        o = c0 + d * .4; best = None
        for t in (th, tb):
            l, n = hit(t, o, -d)
            if l is not None and (best is None or (l - o).length < (best[0] - o).length): best = (l, n)
        return best
    NU, NV = 16, 14; bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); grid = []
    for j in range(NV + 1):
        v = j / NV; th_ = math.radians(48 - v * 52); row = []
        for i in range(NU + 1):
            u = i / NU * 2 - 1; ph = u * math.radians(48)
            d = V((math.sin(ph) * math.cos(th_), -math.cos(ph) * math.cos(th_), math.sin(th_))).normalized()
            s = surf(d); p = (s[0] if s else c0 + d * .1) + d * (.003 + .009 * v * v * (1 - abs(u) * .3))
            row.append(bm.verts.new(p))
        grid.append(row)
    for j in range(NV):
        for i in range(NU):
            f = bm.faces.new([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]])
            for lp, (a, b) in zip(f.loops, [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]): lp[uvl].uv = (a / NU, 1 - b / NV)
    bangs = new_obj('Mina_Bangs', bm, M['bangs'], 'head', arm); mod_apply(bangs, 'SOLIDIFY', thickness=.0015, offset=1)
    # ── 리본 (셔츠 깃 앞 · 나비 매듭 + 꼬리 두 개)
    zk = HB('neck_01').z - .028; l, n = hit(ts, V((0, -.6, zk)), V((0, 1, 0)))
    if l is None: l = V((0, fy + .05, zk)); n = V((0, -1, 0))
    kc = l + V((0, -.012, 0)); fwd = V((0, -1, 0))
    bm = bmesh.new()
    for sx in (-1, 1):   # 고리: 납작한 원뿔(끝이 매듭 쪽)
        g = bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=.004, radius2=.019, depth=.042)
        R = Matrix.Rotation(math.radians(90 * sx), 4, 'Y')
        for vv in g['verts']: vv.co = R @ V((vv.co.x, vv.co.y * .45, vv.co.z + .021)); vv.co = kc + V((vv.co.x, vv.co.y, vv.co.z * .9))
    g = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=.009)
    for vv in g['verts']: vv.co = kc + V((vv.co.x * .9, vv.co.y * .6 - .004, vv.co.z * 1.1))
    rib = new_obj('Mina_RibbonBow', bm, M['ribbon'], 'spine_03', arm); uv_box(rib, 20)
    for sx in (-1, 1):
        path = []
        for k in range(8):
            t = k / 7; p = kc + V((sx * (.004 + t * .018), 0, -t * .055))
            ll, _ = hit(ts, V((p.x, -.6, p.z)), V((0, 1, 0))); p.y = min(p.y, (ll.y - .006) if ll else p.y); path.append(p)
        sweep(f'Mina_RibbonTail_{"L" if sx > 0 else "R"}', path, lambda t: .016 + t * .006, lambda p, i: fwd, M['ribbon'], 'spine_03', arm, thick=.0025)
    # ── 교표 (왼쪽 가슴) · 단추 2개
    zc = HB('spine_03').z + .015; l, n = hit(ts, V((.088, -.6, zc)), V((0, 1, 0)))
    if l: decal('Mina_Emblem', l, n, V((0, 0, 1)), .036, .042, M['gold'], 'spine_03', arm, offset=.003, tree=ts, segs=4)
    for k, zb in enumerate((HB('spine_01').z + .02, HB('spine_01').z - .055)):
        l, n = hit(ts, V((0, -.6, zb)), V((0, 1, 0)))
        if not l: continue
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=.0085, radius2=.007, depth=.004)
        R = V((0, 0, 1)).rotation_difference(n).to_matrix().to_4x4()
        for vv in bm.verts: vv.co = l + n * .002 + R @ vv.co
        new_obj(f'Mina_Button{k}', bm, M['button'], 'spine_02' if k == 0 else 'spine_01', arm)
    # ── 백팩: 등 표면에 맞춘 둥근 상자 + 앞 포켓 + 지퍼 + 어깨끈(어깨 위로 넘어가는 띠) + 손잡이
    zt = HB('spine_03').z + .07; zb = HB('spine_01').z - .02
    backs = []
    for z in (zt, (zt + zb) / 2, zb):
        for x in (-.09, 0, .09):
            l, _ = hit(ts, V((x, .6, z)), V((0, -1, 0)))
            if l: backs.append(l)
    by = max(p.y for p in backs) + .012; bw, bh, bd = .27, zt - zb + .04, .12; bc = V((0, by + bd / 2, (zt + zb) / 2))
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.); bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=4, use_grid_fill=True)
    for vv in bm.verts:
        x, y, z = vv.co.x, vv.co.y, vv.co.z; p = bc + V((x * bw * (1 - (z + .5) * .1), y * bd * (1 - (z + .5) * .25), z * bh))
        if y < -.49:   # 등에 닿는 면은 블라우스 등 곡면을 따라간다
            l, _ = hit(ts, V((p.x, .6, p.z)), V((0, -1, 0)))
            if l: p.y = l.y + .01
        elif y < .49: p.y = max(p.y, bc.y - bd / 2 + .02)
        vv.co = p
    bag = new_obj('Mina_Backpack', bm, M['bag'], 'spine_03', arm); mod_apply(bag, 'SUBSURF', levels=2); uv_box(bag, 6)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.); pc = bc + V((0, bd / 2 + .025, -bh * .2))
    for vv in bm.verts: vv.co = pc + V((vv.co.x * bw * .78, vv.co.y * .05, vv.co.z * bh * .42))
    pk = new_obj('Mina_BackpackPocket', bm, M['bag'], 'spine_03', arm); mod_apply(pk, 'BEVEL', width=.018, segments=3); uv_box(pk, 6)
    zp = []
    for k in range(25):   # 위쪽 지퍼선 (호)
        a = math.pi * k / 24; zp.append(bc + V((-math.cos(a) * bw * .44, bd / 2 + .002, bh * .18 + math.sin(a) * bh * .26)))
    sweep('Mina_Zipper', zp, .008, lambda p, i: V((0, 1, 0)), M['zip'], 'spine_03', arm, thick=.002)
    pull = zp[3] + V((0, .004, -.012))
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.)
    for vv in bm.verts: vv.co = pull + V((vv.co.x * .008, vv.co.y * .003, vv.co.z * .022))
    new_obj('Mina_ZipPull', bm, M['zip'], 'spine_03', arm)
    # 토끼 키링: 고리 끈 + 몸통 · 머리 · 귀 · 눈 (지퍼 손잡이에 매달림)
    kp = pull + V((0, .006, -.03)); bm = bmesh.new()
    for (r, off, sc) in [(.022, (0, 0, -.045), (1, .85, 1.1)), (.017, (0, 0, -.01), (1, .9, .95))]:
        g = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=r)
        for vv in g['verts']: vv.co = kp + V(off) + V((vv.co.x * sc[0], vv.co.y * sc[1], vv.co.z * sc[2]))
    for sx in (-1, 1):
        g = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=.006)
        for vv in g['verts']: vv.co = kp + V((sx * .008, 0, .018)) + V((vv.co.x, vv.co.y * .6, vv.co.z * 3.))
    bun = new_obj('Mina_BunnyKeyring', bm, M['bunny'], 'spine_03', arm); uv_box(bun, 10)
    bm = bmesh.new()
    for sx in (-1, 1):
        g = bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=.0028)
        for vv in g['verts']: vv.co += kp + V((sx * .0065, .0145, -.008))
    new_obj('Mina_BunnyEyes', bm, M['eye'], 'spine_03', arm)
    sweep('Mina_KeyringCord', [pull + V((0, .003, -.01)), kp + V((0, .002, .006))], .003, lambda p, i: V((0, 1, 0)), M['strap'], 'spine_03', arm, thick=.002)
    # 어깨끈: 가방 위쪽 → 어깨 위 → 가슴 앞 → 겨드랑이 아래로 (블라우스 표면에서 5mm 띄움)
    for sx, side in ((1, 'l'), (-1, 'r')):
        cl = HB(f'upperarm_{side}'); xs = cl.x * .62; path = []
        cz = cl.z - .03; cyy = cl.y
        for k in range(22):
            a = math.radians(-70 + k * 205 / 21)    # 등 아래(-70°) → 어깨 위(90°) → 앞 아래(135°)
            d = V((0, math.cos(a), math.sin(a))); o = V((xs, cyy, cz)) + d * .45; l, n = hit(ts, o, -d)
            if not l: l, n = hit(tb, o, -d)
            if l: path.append(l + d * .006)
        ends = [path[0] + V((0, .01, -.04)), path[-1] + V((sx * .03, .01, -.06))]
        path = [ends[0]] + path + [ends[1]]
        sweep(f'Mina_Strap_{side.upper()}', path, .036, lambda p, i, xs=xs: (p - V((xs, cyy, cz))).normalized(), M['strap'], 'spine_03', arm, thick=.005)
    hp = [bc + V((x * .05, bd * .1, bh / 2 + .012 + math.sin((x + 1) / 2 * math.pi) * .03)) for x in [-1 + k / 6 for k in range(13)]]
    sweep('Mina_BackpackHandle', hp, .018, lambda p, i: V((0, 1, 0)), M['strap'], 'spine_03', arm, thick=.006)
    out.update(bangs=bangs, bag=bag, mats=M)
    return out
