# 경비원 (175cm · 60대 한국 남성) — MakeHuman CC0 기반 인체 + 직접 모델링한 장비 · 리그 · 표정 · 동작 · 내보내기
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, bpy, math, json, mathutils
import mhlib as L
HERE = os.path.dirname(os.path.abspath(__file__)); TEX = os.path.join(HERE, 'tex'); STAGE = os.environ.get('STAGE', 'all')
bpy.ops.wm.read_factory_settings(use_empty=True)
base = L.load_mesh(os.path.join(L.MH, '3dobjs', 'base.npz'))
tw = L.macro_targets(gender=1., years=60, race={'asian': 1.}, muscle=.5, weight=.58, height=.6, prop=.5)
FACE = [('head/head-age', .7), ('head/head-square', .6), ('head/head-fat', -.1), ('mouth/mouth-laugh-lines', 1.), ('mouth/mouth-upperlip-height', -.2), ('mouth/mouth-lowerlip-height', -.1),
        ('eyes/r-eye-bag', .8), ('eyes/l-eye-bag', .8), ('cheek/r-cheek-bones', .5), ('cheek/l-cheek-bones', .5), ('cheek/r-cheek-volume', -.3), ('cheek/l-cheek-volume', -.3),
        ('chin/chin-width', .35), ('chin/chin-bones', .4), ('chin/chin-prominent', .25), ('nose/nose-width1', .25), ('nose/nose-point-width', .25), ('nose/nose-scale-vert', .1),
        ('neck/neck-double', .15), ('eyes/r-eye-height2', .3), ('eyes/l-eye-height2', .3), ('eyes/r-eye-height1', .15), ('eyes/l-eye-height1', .15), ('nose/nose-scale-horiz', .2), ('nose/nose-volume', .2), ('nose/nose-nostrils-width', .3), ('nose/nose-hump', .25), ('eyebrows/eyebrows-trans', -.3), ('neck/neck-scale-horiz', .25), ('forehead/forehead-temple', .2)]
for n, v in FACE:
    k, w = L.find_target(n, v); tw[k] = tw.get(k, 0) + w
coord0 = L.apply_targets(base['coord'], tw)
isbody = np.array([not (n.startswith('helper') or n.startswith('joint')) for n in base['gnames']])
bodyv = np.unique(base['fvert'][isbody[base['group']]]); coord = coord0 - [0, coord0[bodyv, 1].min(), 0]
print('HEIGHT_M', (coord[bodyv, 1].max()) * .1)
D = L.MH
def P(dirp, name): return L.load_proxy(os.path.join(D, dirp), name)
parts = {'eyes': P('eyes/high-poly', 'high-poly'), 'brows': P('eyebrows/eyebrow009', 'eyebrow009'), 'lashes': P('eyelashes/eyelashes02', 'eyelashes02'),
         'teeth': P('teeth/teeth_base', 'teeth_base'), 'tongue': P('tongue/tongue01', 'tongue01'), 'hair': P('hair/short01', 'short01'),
         'suit': P('clothes/male_casualsuit05', 'male_casualsuit05'), 'shoes': P('clothes/shoes03', 'shoes03')}
dele = parts['suit']['delete'] | parts['shoes']['delete']
fmask = isbody[base['group']] & ~np.any(dele[base['fvert']], axis=1)
col = bpy.context.scene.collection
body, used = L.make_obj('Guard_Body', L.to_blender(coord), base['fvert'], base['fuvs'], base['texco'], fmask)
objs = {'body': body}
for k, px in parts.items():
    m = px['mesh']; ob, _ = L.make_obj('Guard_' + k.capitalize(), L.to_blender(L.fit_proxy(px, coord)), m['fvert'], m['fuvs'], m['texco']); objs[k] = ob
# ── 재질
def mh(d, f): return os.path.join(L.MH, d, f)
mt = {'body': L.tex_mat('Guard_Skin', diffuse=os.path.join(TEX, 'guard_skin_diffuse.png'), normal=os.path.join(TEX, 'guard_skin_normal.png') if os.path.exists(os.path.join(TEX, 'guard_skin_normal.png')) else None, rough=.5, normal_strength=.35),
      'eyes': L.tex_mat('Guard_Eye', diffuse=mh('eyes/materials', 'brown_eye.png'), rough=.06),
      'brows': L.tex_mat('Guard_Brow', diffuse=mh('eyebrows/eyebrow009', 'eyebrow009.png'), alpha=True, rough=.8),
      'lashes': L.tex_mat('Guard_Lash', diffuse=mh('eyelashes/eyelashes02', 'eyelashes02.png'), alpha=True, rough=.8),
      'teeth': L.tex_mat('Guard_Teeth', color=(.8, .76, .66), rough=.3), 'tongue': L.tex_mat('Guard_Tongue', color=(.55, .25, .25), rough=.4),
      'hair': L.tex_mat('Guard_Hair', diffuse=os.path.join(TEX, 'guard_hair_diffuse.png'), alpha=True, rough=.65),
      'suit': L.tex_mat('Guard_Uniform', diffuse=os.path.join(TEX, 'guard_suit_diffuse.png'), normal=mh('clothes/male_casualsuit05', 'male_casualsuit05_normal.png'), ao=mh('clothes/male_casualsuit05', 'male_casualsuit05_ao.png'), rough=.88),
      'shoes': L.tex_mat('Guard_Boots', diffuse=mh('clothes/shoes03', 'shoes03_diffuse.png'), rough=.35)}
