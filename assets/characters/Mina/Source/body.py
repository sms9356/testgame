# 민아 (162cm · 17세 한국 여고생) — MakeHuman CC0 인체 · 프록시 · 리그 · 표정 모프 (공통 1단계)
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, bpy
import mhlib as L
HERE = os.path.dirname(os.path.abspath(__file__)); TEX = os.path.join(HERE, 'tex')
TARGET_H = 1.62
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    base = L.load_mesh(os.path.join(L.MH, '3dobjs', 'base.npz'))
    tw = L.macro_targets(gender=0., years=17, race={'asian': 1.}, muscle=.42, weight=.42, height=.72, prop=.7)
    FACE = [('head/head-oval', .45), ('chin/chin-width', -.25), ('chin/chin-prominent', -.15), ('nose/nose-scale-horiz', -.15), ('nose/nose-point-width', -.2),
            ('eyes/r-eye-scale', .2), ('eyes/l-eye-scale', .2), ('eyes/r-eye-height2', .15), ('eyes/l-eye-height2', .15), ('mouth/mouth-scale-horiz', -.12),
            ('cheek/r-cheek-volume', .15), ('cheek/l-cheek-volume', .15), ('neck/neck-scale-horiz', -.2), ('mouth/mouth-lowerlip-volume', .2)]
    for n, v in FACE:
        try: k, w = L.find_target(n, v); tw[k] = tw.get(k, 0) + w
        except KeyError: print('NO_TARGET', n)
    coord0 = L.apply_targets(base['coord'], tw)
    isbody = np.array([not (n.startswith('helper') or n.startswith('joint')) for n in base['gnames']])
    bodyv = np.unique(base['fvert'][isbody[base['group']]]); coord = coord0 - [0, coord0[bodyv, 1].min(), 0]
    h = coord[bodyv, 1].max() * .1; coord = coord * (TARGET_H / h); print('HEIGHT_M raw', round(h, 3), '->', TARGET_H)
    def P(dirp, name): return L.load_proxy(os.path.join(L.MH, dirp), name)
    parts = {'eyes': P('eyes/high-poly', 'high-poly'), 'brows': P('eyebrows/eyebrow010', 'eyebrow010'), 'lashes': P('eyelashes/eyelashes02', 'eyelashes02'),
             'teeth': P('teeth/teeth_base', 'teeth_base'), 'tongue': P('tongue/tongue01', 'tongue01'), 'hair': P('hair/ponytail01', 'ponytail01'),
             'suit': P('clothes/female_elegantsuit01', 'female_elegantsuit01'), 'shoes': P('clothes/shoes01', 'shoes01')}
    dele = parts['suit']['delete'] | parts['shoes']['delete']
    fmask = isbody[base['group']] & ~np.any(dele[base['fvert']], axis=1)
    body, used = L.make_obj('Mina_Body', L.to_blender(coord), base['fvert'], base['fuvs'], base['texco'], fmask)
    objs = {'body': body}
    for k, px in parts.items():
        m = px['mesh']; ob, _ = L.make_obj('Mina_' + k.capitalize(), L.to_blender(L.fit_proxy(px, coord)), m['fvert'], m['fuvs'], m['texco']); objs[k] = ob
    return base, coord, used, parts, objs
