#!/usr/bin/env python3
"""더빙 음성 생성기 (오프라인 TTS: sherpa-onnx + vits-mimic3-ko_KO-kss_low).

사용법:
  pip install sherpa-onnx soundfile numpy
  # 모델: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-mimic3-ko_KO-kss_low.tar.bz2
  python3 tools/gen_voice.py <모델 폴더>

game.js 의 talk('...') 대사, world.js 의 쪽지(NOTES)와 아래 SCRIPT 를 모아
voice/<id>.mp3 와 voice/manifest.json 을 만든다. 화자별로 ffmpeg 로 음높이·효과를 바꾼다.
"""
import hashlib, json, os, re, subprocess, sys, tempfile
import sherpa_onnx, soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = sys.argv[1]
OUT = os.path.join(ROOT, 'voice')

# 화자: (음높이 배율, 말 속도, 추가 ffmpeg 필터)
SPK = {
    'seoyeon':  (1.00, 1.00, ''),
    'narrator': (0.84, 0.95, ',bass=g=3'),
    'friend':   (1.07, 1.05, ''),
    'teacher':  (0.78, 0.92, ',bass=g=4'),
    'pa':       (0.92, 0.95, ''),
    'ghost':    (0.70, 0.80, ',lowpass=f=2600,aecho=0.8:0.6:140|280:0.45|0.25'),
}
SCRIPT = [
    # 인트로 내레이션
    ('intro1', 'narrator', '10월 12일, 목요일. 밤 열한 시 사십 분.'),
    ('intro2', 'narrator', '휴학 중인 대학생 한서연에게, 메시지 한 통이 도착했다.'),
    ('intro3', 'friend', '여기, 아직 누군가의 흔적이 남아있어.'),
    ('intro4', 'narrator', '보낸 사람은, 십 년 전 이 학교에서 사라진 친구였다.'),
    # 휴대폰 메시지
    ('phone1', 'friend', '3층 방송실. 그 방송, 나도 들었어. 거기서 기다릴게.'),
    ('phone2', 'friend', '늦었어. 이번엔 꼭, 다시, 여기서.'),
    # 교내 방송
    ('pa1', 'pa', '교내 방송입니다. 모두 교실로 돌아가세요. 다시 한 번 알립니다. 모두, 교실로, 돌아가세요.'),
    # 유령 속삭임
    ('gh1', 'ghost', '다시, 여기서.'),
    ('gh2', 'ghost', '같이 놀자.'),
    ('gh3', 'ghost', '어디 가?'),
    ('gh4', 'ghost', '찾았다.'),
    # 녹음 테이프
    ('tape1', 'teacher', '보건 교사 기록. 오늘도 그 아이가 왔다. 이름을 물었더니, 웃기만 했다. 불을 끄지 말라고, 몇 번이나 말했다.'),
    ('tape2', 'friend', '녹음 시작. 지금 방송실이야. 스피커에서 누가 우리 이름을 불러. 한 명씩. 다음은, 서연이야.'),
    ('tape3', 'teacher', '정문 열쇠는 다섯 조각으로 나눴다. 교무실 금고, 도서실, 과학실, 체육관, 수영장. 모두 모으기 전엔, 아무도 나갈 수 없다.'),
    ('tape4', 'friend', '서연아, 이거 들으면 바로 나가. 그 애는 불빛을 싫어해. 그리고 문을 닫으면, 잠깐은 못 봐.'),
    # 엔딩
    ('win', 'narrator', '당신은 폐교를 빠져나왔다. 뒤돌아보지 마라.'),
    ('dead', 'narrator', '칠판에 한 줄이 더 늘었다. 다시, 여기서.'),
]

def speakable(t):
    t = re.sub(r'<[^>]+>', ' ', t).replace('…', ', ').replace('“', '').replace('”', '').replace('‘', '').replace('’', '')
    t = re.sub(r'\(.*?\)', '', t)
    t = re.sub(r'\s+', ' ', t).strip(' ,')
    return t

def collect():
    items = list(SCRIPT)
    g = open(os.path.join(ROOT, 'game.js'), encoding='utf-8').read()
    talks = set()
    for m in re.finditer(r"talk\((.*?)(?:, \d+\)|\))", g):
        talks.update(re.findall(r"'([^']+)'", m.group(1)))
    for t in sorted(talks):
        items.append(('t_' + hashlib.sha1(t.encode()).hexdigest()[:10], 'seoyeon', t))
    w = open(os.path.join(ROOT, 'world.js'), encoding='utf-8').read()
    for nid, title, text in re.findall(r"\b(n\d+): \{ title: '([^']+)', text: '([^']+)'", w):
        items.append(('note_' + nid, 'narrator', title + '. ' + text))
    return items

def main():
    d = MODEL.rstrip('/') + '/'
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=d + 'ko_KO-kss_low.onnx', tokens=d + 'tokens.txt', data_dir=d + 'espeak-ng-data', noise_scale=.5, noise_scale_w=.6), num_threads=4))
    tts = sherpa_onnx.OfflineTts(cfg)
    os.makedirs(OUT, exist_ok=True)
    man = {}
    for vid, spk, text in collect():
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
    json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

if __name__ == '__main__':
    main()