for k, ob in objs.items(): ob.data.materials.append(mt[k])
# ── 리그
skel = L.load_skel('game_engine'); bw = L.base_weights(skel)
arm = L.build_armature('Guard_Rig', coord, skel)
miss = L.assign_weights(body, L.body_bone_weights(bw, used), arm)
for k, px in parts.items():
    pw = L.proxy_weights(px, bw)
    if k in ('eyes', 'brows', 'lashes', 'teeth', 'tongue', 'hair'): pw = {'head': np.ones(len(px['ref']))}   # 머리에 붙은 것은 head 하나로 (턱 · 눈꺼풀 표정은 모프로)
    miss += L.assign_weights(objs[k], pw, arm)
print('UNWEIGHTED', miss)
# ── 표정 모프 (MakeHuman CC0 표정 단위 타깃 조합) — 몸 + 눈썹 · 속눈썹 · 치아에 같이
U = lambda n: f'expression/units/asian/{n}'
EXPR = {
 'Alert': {'eye-left-slit': .45, 'eye-right-slit': .45, 'eyebrows-left-down': .35, 'eyebrows-right-down': .35, 'mouth-compression': .3},
 'Surprised': {'eye-left-opened-up': 1., 'eye-right-opened-up': 1., 'eyebrows-left-up': 1., 'eyebrows-right-up': 1., 'mouth-open': .45},
 'Angry': {'eyebrows-left-down': 1., 'eyebrows-right-down': 1., 'eye-left-slit': .35, 'eye-right-slit': .35, 'nose-left-elevation': .4, 'nose-right-elevation': .4, 'mouth-compression': .6},
 'Sad': {'eyebrows-left-inner-up': .9, 'eyebrows-right-inner-up': .9, 'eye-left-closure': .3, 'eye-right-closure': .3, 'mouth-depression': .6},
 'Talk': {'mouth-open': .45, 'mouth-parling': .3},
 'Tense': {'mouth-retraction': .5, 'eyebrows-left-down': .3, 'eyebrows-right-down': .3, 'neck-platysma': .5, 'eye-left-slit': .2, 'eye-right-slit': .2},
 'Fear': {'eye-left-opened-up': .8, 'eye-right-opened-up': .8, 'eyebrows-left-inner-up': 1., 'eyebrows-right-inner-up': 1., 'mouth-open': .35, 'mouth-retraction': .6, 'neck-platysma': .6},
 'Blink': {'eye-left-closure': 1., 'eye-right-closure': 1.}}
for ob in [body] + [objs[k] for k in ('brows', 'lashes', 'teeth', 'tongue')]: ob.shape_key_add(name='Basis', from_mix=False)
for en, units in EXPR.items():
    c2 = L.apply_targets(coord, {U(u): w for u, w in units.items()})
    sk = body.shape_key_add(name=en, from_mix=False); sk.data.foreach_set('co', L.to_blender(c2)[used].astype(np.float32).ravel())
    for k in ('brows', 'lashes', 'teeth', 'tongue'):
        s2 = objs[k].shape_key_add(name=en, from_mix=False); s2.data.foreach_set('co', L.to_blender(L.fit_proxy(parts[k], c2)).astype(np.float32).ravel())
# 빈 가중치 정점(입 안쪽 등)은 가장 가까운 정점의 가중치를 받는다
def fill_unweighted(ob):
    vs = ob.data.vertices; empty = [v.index for v in vs if not v.groups]
    if not empty: return 0
    full = np.array([v.index for v in vs if v.groups]); P = np.array([vs[i].co[:] for i in full])
    for i in empty:
        j = full[np.argmin(((P - np.array(vs[i].co[:])) ** 2).sum(1))]
        for g in vs[j].groups: ob.vertex_groups[g.group].add([i], g.weight, 'REPLACE')
    return len(empty)
print('FILLED', fill_unweighted(body))
for ob in [body] + [objs[k] for k in ('brows', 'lashes', 'teeth', 'tongue')]:
    for kb in ob.data.shape_keys.key_blocks[1:]: kb.value = 0.
import gear; G = gear.build(arm, objs['suit'], objs['hair'], body, TEX)
import anim; CL = anim.build_all(arm); print('ANIMS', [(n, f) for n, f, a in CL])
np.save(os.path.join(HERE, 'guard_coord.npy'), coord)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'guard_rigged.blend'))
print('SAVED rigged')
