# 경비원 장비 텍스처 (프로젝트 자체 생성): 직물 · 가죽 · 금속 배지 · 패치 · 명찰 · 피부 미세 노멀
import numpy as np, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
T = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex'); os.makedirs(T, exist_ok=True)
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'noto-sans-kr-korean-700-normal.woff')
rs = np.random.RandomState(7)
def save(a, n): Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).save(os.path.join(T, n))
def fbm(n, oct=5, seed=0):
    r = np.random.RandomState(seed); out = np.zeros((n, n), np.float32); amp = 1
    for o in range(oct):
        s = 2 ** (o + 2); g = r.rand(s, s).astype(np.float32)
        out += amp * np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)).astype(np.float32) / 255; amp *= .5
    return (out - out.min()) / (out.max() - out.min())
def normal_from_h(h, k=2.):
    gx = np.gradient(h, axis=1) * k * h.shape[0] / 256; gy = np.gradient(h, axis=0) * k * h.shape[0] / 256
    n = np.stack([-gx, gy, np.ones_like(h)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True); return n * .5 + .5
N = 1024; y, x = np.mgrid[0:N, 0:N].astype(np.float32)
# 직물(능직): 사선 결 + 실 굵기 노이즈
tw = (np.sin((x + y) * 2 * np.pi / 6) * .5 + .5) * .6 + (np.sin(x * 2 * np.pi / 3) * .5 + .5) * .2 + fbm(N, 6, 1) * .2
save(np.stack([.11 + tw * .05, .13 + tw * .05, .22 + tw * .07], -1) * (0.85 + fbm(N, 4, 2)[..., None] * .3), 'cap_fabric_diffuse.png'); save(normal_from_h(tw * .6), 'cap_fabric_normal.png')
# 가죽: 오톨도톨한 결 + 닳은 가장자리
lg = fbm(N, 7, 3); cells = np.asarray(Image.fromarray((rs.rand(N // 6, N // 6) * 255).astype(np.uint8)).resize((N, N), Image.NEAREST).filter(ImageFilter.FIND_EDGES)).astype(np.float32) / 255
h = lg * .6 + (1 - cells) * .4; save(np.stack([.045 + lg * .03] * 3, -1) * np.array([1, .95, .92]), 'leather_diffuse.png'); save(normal_from_h(h, 3), 'leather_normal.png')
save(np.stack([.55 + lg * .3] * 3, -1), 'leather_rough.png')
# 금속 배지 (방패 + 독수리 날개 모양 + 별)
B = 512; im = Image.new('L', (B, B), 0); d = ImageDraw.Draw(im)
d.polygon([(256, 40), (440, 110), (420, 300), (256, 470), (92, 300), (72, 110)], fill=255)
hm = Image.new('L', (B, B), 0); dh = ImageDraw.Draw(hm)
dh.polygon([(256, 40), (440, 110), (420, 300), (256, 470), (92, 300), (72, 110)], fill=120); dh.polygon([(256, 80), (400, 135), (385, 290), (256, 425), (127, 290), (112, 135)], fill=60)
dh.ellipse((176, 170, 336, 330), fill=200); dh.ellipse((196, 190, 316, 310), fill=140)
for k in range(5):
    a = -np.pi / 2 + k * 2 * np.pi / 5; a2 = a + np.pi / 5
    pts = [(256 + 50 * np.cos(a), 250 + 50 * np.sin(a)), (256 + 20 * np.cos(a2), 250 + 20 * np.sin(a2))]
    dh.polygon([(256, 250)] + pts, fill=230)
for k in range(6): dh.line([(120 + k * 10, 120 + k * 22), (60 + k * 6, 150 + k * 26)], fill=180, width=6); dh.line([(392 - k * 10, 120 + k * 22), (452 - k * 6, 150 + k * 26)], fill=180, width=6)
h = np.asarray(hm.filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255; m = np.asarray(im).astype(np.float32) / 255
gold = np.stack([.78, .6, .28]) ; col = np.ones((B, B, 3)) * gold * (.55 + h[..., None] * .55); col = col * (.9 + fbm(B, 5, 4)[..., None] * .2)
save(np.concatenate([col, m[..., None]], -1), 'badge_diffuse.png'); save(normal_from_h(h, 4), 'badge_normal.png')
# 어깨 패치 (방패 엠블럼 + SECURITY)
def font(sz): return ImageFont.truetype(FONT, sz)
pt = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); d = ImageDraw.Draw(pt)
d.ellipse((16, 16, 496, 496), fill=(28, 32, 48, 255), outline=(196, 160, 72, 255), width=18)
d.ellipse((60, 60, 452, 452), outline=(196, 160, 72, 255), width=6)
d.text((256, 110), 'SECURITY', font=font(58), fill=(220, 190, 110, 255), anchor='mm')
d.polygon([(256, 170), (360, 205), (350, 320), (256, 395), (162, 320), (152, 205)], fill=(180, 140, 60, 255), outline=(240, 210, 130, 255))
d.text((256, 285), '★', font=font(80), fill=(40, 40, 60, 255), anchor='mm') if False else d.ellipse((222, 250, 290, 318), fill=(40, 44, 64, 255))
d.text((256, 440), 'SEOMUN H.S.', font=font(34), fill=(220, 190, 110, 255), anchor='mm')
pt.save(os.path.join(T, 'patch_shoulder.png'))
cp = Image.new('RGBA', (512, 160), (30, 34, 50, 255)); d = ImageDraw.Draw(cp); d.rectangle((6, 6, 505, 153), outline=(196, 160, 72, 255), width=8)
d.text((256, 82), 'SECURITY', font=font(84), fill=(222, 196, 120, 255), anchor='mm'); cp.save(os.path.join(T, 'patch_chest.png'))
nt = Image.new('RGBA', (512, 128), (238, 238, 232, 255)); d = ImageDraw.Draw(nt); d.rectangle((4, 4, 507, 123), outline=(30, 30, 30, 255), width=6)
d.text((256, 66), '경   비', font=font(80), fill=(20, 20, 24, 255), anchor='mm'); nt.save(os.path.join(T, 'nametag.png'))
# 넥타이 (짙은 남색 · 잔무늬)
t = (np.sin((x[:512, :512] - y[:512, :512]) * 2 * np.pi / 10) * .5 + .5); save(np.stack([.07 + t * .02, .08 + t * .02, .13 + t * .03], -1), 'tie_diffuse.png')
# 피부 미세 노멀: 기존 피부 텍스처의 고주파(주름 · 모공 그림) + 모공 노이즈 → 높이 → 노멀
s = np.asarray(Image.open(os.path.join(T, 'guard_skin_diffuse.png')).convert('L')).astype(np.float32) / 255
hp = s - np.asarray(Image.fromarray((s * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
pores = fbm(2048, 3, 9) * .0 + (np.random.RandomState(11).rand(2048, 2048).astype(np.float32))
pores = np.asarray(Image.fromarray((pores * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
hgt = hp * 3.0 + (pores - .5) * .08
save(normal_from_h(hgt, 1.6), 'guard_skin_normal.png')
print('textures ok')
