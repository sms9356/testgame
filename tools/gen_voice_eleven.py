#!/usr/bin/env python3
"""ElevenLabs 신경망 더빙 생성기 — 한국어 · 영어 · 일본어 · 중국어 모든 대사를 화자별 목소리로 만든다.

API 키는 환경 변수 ELEVENLABS_API_KEY 에서 읽는다 (파일 · 코드에 적지 않는다).
  node tools/dump_lines.mjs lines.json                     # 게임에서 대사 · 번역문 뽑기
  python3 tools/gen_voice_eleven.py lines.json             # 전 언어 · 없는 것만
  python3 tools/gen_voice_eleven.py lines.json ko          # 한국어만
  python3 tools/gen_voice_eleven.py lines.json ko --only narrator,seoyeon --force
  python3 tools/gen_voice_eleven.py lines.json ko --dry    # 몇 줄 · 몇 글자(크레딧)인지만
목소리는 tools/eleven_voices.json 으로 바꿀 수 있다 (화자 → voice_id · stability · style). 기본값은 ElevenLabs 기본 제공 목소리.
결과: 한국어 voice/<id>.mp3 + voice/manifest.json, 다른 언어 voice/<언어>/<id>.mp3 + manifest.json (기존 더빙과 같은 음량 · 효과 처리)
"""
import json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_voice import speakable, ROOT  # noqa: E402

API = 'https://api.elevenlabs.io/v1/text-to-speech/{}?output_format=mp3_44100_128'
MODEL = os.environ.get('ELEVEN_MODEL', 'eleven_multilingual_v2')
# 화자: 지훈 18 남 · 서연 17 여 · 민아 18 여 · 하늘 18 여 · 담임 40대 남 · 경비 60대 남 · 나레이션 · 교내 방송 · 그것
VOICES = {
    'narrator': {'voice_id': 'pNInz6obpgDQGcFmaJgB', 'stability': .55, 'style': .25},   # Adam
    'seoyeon':  {'voice_id': 'MF3mGyEYCl7XYWbV9V6O', 'stability': .45, 'style': .35},   # Elli
    'jihun':    {'voice_id': 'TxGEqnHWrfWFTfGW9XjX', 'stability': .45, 'style': .35},   # Josh
    'mina':     {'voice_id': 'EXAVITQu4vr4xnSDxMaL', 'stability': .4, 'style': .4},     # Bella
    'haneul':   {'voice_id': '21m00Tcm4TlvDq8ikWAM', 'stability': .5, 'style': .3},     # Rachel
    'friend':   {'voice_id': 'AZnzlk1XvdvUeBnXmlld', 'stability': .45, 'style': .3},    # Domi
    'friend2':  {'voice_id': 'ThT5KcBeYPX3keUQqHPh', 'stability': .45, 'style': .3},    # Dorothy
    'teacher':  {'voice_id': 'VR6AewLTigWG4xSOukaG', 'stability': .6, 'style': .2},     # Arnold
    'guard':    {'voice_id': '2EiwWnXFnvU5JabPnv8n', 'stability': .6, 'style': .2},     # Clyde
    'pa':       {'voice_id': 'N2lVS1w4EtoT3dr4eOWO', 'stability': .7, 'style': .1},     # Callum
    'ghost':    {'voice_id': 'AZnzlk1XvdvUeBnXmlld', 'stability': .25, 'style': .6},    # Domi (게임에서 저음 · 메아리 효과)
}
FX = {'haneul': ',aecho=0.8:0.5:90:0.25', 'teacher': ',bass=g=2', 'guard': ',bass=g=3', 'ghost': ',asetrate=44100*0.82,aresample=44100,lowpass=f=2800,aecho=0.8:0.6:140|280:0.45|0.25'}


