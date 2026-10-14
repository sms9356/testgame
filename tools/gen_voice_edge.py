#!/usr/bin/env python3
"""자연스러운 더빙 음성 생성기 (무료 · 비상업용: Microsoft Edge 신경망 음성, edge-tts).

사용법:
  pip install edge-tts
  python3 tools/gen_voice_edge.py              # 모든 대사를 다시 만든다
  python3 tools/gen_voice_edge.py id1,id2      # 지정한 대사만 다시 만든다

story.js 의 대사(LINES · VO · 방송 · 쪽지)를 모아 화자(나이 · 성별)에 맞는 한국어 신경망 음성으로 읽고,
voice.js 의 감정 표(LINE_EMO · VO_EMO)에 따라 말 속도 · 음높이 · 크기를 바꿔 voice/<id>.mp3 를 만든다.
manifest.json 에 baked=true 를 남겨, 게임이 감정 속도를 한 번 더 걸지 않게 한다.
edge-tts 는 Edge 브라우저의 '소리 내어 읽기' 서비스를 쓴다 — 개인 · 비상업 프로젝트에서만 사용할 것.
ffmpeg 가 필요하다.
"""
import asyncio, json, os, re, subprocess, sys, tempfile
import edge_tts

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_voice import collect, speakable, ROOT  # noqa: E402  (대사 수집 · 정리는 기존 생성기와 같다)

OUT = os.path.join(ROOT, 'voice')
F, M, MM = 'ko-KR-SunHiNeural', 'ko-KR-InJoonNeural', 'ko-KR-HyunsuMultilingualNeural'
# 화자: (음성, 기본 음높이 Hz, 기본 속도 %, 추가 ffmpeg 필터)
#   지훈 18 남 · 서연 17 여 · 민아 18 여 · 하늘 18 여(그날에 멈춘) · 담임 40대 남 · 경비 60대 남 · 친구 둘 18 여
SPK = {
    'seoyeon':  (F, 0, 0, ''),
    'jihun':    (M, 0, 0, ''),
    'narrator': (MM, -4, -6, ''),
    'mina':     (F, 8, 4, ''),
    'haneul':   (F, 16, -8, ',aecho=0.8:0.5:90:0.25'),
    'friend':   (F, 14, 6, ''),
    'friend2':  (F, 4, 2, ''),
    'teacher':  (MM, -12, -6, ',bass=g=2'),
    'guard':    (M, -24, -12, ',bass=g=3'),
    'pa':       (M, -4, -4, ''),
    'ghost':    (F, -28, -22, ',lowpass=f=2800,aecho=0.8:0.6:140|280:0.45|0.25'),
}
# 감정: (속도 %, 음높이 Hz, 크기 %, 추가 필터) — voice.js 의 EMO 와 같은 이름
EMO = {
    'normal':   (0, 0, 0, ''),
    'surprise': (12, 10, 0, ''),
    'fear':     (-8, 4, -12, ',tremolo=f=6:d=0.25'),
    'urgent':   (20, 6, 0, ''),
    'whisper':  (-12, -4, -40, ',highpass=f=240'),
    'resolve':  (-3, -3, 0, ''),
    'relief':   (-6, 0, -8, ''),
    'sad':      (-14, -6, -18, ',tremolo=f=4:d=0.15'),
}


# 문장 사이 쉼(초): 긴박할수록 짧게, 슬프거나 두려울수록 길게
PAUSE = {'normal': .32, 'surprise': .2, 'fear': .42, 'urgent': .14, 'whisper': .4, 'resolve': .3, 'relief': .36, 'sad': .5}


def emo_tables():
    """voice.js 에서 LINE_EMO · VO_EMO 를 읽는다 (브라우저 전용 코드라 import 대신 객체 리터럴만 꺼낸다)."""
    src = open(os.path.join(ROOT, 'voice.js'), encoding='utf-8').read()
    js = ("const s=require('fs').readFileSync(0,'utf8');const g=n=>Function('return '+s.match(new RegExp('const '+n+' = (\\\\{[\\\\s\\\\S]*?\\\\});'))[1])();"
          "console.log(JSON.stringify({L:g('LINE_EMO'),V:g('VO_EMO')}))")
    r = json.loads(subprocess.run(['node', '-e', js], input=src, capture_output=True, text=True, check=True).stdout)
    return r['L'], r['V']


def emo_of(vid, L, V):
    m = re.match(r'^l_(.+)_[js]$', vid)
    return (L.get(m.group(1)) if m else V.get(vid)) or 'normal'


def probe(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip() or 0)


def pct(v): return f'{v:+d}%'
def hz(v): return f'{v:+d}Hz'


async def synth(text, voice, rate, pitch, vol, dst):
    px = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')   # 프록시 환경에서도 동작
    await edge_tts.Communicate(text, voice, rate=pct(rate), pitch=hz(pitch), volume=pct(vol), proxy=px).save(dst)


def main():
    L, V = emo_tables()
    os.makedirs(OUT, exist_ok=True)
    mp = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mp, encoding='utf-8')) if os.path.exists(mp) else {}
    for vid, spk, text in collect(set(sys.argv[1].split(',')) if len(sys.argv) > 1 else None):
        voice, p0, r0, extra = SPK.get(spk, SPK['narrator'])
        emo = emo_of(vid, L, V)
        r1, p1, v1, efx = EMO[emo]
        say = speakable(text)
        if not say:
            continue
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tf:
            tmp = tf.name
        for attempt in range(4):
            try:
                asyncio.run(synth(say, voice, r0 + r1, p0 + p1, v1, tmp))
                if probe(tmp) < len(re.sub(r'\s', '', say)) * .07: raise RuntimeError('잘린 응답')   # 응답이 중간에 끊기면 다시
                break
            except Exception as e:  # 네트워크 일시 오류는 다시 시도
                if attempt == 3: raise
                print('retry', vid, e)
        dst = os.path.join(OUT, vid + '.mp3')
        # 문장 사이 쉼을 감정에 맞게 줄인다 (서비스 기본 쉼은 1초 넘게 길다)
        gap = PAUSE.get(emo, .3)
        trim = f'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04:stop_periods=-1:stop_threshold=-50dB:stop_duration={gap + .05:.2f}:stop_silence={gap:.2f}'
        flt = f'{trim},highpass=f=70,loudnorm=I=-17:TP=-2:LRA=9{efx}{extra},apad=pad_dur=0.15'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-af', flt, '-ac', '1', '-ar', '44100', '-b:a', '56k', dst], check=True)
        os.unlink(tmp)
        dur = probe(dst)
        man[vid] = {'spk': spk, 'text': re.sub(r'<[^>]+>', ' ', text), 'dur': round(dur, 2), 'baked': True}
        print(vid, spk, emo, round(dur, 2), say[:40])
    json.dump(man, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)


if __name__ == '__main__':
    main()
