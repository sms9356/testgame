#!/usr/bin/env python3
"""Apply finished ElevenLabs takes to voice/: download, loudness-normalise (same chain as
tools/redub_korean.py), update manifest dur/generation/hashes. Resumable via PROGRESS json.

    python3 tools/recast_apply.py PLAN.json PROGRESS.json DONE.json
DONE.json: {"line_id": {"url": "...", "generation_id": "...", "session_id": "...", "credits": 94}}
"""
import hashlib, json, subprocess, sys, tempfile, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODEL = 'eleven_v4'


def sha(b):
    return hashlib.sha256(b).hexdigest()


def main(plan_path, progress_path, done_path):
    plan = {p['id']: p for p in json.loads(Path(plan_path).read_text())}
    progress = json.loads(Path(progress_path).read_text()) if Path(progress_path).exists() else {}
    done = json.loads(Path(done_path).read_text())
    mpath = ROOT / 'voice/manifest.json'
    manifest = json.loads(mpath.read_text())
    n = 0
    for lid, d in done.items():
        if progress.get(lid, {}).get('status') == 'applied':
            continue
        p = dict(plan[lid]); p['prompt'] = d.get('prompt', p['prompt'])
        with tempfile.TemporaryDirectory() as td:
            raw = Path(td) / 'raw.mp3'
            with urllib.request.urlopen(d['url'], timeout=120) as r:
                raw.write_bytes(r.read())
            if raw.stat().st_size < 500:
                raise ValueError(lid + ': empty audio')
            target = ROOT / 'voice' / (lid + '.mp3')
            loud = -23 if '[whisper' in p['prompt'] else -19
            subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', str(raw), '-af',
                            f'highpass=f=65,loudnorm=I={loud}:TP=-2:LRA=11', '-ac', '1', '-ar', '44100',
                            '-b:a', '128k', str(target)], check=True)
        dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                             '-of', 'csv=p=0', str(target)], text=True).strip())
        if not 0.3 < dur < 180:
            raise ValueError(f'{lid}: implausible duration {dur}')
        e = manifest[lid]
        e['dur'] = round(dur, 3); e['baked'] = True; e['eleven'] = p['prompt']; e.pop('nofile', None)
        delivery = p['prompt'][:len(p['prompt']) - len(p['prompt'].lstrip('[]abcdefghijklmnopqrstuvwxyz ,-'))].strip()
        e['generation'] = {'voice_id': p['voice_id'], 'model_id': MODEL, 'language_code': 'ko',
                           'delivery': delivery, 'input_sha256': sha(p['prompt'].encode()),
                           'audio_sha256': sha(target.read_bytes()), 'generation_id': d.get('generation_id'),
                           'flow_session_id': d.get('session_id'), 'review_status': 'listening_required'}
        progress[lid] = {'status': 'applied', 'credits': d.get('credits'), 'generation_id': d.get('generation_id')}
        n += 1
    tmp = mpath.with_suffix('.tmp'); tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n'); tmp.replace(mpath)
    Path(progress_path).write_text(json.dumps(progress, ensure_ascii=False, indent=1))
    print('applied', n, 'total applied', sum(1 for v in progress.values() if v.get('status') == 'applied'),
          'credits', round(sum(v.get('credits') or 0 for v in progress.values())))


if __name__ == '__main__':
    main(*sys.argv[1:4])
