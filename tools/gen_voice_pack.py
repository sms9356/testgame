#!/usr/bin/env python3
"""다국어 신경망 더빙 팩 생성기 (무료 · 비상업용: Microsoft Edge 신경망 음성, edge-tts).

브라우저 음성 합성(Web Speech)은 기기마다 목소리가 다르고 기계음이 심해서, 모든 대사를 미리 신경망 음성으로 만들어 둔다.
  · 한국어: story.js 밖에서 실행 중 등록되는 대사(전화 · 쪽지 · 서브 유령 · 37실 등)처럼 아직 파일이 없는 대사 → voice/<id>.mp3
  · 영어 · 일본어 · 중국어: 모든 대사의 번역문 → voice/<언어>/<id>.mp3 + voice/<언어>/manifest.json
화자(나이 · 성별)마다 다른 목소리 · 음높이, voice.js 의 감정 표(LINE_EMO · VO_EMO)에 맞춘 속도 · 음높이 · 크기 · 효과는 gen_voice_edge.py 와 같다.

사용법:
  pip install edge-tts   (ffmpeg 필요)
  node tools/dump_lines.mjs lines.json          # 게임에서 대사 · 번역문 뽑기 (주석 참고)
  python3 tools/gen_voice_pack.py lines.json            # 없는 것 · 원문이 바뀐 것만 만든다
  python3 tools/gen_voice_pack.py lines.json en,ja      # 특정 언어만
  python3 tools/gen_voice_pack.py lines.json all --force   # 전부 다시
edge-tts 는 Edge 브라우저의 '소리 내어 읽기' 서비스를 쓴다 — 개인 · 비상업 프로젝트에서만 사용할 것.
"""
import asyncio, json, os, re, subprocess, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_voice import speakable, ROOT  # noqa: E402
from gen_voice_edge import SPK as SPK_KO, EMO, PAUSE, emo_tables, emo_of, probe, synth  # noqa: E402

OUT = os.path.join(ROOT, 'voice')
FX = {k: v[3] for k, v in SPK_KO.items()}   # 하늘 · 그것의 메아리 · 저음 효과는 언어와 상관없이 같게

# 화자: (음성, 음높이 Hz, 속도 %) — 지훈 18 남 · 서연 17 여 · 민아 18 여 · 하늘 18 여 · 담임 40대 남 · 경비 60대 남 · 친구 둘 18 여
VOICES = {
    'en': {
        'seoyeon': ('en-US-AvaNeural', 0, 0), 'jihun': ('en-US-BrianNeural', 0, 0), 'narrator': ('en-US-ChristopherNeural', -2, -6),
        'mina': ('en-US-EmmaMultilingualNeural', 4, 2), 'haneul': ('en-US-AnaNeural', 0, -10), 'friend': ('en-GB-MaisieNeural', 0, 4),
        'friend2': ('en-US-JennyNeural', 6, 2), 'teacher': ('en-US-EricNeural', -6, -6), 'guard': ('en-US-RogerNeural', -18, -12),
        'pa': ('en-US-SteffanNeural', -2, -4), 'ghost': ('en-US-AnaNeural', -24, -22),
    },
    'ja': {
        'seoyeon': ('ja-JP-NanamiNeural', 0, 0), 'jihun': ('ja-JP-KeitaNeural', 0, 0), 'narrator': ('ja-JP-KeitaNeural', -6, -6),
        'mina': ('ja-JP-NanamiNeural', 8, 4), 'haneul': ('ja-JP-NanamiNeural', 16, -8), 'friend': ('ja-JP-NanamiNeural', 14, 6),
        'friend2': ('ja-JP-NanamiNeural', 4, 2), 'teacher': ('ja-JP-KeitaNeural', -12, -6), 'guard': ('ja-JP-KeitaNeural', -24, -12),
        'pa': ('ja-JP-KeitaNeural', -4, -4), 'ghost': ('ja-JP-NanamiNeural', -28, -22),
    },
    'zh': {
        'seoyeon': ('zh-CN-XiaoyiNeural', 0, 0), 'jihun': ('zh-CN-YunxiNeural', 0, 0), 'narrator': ('zh-CN-YunjianNeural', -4, -8),
        'mina': ('zh-CN-XiaoxiaoNeural', 4, 2), 'haneul': ('zh-CN-XiaoyiNeural', 14, -8), 'friend': ('zh-CN-XiaoyiNeural', 12, 6),
        'friend2': ('zh-CN-XiaoxiaoNeural', 10, 2), 'teacher': ('zh-CN-YunyangNeural', -10, -6), 'guard': ('zh-CN-YunjianNeural', -22, -12),
        'pa': ('zh-CN-YunyangNeural', -2, -4), 'ghost': ('zh-CN-XiaoxiaoNeural', -26, -22),
    },
}
ALT = {   # 대체 목소리 (성별 · 나이대가 비슷한 것)
    'en-US-EmmaMultilingualNeural': ['en-US-AriaNeural'], 'en-US-AvaNeural': ['en-US-AvaMultilingualNeural'], 'en-US-BrianNeural': ['en-US-BrianMultilingualNeural'],
    'en-US-JennyNeural': ['en-US-MichelleNeural'], 'en-US-AnaNeural': ['en-US-AriaNeural'], 'en-GB-MaisieNeural': ['en-GB-LibbyNeural'],
    'en-US-ChristopherNeural': ['en-US-GuyNeural'], 'en-US-EricNeural': ['en-US-GuyNeural'], 'en-US-RogerNeural': ['en-US-GuyNeural'], 'en-US-SteffanNeural': ['en-US-GuyNeural'],
    'zh-CN-XiaoyiNeural': ['zh-CN-XiaoxiaoNeural'], 'zh-CN-XiaoxiaoNeural': ['zh-CN-XiaoyiNeural'], 'zh-CN-YunxiNeural': ['zh-CN-YunjianNeural'],
    'zh-CN-YunjianNeural': ['zh-CN-YunyangNeural'], 'zh-CN-YunyangNeural': ['zh-CN-YunjianNeural'],
}
for k, (v, p, r, _) in SPK_KO.items():
    VOICES.setdefault('ko', {})[k] = (v, p, r)


