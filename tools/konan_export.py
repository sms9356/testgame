#!/usr/bin/env python3
"""코난보이스(konanvoice.konantech.com) 더빙용 대본 내보내기.

게임 대사(lines.json, tools/dump_lines.mjs 로 뽑음)를 화자별 엑셀 대본으로 만든다 → 코난보이스 '새 대본 파일 만들기 → 파일 업로드'.
  konan/<화자>.xlsx      : A열 = 읽을 문장 (한 행 = 한 대사, 게임 순서)
  konan/<화자>_ids.json : 같은 순서의 대사 번호 — tools/konan_import.py 가 내려받은 MP3 를 잘라 번호에 맞춘다
사용법: python3 tools/konan_export.py lines.json [화자,화자...]
"""
import json, os, sys
from openpyxl import Workbook
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_voice import speakable, ROOT  # noqa: E402

lines = json.load(open(sys.argv[1], encoding='utf-8'))['ko']
only = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None
out = os.path.join(ROOT, 'konan'); os.makedirs(out, exist_ok=True)
by = {}
for vid, info in lines.items():
    t = speakable(info['text'])
    if t and (not only or info['spk'] in only): by.setdefault(info['spk'], []).append((vid, t))
for spk, items in by.items():
    wb = Workbook(); ws = wb.active; ws.title = spk
    for i, (_, t) in enumerate(items, 1): ws.cell(row=i, column=1, value=t)
    wb.save(os.path.join(out, f'{spk}.xlsx'))
    json.dump([v for v, _ in items], open(os.path.join(out, f'{spk}_ids.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(spk, len(items))
