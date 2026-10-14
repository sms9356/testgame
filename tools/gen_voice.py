#!/usr/bin/env python3
"""더빙 음성 생성기 (오프라인 TTS: sherpa-onnx + vits-mimic3-ko_KO-kss_low).

사용법:
  pip install sherpa-onnx soundfile numpy
  # 모델: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-mimic3-ko_KO-kss_low.tar.bz2
  python3 tools/gen_voice.py <모델 폴더>

story.js 의 주인공 대사(LINES · 지훈/서연 두 버전), 기타 화자(VO), 하교 방송, 쪽지(NOTES)를 모아
voice/<id>.mp3 와 voice/manifest.json 을 만든다. 화자별로 ffmpeg 로 음높이·효과를 바꾼다.
"""
import hashlib, json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'voice')

# 화자: (음높이 배율, 말 속도, 추가 ffmpeg 필터)
SPK = {
    'seoyeon':  (1.00, 1.00, ''),
    'jihun':    (0.80, 0.96, ',bass=g=3'),
    'narrator': (0.84, 0.95, ',bass=g=3'),
    'mina':     (1.07, 1.05, ''),
    'haneul':   (1.12, 0.88, ',aecho=0.8:0.5:90:0.3'),
    'teacher':  (0.78, 0.92, ',bass=g=4'),
    'pa':       (0.92, 0.95, ''),
    'ghost':    (0.70, 0.80, ',lowpass=f=2600,aecho=0.8:0.6:140|280:0.45|0.25'),
}
CH = {'j': 'jihun', 's': 'seoyeon'}

def speakable(t):
    t = re.sub(r'<[^>]+>', ' ', t).replace('…', ', ').replace('“', '').replace('”', '').replace('‘', '').replace('’', '').replace('___', '')
    t = re.sub(r'\(.*?\)', '', t)
    t = re.sub(r'\s+', ' ', t).strip(' ,')
    return t

def collect(only=None):
    """story.js 를 node 로 읽어 (id, 화자, 문장) 목록을 만든다."""
    js = "import('" + os.path.join(ROOT, 'story.js').replace('\\', '/') + "').then(m => console.log(JSON.stringify({LINES: m.LINES, BROADCAST: m.BROADCAST, MINA_WAKE: m.MINA_WAKE, VO: m.VO, NOTES: m.NOTES})))"
    S = json.loads(subprocess.run(['node', '--input-type=module', '-e', js], capture_output=True, text=True, check=True).stdout)
    items = [(k, v['spk'], v['text']) for k, v in S['VO'].items()]
    for lid, d in S['LINES'].items():
        for c, t in d.items(): items.append((f'l_{lid}_{c}', CH[c], t))
    for c, t in S['BROADCAST'].items(): items.append((f'bc_{c}', CH[c], t))
    for c, t in S['MINA_WAKE'].items(): items.append((f'mw_{c}', 'mina', t))
    for nid, n in S['NOTES'].items(): items.append(('note_' + nid, 'narrator', n['title'] + '. ' + n['text']))
    return [i for i in items if not only or i[0] in only]

def main():
    import sherpa_onnx, soundfile as sf
    d = sys.argv[1].rstrip('/') + '/'
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=d + 'ko_KO-kss_low.onnx', tokens=d + 'tokens.txt', data_dir=d + 'espeak-ng-data', noise_scale=.5, noise_scale_w=.6), num_threads=4))
    tts = sherpa_onnx.OfflineTts(cfg)
    os.makedirs(OUT, exist_ok=True)
    mp = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mp, encoding='utf-8')) if len(sys.argv) > 2 and os.path.exists(mp) else {}
    for vid, spk, text in collect(set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None):
        k, speed, extra = SPK[spk]
        a = tts.generate(speakable(text), sid=0, speed=speed)
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tf: sf.write(tf.name, a.samples, a.sample_rate)
        sr = a.sample_rate
        flt = f'asetrate={int(sr * k)},aresample=44100,atempo={1 / k:.4f},highpass=f=70,loudnorm=I=-17:TP=-2:LRA=9{extra},apad=pad_dur=0.15'
        dst = os.path.join(OUT, vid + '.mp3')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tf.name, '-af', flt, '-ac', '1', '-b:a', '48k', dst], check=True)
        os.unlink(tf.name)
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst], capture_output=True, text=True).stdout.strip())
        man[vid] = {'spk': spk, 'text': re.sub(r'<[^>]+>', ' ', text), 'dur': round(dur, 2)}
        print(vid, spk, round(dur, 2), speakable(text)[:40])
    json.dump(man, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

if __name__ == '__main__':
    main()
