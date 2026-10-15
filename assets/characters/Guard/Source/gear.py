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
def build(arm, suit, hair, body, TEX):
    B = arm.data.bones; HB = lambda n: B[n].head_local.copy(); TB = lambda n: B[n].tail_local.copy()
    ts = bvh(suit); th = bvh(hair); tb = bvh(body)
    M = {'cap': mat_simple('Guard_CapFabric', (.12, .14, .22), .85, tex=os.path.join(TEX, 'cap_fabric_diffuse.png'), normal=os.path.join(TEX, 'cap_fabric_normal.png')),
         'band': mat_simple('Guard_CapBand', (.018, .018, .022), .55, 0.), 'brim': mat_simple('Guard_CapBrim', (.012, .013, .018), .3, 0.),
         'badge': mat_simple('Guard_Badge', (.8, .62, .3), .32, .95, tex=os.path.join(TEX, 'badge_diffuse.png'), normal=os.path.join(TEX, 'badge_normal.png'), alpha_tex=True),
         'leather': mat_simple('Guard_Leather', (.05, .05, .05), .5, tex=os.path.join(TEX, 'leather_diffuse.png'), normal=os.path.join(TEX, 'leather_normal.png'), rough_tex=os.path.join(TEX, 'leather_rough.png')),
         'metal': mat_simple('Guard_Steel', (.62, .62, .6), .28, 1.), 'black': mat_simple('Guard_BlackMetal', (.03, .03, .035), .38, .75),
         'tie': mat_simple('Guard_Tie', (.07, .08, .13), .6, tex=os.path.join(TEX, 'tie_diffuse.png')),
         'pshoulder': mat_simple('Guard_PatchShoulder', (1, 1, 1), .8, tex=os.path.join(TEX, 'patch_shoulder.png'), alpha_tex=True),
         'pchest': mat_simple('Guard_PatchChest', (1, 1, 1), .8, tex=os.path.join(TEX, 'patch_chest.png')), 'name': mat_simple('Guard_NameTag', (1, 1, 1), .35, tex=os.path.join(TEX, 'nametag.png')),
         'lens': mat_simple('Guard_Lens', (.9, .9, .8), .1, emit=((1, .95, .8), 4.)), 'red': mat_simple('Guard_Baton', (.85, .08, .05), .3, emit=((1, .1, .05), 1.5)),
         'plastic': mat_simple('Guard_Plastic', (.04, .04, .045), .55)}
    for k in ('badge', 'pshoulder'):
        try: M[k].surface_render_method = 'DITHERED'
        except Exception: pass
    out = {}
    # ── 모자: 머리카락 모양에 맞춘 크라운 + 밴드 + 챙 + 배지 + 단추
    hv = [hair.matrix_world @ v.co for v in hair.data.vertices]; hz = max(p.z for p in hv)
    bv = [v.co for v in body.data.vertices if v.co.z > HB('head').z]
    xs = [p.x for p in hv + bv]; ys = [p.y for p in hv + bv]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    eye_z = max((v.co.z for v in body.data.vertices if abs(v.co.x) < .05 and v.co.y < cy - .07 and HB('head').z < v.co.z < hz - .08), default=HB('head').z + .1)
    cut_front = HB('head').z + (hz - HB('head').z) * .5; cut_back = cut_front - .03
    # 머리 둘레(밴드 높이)를 64방향으로 재서 매끈한 타원 링을 만들고, 그 위로 크라운 · 아래 앞쪽으로 챙을 세운다 (모자를 매개변수 곡면으로)
    NA = 64; pts_all = hv + [body.matrix_world @ v.co for v in body.data.vertices if v.co.z > HB('head').z]
    zb_at = lambda a: cut_front + (cut_back - cut_front) * (math.sin(a) * .5 + .5)   # 앞(-y, sin=-1)이 높다
    rad = []
    for k in range(NA):
        a = k / NA * 2 * math.pi - math.pi; zb = zb_at(a); best = 0
        for p in pts_all:
            if abs(p.z - zb) > .02: continue
            dx, dy = p.x - cx, p.y - cy; ang = math.atan2(dy, dx)
            if abs((ang - a + math.pi) % (2 * math.pi) - math.pi) < math.pi / NA * 1.6: best = max(best, math.hypot(dx, dy))
        rad.append(best)
    med = sorted(r for r in rad if r > 0)[len([r for r in rad if r > 0]) // 2]; rad = [r if r > 0 else med for r in rad]
    rad = [sum(rad[(k + j) % NA] for j in range(-3, 4)) / 7 + .009 for k in range(NA)]
    hc_front, hc_back, NV = .128, .108, 14
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); grid = []
    for j in range(NV + 1):
        v = j / NV; row = []
        for k in range(NA):
            a = k / NA * 2 * math.pi - math.pi; fr = max(0., -math.sin(a)); hc = hc_back + (hc_front - hc_back) * fr
            r = rad[k] * (1 + .06 * v * (1 - v) * 2 - .5 * v ** 3.6 * (1 - .3 * fr)); z = zb_at(a) + hc * (math.sin(v * math.pi / 2) ** .9)
            row.append(bm.verts.new((cx + math.cos(a) * r, cy + math.sin(a) * r, z)))
        grid.append(row)
    top = bm.verts.new((cx, cy + .005, max(v.co.z for v in grid[-1]) + .004))
    for j in range(NV):
        for k in range(NA):
            f = bm.faces.new([grid[j][k], grid[j][(k + 1) % NA], grid[j + 1][(k + 1) % NA], grid[j + 1][k]])
            f.material_index = 1 if j < 2 else 0
            for lp, (uu, vv) in zip(f.loops, [(k, j), (k + 1, j), (k + 1, j + 1), (k, j + 1)]): lp[uvl].uv = (uu / NA * 4, vv / NV)
    for k in range(NA): bm.faces.new([grid[-1][k], grid[-1][(k + 1) % NA], top])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ring0 = [V(v.co) for v in grid[0]]
    cap = new_obj('Guard_Cap', bm, [M['cap'], M['band'], M['badge']], 'head', arm)
    so = cap.modifiers.new('so', 'SOLIDIFY'); so.thickness = .004; so.offset = -1; bpy.context.view_layer.objects.active = cap; bpy.ops.object.modifier_apply(modifier='so')
    # 챙: 앞쪽 110° (밴드 링에서 바깥 · 아래로 18°)
    bm = bmesh.new(); inner = []; outer = []; ks = [k for k in range(NA) if -math.sin(k / NA * 2 * math.pi - math.pi) > .34]
    ks.sort(key=lambda k: math.atan2(ring0[k].y - cy, ring0[k].x - cx))
    for k in ks:
        p = ring0[k]; d = V((p.x - cx, p.y - cy, 0)).normalized(); fr = max(0., -d.y)
        fw = .072 * ((fr - .34) / .66) ** .55 + .003
        inner.append(bm.verts.new(p + V((0, 0, .001)))); outer.append(bm.verts.new(p + d * fw + V((0, 0, -fw * math.tan(math.radians(18)) + .001))))
    for i in range(len(ks) - 1): bm.faces.new([inner[i], inner[i + 1], outer[i + 1], outer[i]])
    brim = new_obj('Guard_CapBrim', bm, M['brim'], 'head', arm); mod_apply(brim, 'SOLIDIFY', thickness=.005, offset=0)
    fk = min(range(NA), key=lambda k: ring0[k].y); fp = ring0[fk] + V((0, -.004, .05)); fn = V((0, -1, .12)).normalized()
    badge = decal('Guard_CapBadge', fp, fn, V((0, .12, 1)), .045, .05, M['badge'], 'head', arm, offset=.002, segs=4)
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=.008, radius2=.006, depth=.006)
    tp = max((cap.matrix_world @ v.co for v in cap.data.vertices), key=lambda p: p.z)
    for v in bm.verts: v.co += tp + V((0, 0, .001))
    btn = new_obj('Guard_CapButton', bm, M['cap'], 'head', arm)
    # ── 넥타이: 목 아래부터 허리띠 위까지 셔츠 앞면을 따라
    zt, zb = HB('neck_01').z - .035, HB('pelvis').z + .14
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); rows = []; S = 14
    for j in range(S + 1):
        t = j / S; z = zt + (zb - zt) * t; w = (.042 + (.085 - .042) * t ** .8) / 2
        row = []
        for sx in (-1, 0, 1):
            l, n = hit(ts, V((sx * w, -.6, z)), V((0, 1, 0)))
            p = (l if l else V((sx * w, -.12, z))) + V((0, -.006, 0)); row.append(bm.verts.new(p))
        rows.append(row)
    tip = bm.verts.new(rows[-1][1].co + V((0, -.002, -.045)))
    for j in range(S):
        for i in range(2): f = bm.faces.new([rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]])
    bm.faces.new([rows[-1][0], rows[-1][1], tip]); bm.faces.new([rows[-1][1], rows[-1][2], tip]); knot_p = rows[0][1].co.copy()
    tie = new_obj('Guard_Tie', bm, M['tie'], 'spine_03', arm); mod_apply(tie, 'SOLIDIFY', thickness=.004, offset=-1); uv_box(tie, 8)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.)
    for v in bm.verts: v.co = V((v.co.x * .045 * (1 - (v.co.z + .5) * .3), v.co.y * .018, v.co.z * .035)) + knot_p + V((0, -.006, .006))
    knot = new_obj('Guard_TieKnot', bm, M['tie'], 'spine_03', arm); uv_box(knot, 8)
    # ── 패치 · 명찰
    for side, bn in ((1, 'upperarm_l'), (-1, 'upperarm_r')):
        h0, t0 = HB(bn), TB(bn); p = h0 + (t0 - h0) * .26; d = V((side, 0, 0))
        l, n = hit(ts, p + d * .4, -d)
        if l: decal(f'Guard_PatchShoulder_{"L" if side > 0 else "R"}', l, n, (h0 - t0), .085, .085, M['pshoulder'], bn, arm, tree=ts)
    zc = HB('spine_03').z + .02
    l, n = hit(ts, V((.095, -.6, zc)), V((0, 1, 0)))
    if l: decal('Guard_PatchChest', l, n, V((0, 0, 1)), .1, .032, M['pchest'], 'spine_03', arm, tree=ts)
    l, n = hit(ts, V((-.095, -.6, zc)), V((0, 1, 0)))
    if l: decal('Guard_NameTag', l, n, V((0, 0, 1)), .082, .022, M['name'], 'spine_03', arm, offset=.005, tree=ts)
    # ── 허리띠 · 버클 · 파우치 · 열쇠 · 경광봉
    zb = HB('pelvis').z + .075; c0 = V((0, HB('pelvis').y, zb)); bm = bmesh.new(); ring = []; K = 56; pts = {}
    for k in range(K):
        a = k / K * 2 * math.pi; d = V((math.cos(a), math.sin(a), 0)); l, n = hit(ts, c0 + d * .5, -d); p = (l if l else c0 + d * .17) + d * .007
        ring.append((bm.verts.new(p - V((0, 0, .02))), bm.verts.new(p + V((0, 0, .02))))); pts[k] = (p, d)
    for k in range(K): a, b = ring[k], ring[(k + 1) % K]; bm.faces.new([a[0], b[0], b[1], a[1]])
    belt = new_obj('Guard_Belt', bm, M['leather'], 'pelvis', arm); mod_apply(belt, 'SOLIDIFY', thickness=.005, offset=1); uv_box(belt, 10)
    def boxat(name, p, d, size, mat, bevel=.004):
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.); r = d.cross(V((0, 0, 1))).normalized()
        for v in bm.verts: v.co = p + r * v.co.x * size[0] + d * (v.co.y * size[1] + size[1] / 2) + V((0, 0, v.co.z * size[2]))
        ob = new_obj(name, bm, mat, 'pelvis', arm)
        if bevel: mod_apply(ob, 'BEVEL', width=bevel, segments=2)
        uv_box(ob, 12); return ob
    front = pts[int(K * .75)]   # -y = 앞
    boxat('Guard_Buckle', front[0], front[1], (.062, .012, .046), M['metal'], .003)
    lp = pts[int(K * .93)]; boxat('Guard_RadioPouch', lp[0] + V((0, 0, -.045)), lp[1], (.07, .045, .12), M['leather'])
    radio = boxat('Guard_Radio', lp[0] + lp[1] * .01 + V((0, 0, .03)), lp[1], (.055, .032, .1), M['plastic'], .003)
    rp = pts[int(K * .57)]; boxat('Guard_Holster', rp[0] + V((0, 0, -.05)), rp[1], (.05, .045, .1), M['leather'])
    kp = pts[int(K * .68)]
    bm = bmesh.new(); bmesh.ops.create_circle(bm, segments=20, radius=.018)
    ringo = new_obj('Guard_KeyRing', bm, M['metal'], 'pelvis', arm); ringo.location = (0, 0, 0)
    for v in ringo.data.vertices: v.co = kp[0] + kp[1] * .012 + V((v.co.x, 0, v.co.y - .04))
    mod_apply(ringo, 'SCREW', angle=0, steps=1, screw_offset=0) if False else None
    sk = ringo.modifiers.new('sk', 'SKIN')
    for sv in ringo.data.skin_vertices[0].data: sv.radius = (.0016, .0016)
    bpy.context.view_layer.objects.active = ringo; bpy.ops.object.modifier_move_to_index(modifier='sk', index=0); bpy.ops.object.modifier_apply(modifier='sk')
    for v in ringo.data.vertices: pass
    for i in range(3):
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.)
        for v in bm.verts: v.co = kp[0] + kp[1] * .013 + V((v.co.x * .006 + (i - 1) * .012, v.co.y * .003, v.co.z * .045 - .075 - abs(i - 1) * .006))
        new_obj(f'Guard_Key{i}', bm, M['metal'], 'pelvis', arm)
    bp = pts[int(K * .45)]; bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=.016, radius2=.016, depth=.3)
    for v in bm.verts: v.co = bp[0] + bp[1] * .03 + V((v.co.x, v.co.y, v.co.z - .1))
    new_obj('Guard_Baton', bm, M['red'], 'pelvis', arm)
    # ── 손전등 (오른손에 쥠: 손바닥 쪽 · 손가락에 수직인 축)
    hh = HB('hand_r'); f = (HB('middle_01_r') - hh).normalized(); th_ = (HB('thumb_01_r') - hh); ax = (th_ - f * th_.dot(f)).normalized(); nrm = f.cross(ax).normalized()
    if nrm.dot(V((0, -1, 0))) < 0 and False: nrm = -nrm
    center = hh + f * .055 + nrm * -.03
    bm = bmesh.new()
    for (r1, r2, dep, off) in [(.016, .016, .15, 0), (.017, .024, .045, .095), (.017, .017, .02, -.085)]:
        g = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=r1, radius2=r2, depth=dep)
        for v in g['verts']: v.co.z += off
    rot = ax.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    for v in bm.verts: v.co = center + (rot @ v.co)
    fl_ob = new_obj('Guard_Flashlight', bm, M['black'], 'hand_r', arm)
    bm = bmesh.new(); bmesh.ops.create_circle(bm, segments=20, radius=.022, cap_ends=True)
    for v in bm.verts: v.co = center + (rot @ (v.co + V((0, 0, .118))))
    new_obj('Guard_FlashlightLens', bm, M['lens'], 'hand_r', arm)
    out.update(cap=cap, tie=tie, belt=belt, flashlight=fl_ob, radio=radio, mats=M)
    return out