async def make(vid, spk, say, emo, code, dst, sem):
    voice, p0, r0 = VOICES[code].get(spk, VOICES[code]['narrator'])
    r1, p1, v1, efx = EMO[emo]
    async with sem:
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tf:
            tmp = tf.name
        # 일부 목소리는 특정 문장에서 소리를 돌려주지 않는다 → 두 번 실패하면 같은 성별의 대체 목소리
        alt = ALT.get(voice, [])
        for attempt in range(6):
            try:
                await synth(say, voice if attempt < 2 or not alt else alt[(attempt - 2) % len(alt)], r0 + r1, p0 + p1, v1, tmp)
                n = len(re.sub(r'\s', '', say))
                if probe(tmp) < n * (.025 if code == 'en' else .07): raise RuntimeError('잘린 응답')   # 응답이 중간에 끊기면 다시
                break
            except Exception as e:  # 네트워크 일시 오류는 다시 시도
                if attempt == 5: raise
                print('retry', code, vid, e); await asyncio.sleep(2 + attempt * 3)
        gap = PAUSE.get(emo, .3)
        trim = f'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04:stop_periods=-1:stop_threshold=-50dB:stop_duration={gap + .05:.2f}:stop_silence={gap:.2f}'
        flt = f'{trim},highpass=f=70,loudnorm=I=-17:TP=-2:LRA=9{efx}{FX.get(spk, "")},apad=pad_dur=0.15'
        br = '56k' if code == 'ko' else '40k'
        await asyncio.to_thread(subprocess.run, ['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-af', flt, '-ac', '1', '-ar', '44100' if code == 'ko' else '32000', '-b:a', br, dst], check=True)
        os.unlink(tmp)
        return round(probe(dst), 2)


async def run(lines, codes, force):
    L, V = emo_tables()
    ko, sem = lines['ko'], asyncio.Semaphore(4)
    for code in codes:
        d = OUT if code == 'ko' else os.path.join(OUT, code)
        os.makedirs(d, exist_ok=True)
        mp = os.path.join(d, 'manifest.json')
        man = json.load(open(mp, encoding='utf-8')) if os.path.exists(mp) else {}
        jobs = []
        for vid, info in ko.items():
            src = info['text']
            if code == 'ko':
                # 한국어: story.js 대사는 gen_voice_edge.py 가 만든다 — 여기서는 파일이 없는 대사만
                if not force and man.get(vid, {}).get('baked') and os.path.exists(os.path.join(d, vid + '.mp3')): continue
                if not force and info.get('baked'): continue
                say = speakable(src)
            else:
                if not force and man.get(vid, {}).get('src') == src and os.path.exists(os.path.join(d, vid + '.mp3')): continue
                say = speakable(lines[code][vid]).replace('「', '').replace('」', '').replace('『', '').replace('』', '')
            if not say: continue
            jobs.append((vid, info, say))

        async def one(vid, info, say):
            emo = emo_of(vid, L, V)
            try: dur = await make(vid, info['spk'], say, emo, code, os.path.join(d, vid + '.mp3'), sem)
            except Exception as e:   # 한 줄이 끝내 실패해도 나머지는 계속 (그 대사는 게임에서 브라우저 음성으로)
                print('FAIL', code, vid, e, flush=True); return
            if code == 'ko': man[vid] = {'spk': info['spk'], 'text': src_of(info), 'dur': dur, 'baked': True}
            else: man[vid] = {'spk': info['spk'], 'src': info['text'], 'dur': dur}
            print(code, vid, info['spk'], emo, dur, say[:40], flush=True)
        src_of = lambda i: i['text']   # noqa: E731
        print(code, len(jobs), 'lines', flush=True)
        for i in range(0, len(jobs), 40):   # 40개마다 manifest 저장 (중간에 끊겨도 이어서 만들 수 있게)
            await asyncio.gather(*(one(*j) for j in jobs[i:i + 40]))
            json.dump(man, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
        json.dump(man, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)


def main():
    lines = json.load(open(sys.argv[1], encoding='utf-8'))
    sel = sys.argv[2] if len(sys.argv) > 2 else 'all'
    codes = ['ko', 'en', 'ja', 'zh'] if sel == 'all' else sel.split(',')
    asyncio.run(run(lines, codes, '--force' in sys.argv))


if __name__ == '__main__':
    main()
