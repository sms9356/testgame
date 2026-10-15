# 민아 (162cm · 17세 · 서현고 방송부장) — MakeHuman CC0 인체 + 직접 만든 교복 텍스처 · 플리츠 · 장비 · 리그 · 표정 · 동작
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, bpy, bmesh, math
import mhlib as L, body as BODY
HERE = os.path.dirname(os.path.abspath(__file__)); TEX = os.path.join(HERE, 'tex')
base, coord, used, parts, objs = BODY.build(); body = objs['body']
def mh(d, f): return os.path.join(L.MH, d, f)
def tx(n, fb): p = os.path.join(TEX, n); return p if os.path.exists(p) else fb
mt = {'body': L.tex_mat('Mina_Skin', diffuse=tx('mina_skin_diffuse.png', mh('skins/textures', 'young_lightskinned_female_diffuse3.png')), normal=tx('mina_skin_normal.png', None), rough=.48, normal_strength=.25),
      'eyes': L.tex_mat('Mina_Eye', diffuse=mh('eyes/materials', 'brown_eye.png'), rough=.06),
      'brows': L.tex_mat('Mina_Brow', diffuse=tx('mina_brow.png', mh('eyebrows/eyebrow010', 'eyebrow010.png')), alpha=True, rough=.8),
      'lashes': L.tex_mat('Mina_Lash', diffuse=mh('eyelashes/eyelashes02', 'eyelashes02.png'), alpha=True, rough=.8),
      'teeth': L.tex_mat('Mina_Teeth', color=(.86, .84, .78), rough=.3), 'tongue': L.tex_mat('Mina_Tongue', color=(.6, .3, .32), rough=.4),
      'hair': L.tex_mat('Mina_Hair', diffuse=tx('mina_hair_diffuse.png', mh('hair/ponytail01', 'ponytail01_diffuse.png')), alpha=True, rough=.72),
      'suit': L.tex_mat('Mina_Uniform', diffuse=tx('mina_suit_diffuse.png', mh('clothes/female_elegantsuit01', 'female_elegantsuit01_diffuse.png')), normal=mh('clothes/female_elegantsuit01', 'female_elegantsuit01_normal.png'), ao=mh('clothes/female_elegantsuit01', 'female_elegantsuit01_ao.png'), rough=.86, normal_strength=.6),
      'shoes': L.tex_mat('Mina_Loafers', diffuse=tx('mina_shoes_diffuse.png', mh('clothes/shoes01', 'shoes01_diffuse.png')), normal=mh('clothes/shoes01', 'shoes01_normal.png'), rough=.3)}
for k, ob in objs.items(): ob.data.materials.append(mt[k])
# ── 리그
skel = L.load_skel('game_engine'); bw = L.base_weights(skel)
arm = L.build_armature('Mina_Rig', coord, skel)
miss = L.assign_weights(body, L.body_bone_weights(bw, used), arm)
for k, px in parts.items():
    pw = L.proxy_weights(px, bw)
    if k in ('eyes', 'brows', 'lashes', 'teeth', 'tongue'): pw = {'head': np.ones(len(px['ref']))}
    if k == 'hair':   # 포니테일은 머리 + 목 아래로 늘어진 부분만 목/상체를 약하게 따른다
        z = np.array([v.co.z for v in objs['hair'].data.vertices]); hz = arm.data.bones['head'].head_local.z
        t = np.clip((hz - z) / .2, 0, 1); pw = {'head': 1 - t * .6, 'neck_01': t * .4, 'spine_03': t * .2}
    miss += L.assign_weights(objs[k], pw, arm)
print('UNWEIGHTED', miss)
# ── 표정 모프
U = lambda n: f'expression/units/asian/{n}'
EXPR = {
 'Surprised': {'eye-left-opened-up': 1., 'eye-right-opened-up': 1., 'eyebrows-left-up': 1., 'eyebrows-right-up': 1., 'mouth-open': .4},
 'Sad': {'eyebrows-left-inner-up': .9, 'eyebrows-right-inner-up': .9, 'eye-left-closure': .3, 'eye-right-closure': .3, 'mouth-depression': .55},
 'Talk': {'mouth-open': .4, 'mouth-parling': .3},
 'Fear': {'eye-left-opened-up': .8, 'eye-right-opened-up': .8, 'eyebrows-left-inner-up': 1., 'eyebrows-right-inner-up': 1., 'mouth-open': .3, 'mouth-retraction': .5, 'neck-platysma': .4},
 'Pain': {'eye-left-closure': .65, 'eye-right-closure': .65, 'eyebrows-left-inner-up': .8, 'eyebrows-right-inner-up': .8, 'eyebrows-left-down': .3, 'eyebrows-right-down': .3, 'mouth-retraction': .4},
 'Asleep': {'eye-left-closure': 1., 'eye-right-closure': 1., 'mouth-open': .08, 'eyebrows-left-inner-up': .25, 'eyebrows-right-inner-up': .25},
 'Relief': {'mouth-corner-puller': .35, 'eyebrows-left-inner-up': .4, 'eyebrows-right-inner-up': .4, 'eye-left-closure': .15, 'eye-right-closure': .15},
 'Blink': {'eye-left-closure': 1., 'eye-right-closure': 1.}}
