# 피부 칠하기: 턱 · 윗입술 · 볼 아래 희끗한 수염 자국 + 검버섯 — 몸 메시의 3D 위치로 고른 면을 UV 공간에 칠한다
import bpy, sys, os, numpy as np, mathutils
from PIL import Image, ImageDraw, ImageFilter
blend, src, dst = sys.argv[sys.argv.index('--') + 1:][:3]
bpy.ops.wm.open_mainfile(filepath=blend)
b = bpy.data.objects['Guard_Body']; me = b.data; uv = me.uv_layers[0].data; arm = bpy.data.objects['Guard_Rig']
H = arm.data.bones['head'].head_local; HT = arm.data.bones['head'].tail_local
img = Image.open(src).convert('RGB'); W, Hh = img.size
beard = Image.new('L', (W, Hh), 0); db = ImageDraw.Draw(beard)
face_front_y = min(v.co.y for v in me.vertices if v.co.z > H.z)
nose_tip = min((v.co for v in me.vertices if v.co.z > H.z), key=lambda c: c.y)
for p in me.polygons:
    c = p.center
    if c.z < H.z - .02 or c.z > nose_tip.z - .012: continue
    if c.y > nose_tip.y + .085: continue                 # 앞쪽 얼굴 (귀 · 뒷목 제외)
    if abs(c.x) > .062 and c.z > nose_tip.z - .03: continue   # 광대 위로는 안 올라감
    w = 255
    pts = [(uv[li].uv[0] * W, (1 - uv[li].uv[1]) * Hh) for li in p.loop_indices]
    db.polygon(pts, fill=w)
beard = beard.filter(ImageFilter.GaussianBlur(10))
a = np.asarray(img).astype(np.float32) / 255; m = np.asarray(beard).astype(np.float32)[..., None] / 255
rs = np.random.RandomState(5); dots = (rs.rand(Hh, W) > .55).astype(np.float32)
dots = np.asarray(Image.fromarray((dots * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.7))).astype(np.float32)[..., None] / 255
stub = np.array([.36, .34, .33])  # 희끗한 회색 수염 뿌리
a = a * (1 - m * .28) + (stub * dots) * m * .22 + a * m * .0
# 검버섯: 얼굴 · 손등 근처 작은 갈색 점 (UV 전체에 드물게)
spots = np.zeros((Hh, W), np.float32)
for _ in range(120):
    x, y, r = rs.randint(0, W), rs.randint(0, Hh), rs.randint(3, 9); yy, xx = np.ogrid[-y:Hh - y, -x:W - x]; spots[(xx * xx + yy * yy) < r * r] = rs.rand() * .5 + .3
spots = np.asarray(Image.fromarray((spots * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32)[..., None] / 255
a = a * (1 - spots * .18) + np.array([.35, .22, .14]) * spots * .18
Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(dst); print('painted', float(m.mean()))