def tts(key, v, text, dst):
    body = json.dumps({'text': text, 'model_id': MODEL, 'voice_settings': {'stability': v['stability'], 'similarity_boost': .8, 'style': v.get('style', 0), 'use_speaker_boost': True}}).encode()
    for attempt in range(5):
        req = urllib.request.Request(API.format(v['voice_id']), data=body, headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r: open(dst, 'wb').write(r.read()); return
        except urllib.error.HTTPError as e:
            msg = e.read()[:300].decode('utf-8', 'replace')
            if e.code in (401, 402, 403): sys.exit(f'ElevenLabs {e.code}: {msg}')   # 키 · 크레딧 문제는 바로 멈춘다
            print('retry', e.code, msg); time.sleep(3 + attempt * 5)
        except Exception as e:  # 네트워크 일시 오류
            print('retry', e); time.sleep(3 + attempt * 5)
    raise RuntimeError('실패')


def probe(f): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout or 0)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    lines = json.load(open(args[0], encoding='utf-8')); codes = (args[1].split(',') if len(args) > 1 and args[1] != 'all' else ['ko', 'en', 'ja', 'zh'])
    only = next((a.split('=', 1)[1] if '=' in a else sys.argv[sys.argv.index(a) + 1] for a in sys.argv if a.startswith('--only')), None)
    only = set(only.split(',')) if only else None
    force, dry = '--force' in sys.argv, '--dry' in sys.argv
    vf = os.path.join(ROOT, 'tools', 'eleven_voices.json')
    if os.path.exists(vf): [VOICES.setdefault(k, {}).update(v) for k, v in json.load(open(vf, encoding='utf-8')).items()]
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key and not dry: sys.exit('ELEVENLABS_API_KEY 환경 변수가 없습니다')
    ko = lines['ko']; total = 0
    for code in codes:
        d = os.path.join(ROOT, 'voice') if code == 'ko' else os.path.join(ROOT, 'voice', code); os.makedirs(d, exist_ok=True)
        mp = os.path.join(d, 'manifest.json'); man = json.load(open(mp, encoding='utf-8')) if os.path.exists(mp) else {}
        jobs = []
        for vid, info in ko.items():
            if only and info['spk'] not in only: continue
            src = info['text']; say = speakable(src if code == 'ko' else lines[code][vid]).replace('「', '').replace('」', '').replace('『', '').replace('』', '')
            if not say: continue
            if not force and man.get(vid, {}).get('eleven') == src and os.path.exists(os.path.join(d, vid + '.mp3')): continue
            jobs.append((vid, info['spk'], say, src))
        n = sum(len(j[2]) for j in jobs); total += n
        print(code, len(jobs), 'lines', n, 'chars', flush=True)
        if dry: continue
        for i, (vid, spk, say, src) in enumerate(jobs):
            v = VOICES.get(spk, VOICES['narrator'])
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tf: tmp = tf.name
            try: tts(key, v, say, tmp)
            except Exception as e: print('FAIL', code, vid, e); continue
            dst = os.path.join(d, vid + '.mp3')
            flt = f'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04:stop_periods=-1:stop_threshold=-50dB:stop_duration=0.45:stop_silence=0.35,highpass=f=70,loudnorm=I=-17:TP=-2:LRA=9{FX.get(spk, "")},apad=pad_dur=0.15'
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-af', flt, '-ac', '1', '-ar', '44100', '-b:a', '64k' if code == 'ko' else '48k', dst], check=True); os.unlink(tmp)
            m = man.get(vid, {}); m.update({'spk': spk, 'dur': round(probe(dst), 2), 'eleven': src}); m['baked' if code == 'ko' else 'src'] = True if code == 'ko' else src
            if code == 'ko': m['text'] = src
            man[vid] = m; print(code, i + 1, '/', len(jobs), vid, spk, m['dur'], say[:30], flush=True)
            if (i + 1) % 20 == 0: json.dump(man, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
        json.dump(man, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('총', total, '글자 (ElevenLabs 크레딧 ≈ 글자 수)')


if __name__ == '__main__':
    main()
