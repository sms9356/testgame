#!/usr/bin/env python3
"""GLB 내장 PNG/JPEG 텍스처를 WebP(EXT_texture_webp)로 재인코딩한다 — 트래픽 절감용.

사용: python3 tools/glb-webp.py [--max 2048] [--q 88] file.glb ...
- 각 이미지를 최대 변 --max 로 줄이고 WebP 로 바꾼다(더 작아질 때만).
- 텍스처는 EXT_texture_webp.source 로 가리키고 extensionsUsed/Required 에 등록한다
  (three.js GLTFLoader 기본 지원 · assets/characters/mina.glb 와 같은 방식).
- 장면 · 메시 · 노드 구조는 그대로 두고 바이너리 버퍼만 다시 배치한다.
"""
import io, json, struct, sys, argparse
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--max', type=int, default=2048)
ap.add_argument('--q', type=int, default=88)
ap.add_argument('files', nargs='+')
a = ap.parse_args()


def pad(b, c=b'\0'):
    return b + c * ((4 - len(b) % 4) % 4)


for f in a.files:
    raw = open(f, 'rb').read()
    assert raw[:4] == b'glTF'
    jl = struct.unpack('<I', raw[12:16])[0]
    j = json.loads(raw[20:20 + jl])
    if len(j.get('buffers', [])) != 1 or not any('bufferView' in i and i.get('mimeType') != 'image/webp' for i in j.get('images', [])):
        continue
    off = 20 + jl
    bl, bt = struct.unpack('<II', raw[off:off + 8])
    assert bt == 0x004E4942
    binc = raw[off + 8:off + 8 + bl]
    views = [binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in j['bufferViews']]
    changed = set()
    for ii, im in enumerate(j.get('images', [])):
        if 'bufferView' not in im or im.get('mimeType') == 'image/webp':
            continue
        src = views[im['bufferView']]
        img = Image.open(io.BytesIO(src))
        img.load()
        if max(img.size) > a.max:
            s = a.max / max(img.size)
            img = img.resize((max(1, round(img.size[0] * s)), max(1, round(img.size[1] * s))), Image.LANCZOS)
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGBA' if 'A' in img.getbands() or img.mode == 'P' else 'RGB')
        if img.mode == 'RGBA' and img.getchannel('A').getextrema() == (255, 255):
            img = img.convert('RGB')
        out = io.BytesIO()
        img.save(out, 'WEBP', quality=a.q, method=6)
        nb = out.getvalue()
        if len(nb) < len(src) * 0.9:
            views[im['bufferView']] = nb
            im['mimeType'] = 'image/webp'
            changed.add(ii)
    if not changed:
        print(f, 'unchanged')
        continue
    for t in j.get('textures', []):
        if t.get('source') in changed:
            t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': t.pop('source')}
    for k in ('extensionsUsed', 'extensionsRequired'):
        l = j.setdefault(k, [])
        if 'EXT_texture_webp' not in l:
            l.append('EXT_texture_webp')
    nbin = b''
    for v, data in zip(j['bufferViews'], views):
        nbin = pad(nbin)
        v['byteOffset'] = len(nbin)
        v['byteLength'] = len(data)
        nbin += data
    nbin = pad(nbin)
    j['buffers'][0]['byteLength'] = len(nbin)
    js = pad(json.dumps(j, separators=(',', ':'), ensure_ascii=False).encode(), b' ')
    body = struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(nbin), 0x004E4942) + nbin
    res = b'glTF' + struct.pack('<II', 2, 12 + len(body)) + body
    open(f, 'wb').write(res)
    print(f, f'{len(raw)/1e6:.2f}MB -> {len(res)/1e6:.2f}MB', len(changed), 'images')
