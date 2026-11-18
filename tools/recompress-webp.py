#!/usr/bin/env python3
"""큰 WebP 텍스처를 손실 WebP(q=88)로 다시 인코딩한다 — 해상도 · 경로는 그대로, 20% 이상 줄 때만 덮어쓴다.
사용: python3 tools/recompress-webp.py [--min-kb 150] [--q 88] file.webp ...
"""
import io, os, sys, argparse
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('--min-kb', type=int, default=150); ap.add_argument('--q', type=int, default=88); ap.add_argument('files', nargs='+')
a = ap.parse_args(); saved = 0
for f in a.files:
    n0 = os.path.getsize(f)
    if n0 < a.min_kb * 1000: continue
    im = Image.open(f); im.load()
    if getattr(im, 'is_animated', False): continue
    if im.mode == 'RGBA' and im.getchannel('A').getextrema() == (255, 255): im = im.convert('RGB')
    o = io.BytesIO(); im.save(o, 'WEBP', quality=a.q, method=6); b = o.getvalue()
    if len(b) < n0 * 0.8:
        open(f, 'wb').write(b); saved += n0 - len(b); print(f, n0 // 1000, '->', len(b) // 1000, 'KB')
print('saved MB', round(saved / 1e6, 2))
