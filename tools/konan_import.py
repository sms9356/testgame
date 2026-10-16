#!/usr/bin/env python3
"""코난보이스에서 내려받은 화자별 MP3(대본 전체가 한 파일)를 대사마다 잘라 게임 더빙 파일로 넣는다.

대본의 문장 사이 '포즈(끊어읽기)'를 가장 길게 두고 내려받으면 자르기가 정확하다.
문장 수만큼 조각이 나오도록 가장 긴 무음 구간 (문장 수 − 1)곳을 골라 그 가운데를 자른다 → voice/<대사번호>.mp3 + voice/manifest.json
사용법: python3 tools/konan_import.py <내려받은.mp3> konan/<화자>_ids.json   (ffmpeg 필요)
         --dry : 자를 위치만 보여 주고 파일은 쓰지 않는다
"""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_voice import ROOT  # noqa: E402
# 하늘 · 그것의 메아리 · 저음 효과 (gen_voice_edge.py 의 SPK 와 같게 — edge-tts 없이 쓰려고 따로 둔다)
FX = {'haneul': ',aecho=0.8:0.5:90:0.25', 'teacher': ',bass=g=2', 'guard': ',bass=g=3', 'ghost': ',lowpass=f=2800,aecho=0.8:0.6:140|280:0.45|0.25'}

src, idf = sys.argv[1], sys.argv[2]
ids = json.load(open(idf, encoding='utf-8')); spk = os.path.basename(idf).replace('_ids.json', '')
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout)
log = subprocess.run(['ffmpeg', '-i', src, '-af', 'silencedetect=noise=-42dB:d=0.25', '-f', 'null', '-'], capture_output=True, text=True).stderr
st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
gaps = [(e - s, (s + e) / 2) for s, e in zip(st, en) if s > .05 and e < dur - .05]
if len(gaps) < len(ids) - 1: sys.exit(f'무음 구간 {len(gaps)}곳 < 필요한 {len(ids) - 1}곳 — 코난보이스에서 문장 사이 포즈를 더 길게 두고 다시 내려받으세요')
cuts = sorted(m for _, m in sorted(gaps, reverse=True)[:len(ids) - 1])
bounds = [0.0] + cuts + [dur]
for vid, a, b in zip(ids, bounds, bounds[1:]): print(f'{vid:16s} {a:7.2f} ~ {b:7.2f}  ({b - a:5.2f}s)')
if '--dry' in sys.argv: sys.exit(0)
vd = os.path.join(ROOT, 'voice'); mp = os.path.join(vd, 'manifest.json'); man = json.load(open(mp, encoding='utf-8'))
fx = FX.get(spk, '')
for vid, a, b in zip(ids, bounds, bounds[1:]):
    dst = os.path.join(vd, vid + '.mp3')
    flt = f'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04:stop_periods=-1:stop_threshold=-50dB:stop_duration=0.4:stop_silence=0.3,highpass=f=70,loudnorm=I=-17:TP=-2:LRA=9{fx},apad=pad_dur=0.15'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', src, '-af', flt, '-ac', '1', '-ar', '44100', '-b:a', '56k', dst], check=True)
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst], capture_output=True, text=True).stdout)
    m = man.get(vid, {}); m.update({'spk': spk, 'dur': round(d, 2), 'baked': True, 'src': 'konanvoice'}); man[vid] = m
json.dump(man, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(ids), '개 대사를 넣었다 →', vd)
