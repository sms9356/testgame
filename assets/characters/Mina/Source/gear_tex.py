# 민아 장비 텍스처 (자체 생성): 교표 · 나일론 · 앞머리 가닥
import numpy as np, os
from PIL import Image, ImageDraw, ImageFilter
T = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex'); os.makedirs(T, exist_ok=True)
def fbm(n, oct=5, seed=0):
    r = np.random.RandomState(seed); out = np.zeros((n, n), np.float32); amp = 1
    for o in range(oct):
        s = 2 ** (o + 2); g = r.rand(s, s).astype(np.float32)
        out += amp * np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)).astype(np.float32) / 255; amp *= .5
    return (out - out.min()) / (out.max() - out.min())
def normal_from_h(h, k=2.):
    gx = np.gradient(h, axis=1) * k * h.shape[0] / 256; gy = np.gradient(h, axis=0) * k * h.shape[0] / 256
    n = np.stack([-gx, gy, np.ones_like(h)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True); return n * .5 + .5
def save(a, n): Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).save(os.path.join(T, n))
# 교표: 방패 + 펼친 책 + 별 (금속 금색, 알파)
S = 512; im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
sh = [(256, 30), (450, 90), (430, 300), (256, 480), (82, 300), (62, 90)]
d.polygon(sh, fill=(196, 160, 82, 255)); d.polygon([(256, 62), (418, 112), (400, 292), (256, 440), (112, 292), (94, 112)], fill=(22, 30, 60, 255))
d.polygon([(256, 300), (150, 250), (150, 330), (256, 380)], fill=(214, 178, 96, 255)); d.polygon([(256, 300), (362, 250), (362, 330), (256, 380)], fill=(200, 164, 86, 255))
import math
pts = [(256 + (60 if k % 2 == 0 else 24) * math.sin(k * math.pi / 5), 175 - (60 if k % 2 == 0 else 24) * math.cos(k * math.pi / 5)) for k in range(10)]; d.polygon(pts, fill=(226, 190, 104, 255))
im.save(os.path.join(T, 'emblem.png'))
# 나일론(백팩): 촘촘한 직조 + 얼룩
N = 1024; y, x = np.mgrid[0:N, 0:N].astype(np.float32)
w = (np.sin(x * 2 * np.pi / 4) * np.sin(y * 2 * np.pi / 4)) * .5 + .5; f = fbm(N, 6, 5)
save(np.stack([.03 + f * .02 + w * .01] * 3, -1) * np.array([1, 1, 1.12]), 'nylon_diffuse.png'); save(normal_from_h(w * .5 + f * .4, 1.5), 'nylon_normal.png')
# 앞머리 가닥: 위는 촘촘, 아래 끝은 길이가 들쭉날쭉한 시스루 (u: 좌우, v: 1=정수리 → 0=끝)
W, H = 1024, 512; a = np.zeros((H, W), np.float32); c = np.zeros((H, W), np.float32); r = np.random.RandomState(9)
for k in range(900):
    x0 = r.rand() * W; ln = .55 + r.rand() * .45; wd = 1 + r.rand() * 2.5; curve = (r.rand() - .5) * 30
    lc = 1 - abs(x0 / W - .5) * 2      # 가운데는 짧고 옆은 길게(얼굴선 따라)
    ln = ln * (.78 + (1 - lc) * .3)
    for yy in range(0, int(H * min(ln, 1))):
        t = yy / H; xx = int(x0 + curve * t * t)
        if 0 <= xx < W:
            tip = max(0., 1 - max(0., t - ln + .15) / .15)
            a[yy, max(0, xx - int(wd)):xx + int(wd) + 1] = np.maximum(a[yy, max(0, xx - int(wd)):xx + int(wd) + 1], .9 * tip)
            c[yy, max(0, xx - int(wd)):xx + int(wd) + 1] = r.rand() * .5 + .5 if yy == 0 else c[yy, max(0, xx - int(wd)):xx + int(wd) + 1]
a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.8))).astype(np.float32) / 255
hl = fbm(512, 5, 2)[:, :, None]; hl = np.asarray(Image.fromarray((hl[..., 0] * 255).astype(np.uint8)).resize((W, H))).astype(np.float32)[..., None] / 255
col = np.array([.035, .026, .022]) + hl * np.array([.12, .085, .07]) + (np.sin(np.arange(W) * .9)[None, :, None] * .5 + .5) * .03
save(np.concatenate([col, a[..., None]], -1), 'bangs.png')
print('ok')
