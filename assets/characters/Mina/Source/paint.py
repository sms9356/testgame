# 민아 텍스처 칠하기 — 메시의 3D 위치로 UV 공간을 채운다 (교복 블레이저 · 셔츠 V · 체크 플리츠 · 니삭스 · 머리 · 로퍼)
import bpy, sys, os, json, math, numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); TEX = os.path.join(HERE, 'tex'); os.makedirs(TEX, exist_ok=True)
D = os.environ.get('MH_DATA', os.path.join(HERE, '..', 'mh', 'x', 'makehuman', 'data'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'mina_rigged.blend'))
arm = bpy.data.objects['Mina_Rig']; B = arm.data.bones; HB = lambda n: B[n].head_local.copy(); TB = lambda n: B[n].tail_local.copy()
rs = np.random.RandomState(3)
def fbm(n, oct=5, seed=0):
    r = np.random.RandomState(seed); out = np.zeros((n, n), np.float32); amp = 1
    for o in range(oct):
        s = 2 ** (o + 2); g = r.rand(s, s).astype(np.float32)
        out += amp * np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)).astype(np.float32) / 255; amp *= .5
    return (out - out.min()) / (out.max() - out.min())
def raster(ob, N, fn, base):
    """ob 의 각 삼각형을 UV 공간에 그리며, 텍셀마다 보간한 3D 위치(rest)를 fn 에 넘겨 색을 받는다"""
    me = ob.data; me.calc_loop_triangles(); uv = me.uv_layers[0].data; out = base.copy(); co = np.array([v.co[:] for v in me.vertices])
    for t in me.loop_triangles:
        P = np.array([co[i] for i in t.vertices]); Q = np.array([(uv[l].uv[0] * N, (1 - uv[l].uv[1]) * N) for l in t.loops])
        x0, y0 = np.floor(Q.min(0)).astype(int) - 1; x1, y1 = np.ceil(Q.max(0)).astype(int) + 1
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, N - 1), min(y1, N - 1)
        if x1 < x0 or y1 < y0: continue
        yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1]; px = np.stack([xx.ravel() + .5, yy.ravel() + .5], 1)
        a, b, c = Q; v0, v1 = b - a, c - a; den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-9: continue
        d = px - a; w1 = (d[:, 0] * v1[1] - v1[0] * d[:, 1]) / den; w2 = (v0[0] * d[:, 1] - d[:, 0] * v0[1]) / den; w0 = 1 - w1 - w2
        tol = -1.5 / max(1., np.abs(den) ** .5); m = (w0 >= tol) & (w1 >= tol) & (w2 >= tol)
        if not m.any(): continue
        p3 = w0[m, None] * P[0] + w1[m, None] * P[1] + w2[m, None] * P[2]; col = fn(p3, t.polygon_index)
        if col is None: continue
        ix = xx.ravel()[m]; iy = yy.ravel()[m]; out[iy, ix] = col
    return out
def load(p, N): return np.asarray(Image.open(p).convert('RGBA').resize((N, N), Image.LANCZOS)).astype(np.float32) / 255
def save(a, n): Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(os.path.join(TEX, n)); print('saved', n)
# ── 교복 (블레이저 남색 · 셔츠 V · 소매 끝 셔츠 · 버건디 파이핑 / 스커트 체크)
su = bpy.data.objects['Mina_Suit']; N = 2048; SJ = json.load(open(os.path.join(HERE, 'skirt.json')))
skv = set(SJ['skirt_ids']); skf = np.zeros(len(su.data.polygons), bool)
for p in su.data.polygons: skf[p.index] = sum(v in skv for v in p.vertices) >= 2
navy = np.array([.085, .1, .17]); shirt = np.array([.86, .86, .84]); burg = np.array([.36, .08, .12])
zc = HB('neck_01').z - .01; zv = HB('spine_03').z - .03; cyc = HB('spine_03').y
hands = [HB('hand_l'), HB('hand_r')]
cx, cy = SJ['cx'], SJ['cy']
def plaid(p):
    a = np.arctan2(p[:, 1] - cy, p[:, 0] - cx); u = (a + math.pi) * .2; v = p[:, 2]   # 둘레 ≈ 0.2 m · 반지름 보정
    u = u * 1.0; per = .085
    gu = (u / per) % 1; gv = (v / per) % 1
    band = lambda g, c, w: (np.abs(g - c) < w).astype(np.float32)
    col = np.tile(np.array([.075, .085, .16]), (len(p), 1))
    wide = np.clip(band(gu, .25, .12) + band(gv, .25, .12), 0, 1)[:, None] * .5 + (band(gu, .25, .12) * band(gv, .25, .12))[:, None] * .35
    col = col * (1 - wide) + np.array([.34, .08, .12]) * wide
    thin = np.clip(band(gu, .7, .012) + band(gv, .7, .012), 0, 1)[:, None]; col = col * (1 - thin * .7) + np.array([.6, .6, .62]) * thin * .7
    gold = np.clip(band(gu, .82, .006) + band(gv, .82, .006), 0, 1)[:, None]; col = col * (1 - gold * .6) + np.array([.7, .58, .3]) * gold * .6
    tw = (np.sin((p[:, 0] + p[:, 1] + p[:, 2]) * 2400) * .5 + .5)[:, None] * .08
    return col * (.94 + tw)