sk_obj = [body] + [objs[k] for k in ('brows', 'lashes', 'teeth', 'tongue')]
for ob in sk_obj: ob.shape_key_add(name='Basis', from_mix=False)
for en, units in EXPR.items():
    tw = {}
    for u, w in units.items():
        if L.has_target(U(u)): tw[U(u)] = w
        else: print('NO_UNIT', u)
    c2 = L.apply_targets(coord, tw)
    sk = body.shape_key_add(name=en, from_mix=False); sk.data.foreach_set('co', L.to_blender(c2)[used].astype(np.float32).ravel())
    for k in ('brows', 'lashes', 'teeth', 'tongue'):
        s2 = objs[k].shape_key_add(name=en, from_mix=False); s2.data.foreach_set('co', L.to_blender(L.fit_proxy(parts[k], c2)).astype(np.float32).ravel())
def fill_unweighted(ob):
    vs = ob.data.vertices; empty = [v.index for v in vs if not v.groups]
    if not empty: return 0
    full = np.array([v.index for v in vs if v.groups]); Pp = np.array([vs[i].co[:] for i in full])
    for i in empty:
        j = full[np.argmin(((Pp - np.array(vs[i].co[:])) ** 2).sum(1))]
        for g in vs[j].groups: ob.vertex_groups[g.group].add([i], g.weight, 'REPLACE')
    return len(empty)
print('FILLED', fill_unweighted(body))
for ob in sk_obj:
    for kb in ob.data.shape_keys.key_blocks[1:]: kb.value = 0.
# ── 플리츠 스커트: 스커트 섬(가장 아래 덩어리)을 잘게 나누고 허리 아래로 맞주름(24개) + 살짝 A라인으로 퍼지게
su = objs['suit']; bm = bmesh.new(); bm.from_mesh(su.data); bm.verts.ensure_lookup_table()
seen = set(); isl = []
for v in bm.verts:
    if v.index in seen: continue
    st = [v]; comp = []; seen.add(v.index)
    while st:
        x = st.pop(); comp.append(x)
        for e in x.link_edges:
            o = e.other_vert(x)
            if o.index not in seen: seen.add(o.index); st.append(o)
    isl.append(comp)
sk_isl = min(isl, key=lambda c: min(v.co.z for v in c)); skv = set(sk_isl)
faces = [f for f in bm.faces if all(v in skv for v in f.verts)]
edges = list({e for f in faces for e in f.edges})
bmesh.ops.subdivide_edges(bm, edges=edges, cuts=2, use_grid_fill=True)
bm.to_mesh(su.data); bm.free(); su.data.update()
pel = arm.data.bones['pelvis'].head_local; cx, cy = pel.x, pel.y
# 스커트 정점 고르기: 스커트 섬은 블라우스보다 아래(z<0.91)이거나, 블라우스 섬과 겹치는 허리 부분이므로 재질 분류용으로 위치+섬을 같이 쓴다
bm = bmesh.new(); bm.from_mesh(su.data); bm.verts.ensure_lookup_table()
seen = set(); isl = []
for v in bm.verts:
    if v.index in seen: continue
    st = [v]; comp = []; seen.add(v.index)
    while st:
        x = st.pop(); comp.append(x.index)
        for e in x.link_edges:
            o = e.other_vert(x)
            if o.index not in seen: seen.add(o.index); st.append(o)
    isl.append(comp)
bm.free()
skirt_ids = min(isl, key=lambda c: min(su.data.vertices[i].co.z for i in c))
ztop = max(su.data.vertices[i].co.z for i in skirt_ids); zbot = min(su.data.vertices[i].co.z for i in skirt_ids)
NP = 26; hip_z = ztop - .1
for i in skirt_ids:
    co = su.data.vertices[i].co; t = max(0., min(1., (hip_z - co.z) / (hip_z - zbot)))
    if t <= 0: continue
    a = math.atan2(co.y - cy, co.x - cx); ph = (a / (2 * math.pi) * NP) % 1.
    saw = (abs(ph - .5) * 2) ** 1.5 - .45            # 맞주름: 바깥 접힘 날카롭게
    d = (co.x - cx, co.y - cy)
    k = 1 + .16 * t ** 1.2 + .055 * saw * t ** .7       # A라인 + 주름 깊이
    su.data.vertices[i].co.x = cx + d[0] * k; su.data.vertices[i].co.y = cy + d[1] * k
import json; json.dump({'skirt_ids': skirt_ids, 'hip_z': hip_z, 'zbot': zbot, 'cx': cx, 'cy': cy}, open(os.path.join(HERE, 'skirt.json'), 'w'))
import gear; G = gear.build(arm, objs['suit'], objs['hair'], body, TEX)
if os.environ.get('NOANIM') != '1':
    import anim; CL = anim.build_all(arm); print('ANIMS', [(n, f) for n, f, a in CL])
np.save(os.path.join(HERE, 'mina_coord.npy'), coord)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'mina_rigged.blend'))
print('SAVED rigged')
