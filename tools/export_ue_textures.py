#!/usr/bin/env python3
"""UE5 용 PBR 텍스처 변환기 (Haegyo UE5 포팅 가이드 5장 규격).

입력: UnrealPort/HaegyoUE/SourceTextures/<id>/{albedo,normal_gl,roughness}.webp  (+ materials.json)
      assets/tex/<name>_{map,normal,rough}.webp  (웹 게임에 적용한 Poly Haven CC0 실사 재질 5종)
출력: UnrealPort/HaegyoUE/Textures/<id>/
      T_<id>_BC.jpg    Base Color   (sRGB ON)
      T_<id>_N_DX.png  Normal       (sRGB OFF, OpenGL → DirectX: G 채널 반전 완료 — UE 에서 Flip Green 을 다시 켜지 말 것)
      T_<id>_ORM.png   R=AO(중립 255) · G=Roughness · B=Metallic (sRGB OFF, Masks)
사용법: pip install pillow && python3 tools/export_ue_textures.py
"""
import json, os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UE = os.path.join(ROOT, 'UnrealPort', 'HaegyoUE')
SRC = os.path.join(UE, 'SourceTextures')
OUT = os.path.join(UE, 'Textures')
# 웹 게임에서 쓰는 Poly Haven 재질 (assets/tex 이름 → UE id)
WEB = {'tile': 'ph_old_mosaic_floor', 'wood': 'ph_old_wood_floor', 'base': 'ph_damaged_concrete_floor', 'dirt': 'ph_brown_mud_03', 'locker': 'ph_rusty_metal_sheet'}


def write(mid, albedo, normal, rough, metal):
    d = os.path.join(OUT, mid); os.makedirs(d, exist_ok=True)
    Image.open(albedo).convert('RGB').save(os.path.join(d, f'T_{mid}_BC.jpg'), quality=92)
    r, g, b = Image.open(normal).convert('RGB').split()
    Image.merge('RGB', (r, ImageOps.invert(g), b)).save(os.path.join(d, f'T_{mid}_N_DX.png'), optimize=True)
    rg = Image.open(rough).convert('L')
    ao = Image.new('L', rg.size, 255); mt = Image.new('L', rg.size, int(round(metal * 255)))
    Image.merge('RGB', (ao, rg, mt)).save(os.path.join(d, f'T_{mid}_ORM.png'), optimize=True)
    print('ok', mid)


def main():
    mats = json.load(open(os.path.join(SRC, 'materials.json'), encoding='utf-8'))
    for m in mats:
        s = os.path.join(SRC, m['id'])
        write(m['id'], os.path.join(s, 'albedo.webp'), os.path.join(s, 'normal_gl.webp'), os.path.join(s, 'roughness.webp'), m.get('metalness', 0))
    for name, mid in WEB.items():
        t = os.path.join(ROOT, 'assets', 'tex', name)
        write(mid, t + '_map.webp', t + '_normal.webp', t + '_rough.webp', .3 if name == 'locker' else 0)


if __name__ == '__main__':
    main()