def suit_fn(p, fi):
    if skf[fi]: return plaid(p)
    col = np.tile(navy, (len(p), 1))
    front = p[:, 1] < cyc - .02
    hw = np.where(p[:, 2] > zv, .072 * np.clip((p[:, 2] - zv) / (zc - zv), 0, 1) ** .8, -1)
    vneck = front & (np.abs(p[:, 0]) < hw)
    col[vneck] = shirt
    pipe = front & (np.abs(np.abs(p[:, 0]) - hw) < .006) & (hw > 0); col[pipe] = burg
    collar = p[:, 2] > zc + .015; col[collar] = shirt
    for h in hands:
        cuff = np.linalg.norm(p - np.array(h[:]), axis=1) < .075; col[cuff] = shirt
    return col
base = load(os.path.join(D, 'clothes/female_elegantsuit01/female_elegantsuit01_diffuse.png'), N)
lum = base[..., :3].mean(-1, keepdims=True)
out = raster(su, N, suit_fn, np.zeros((N, N, 3), np.float32) + navy)
wool = fbm(N, 6, 11)[..., None]; out = out * (.9 + wool * .16)
save(np.concatenate([out, np.ones((N, N, 1))], -1), 'mina_suit_diffuse.png')
# ── 피부: 따뜻한 톤 + 볼 홍조 + 무릎 아래 니삭스(흰색 골지)
bo = bpy.data.objects['Mina_Body']; N2 = 2048
sk = load(os.path.join(D, 'skins/textures/young_lightskinned_female_diffuse3.png'), N2)[..., :3]
sk = sk * np.array([1.0, .955, .925]) + np.array([.025, .012, 0])
knee = (HB('calf_l').z); sock_top = knee - .06; fz = HB('foot_l').z
head = HB('head'); nose_y = min(v.co.y for v in bo.data.vertices if v.co.z > head.z + .03)
def skin_fn(p, fi):
    z = p[:, 2]; m = z < sock_top
    if not m.any() and z.min() < head.z: return None
    col = None
    if m.any():
        col = np.full((len(p), 3), np.nan, np.float32)
        rib = (np.sin(np.arctan2(p[:, 1] - 0, np.abs(p[:, 0]) - .09) * 40) * .5 + .5)[:, None]
        c = np.array([.9, .9, .88]) * (.93 + rib * .07); top = (np.abs(z - sock_top) < .012)[:, None]; c = c * (1 - top * .06)
        col[m] = c[m]
    return col
sk2 = raster(bo, N2, lambda p, fi: skin_fn(p, fi) if (p[:, 2] < sock_top).any() else None, np.full((N2, N2, 3), np.nan, np.float32))
msk = ~np.isnan(sk2[..., 0]); sk[msk] = sk2[msk]
# 볼 홍조
def blush_fn(p, fi):
    if p[:, 2].mean() < head.z + .02 or p[:, 1].mean() > nose_y + .06: return None
    w = np.zeros(len(p))
    for sx in (-1, 1):
        c = np.array([sx * .042, nose_y + .03, head.z + .07]); w += np.exp(-((p - c) ** 2).sum(1) / (2 * .016 ** 2))
    return np.stack([w, w, w], 1)
bl = raster(bo, N2, blush_fn, np.zeros((N2, N2, 3), np.float32))[..., :1]
bl = np.asarray(Image.fromarray((np.clip(bl[..., 0], 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)[..., None] / 255
sk = sk * (1 - bl * .22) + np.array([.85, .45, .45]) * bl * .22
save(sk, 'mina_skin_diffuse.png')
# ── 머리: 짙은 흑갈색 (원래 알파 유지)
h = load(os.path.join(D, 'hair/ponytail01/ponytail01_diffuse.png'), 2048); l = h[..., :3].mean(-1, keepdims=True); l = (l - l.min()) / (l.max() - l.min() + 1e-6)
hc = np.array([.035, .026, .022]) + l * np.array([.17, .12, .095])
save(np.concatenate([hc, h[..., 3:]], -1), 'mina_hair_diffuse.png')
br = load(os.path.join(D, 'eyebrows/eyebrow010/eyebrow010.png'), 512); save(np.concatenate([np.zeros_like(br[..., :3]) + np.array([.07, .05, .045]), br[..., 3:] * .9], -1), 'mina_brow.png')
# ── 로퍼: 갈색 가죽 → 검정 (흰 양말 부분은 유지)
s = load(os.path.join(D, 'clothes/shoes01/shoes01_diffuse.png'), 1024); rgb = s[..., :3]; mx = rgb.max(-1); mn = rgb.min(-1); sat = (mx - mn) / (mx + 1e-6)
k = np.clip((sat - .12) / .15, 0, 1)[..., None]; l = rgb.mean(-1, keepdims=True)
save(np.concatenate([rgb * (1 - k) + (np.array([.03, .028, .03]) + l * .22) * k, s[..., 3:]], -1), 'mina_shoes_diffuse.png')
