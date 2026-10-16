#!/usr/bin/env python3
"""Reproducible Korean performance takes. Dry-run unless --generate is supplied.

Writes into a separate output directory; never overwrites the game's voice pack.
Each request is sent once (no automatic paid retries). Existing raw takes resume
locally. ELEVENLABS_API_KEY is read only from the environment.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def write_json(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)


def render(line_id, info, config, out):
    performance = config['lines'][line_id]
    voice = config['speakers'][info['spk']]
    body = {'text': performance['input'], 'model_id': config['model_id'],
            'language_code': 'ko', 'voice_settings': {'stability': 0.5}}
    fingerprint = digest({'voice_id': voice['voice_id'], **body})
    raw = out / 'raw' / (line_id + '.mp3')
    receipt = out / 'raw' / (line_id + '.json')
    if raw.exists():
        if not receipt.exists() or json.loads(receipt.read_text())['fingerprint'] != fingerprint:
            raise ValueError(f'{line_id}: existing take does not match; choose a new output directory')
        meta = json.loads(receipt.read_text())
    else:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice['voice_id']}?output_format=mp3_44100_128"
        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={
            'xi-api-key': os.environ['ELEVENLABS_API_KEY'], 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
        with urllib.request.urlopen(req, timeout=180) as response:
            audio = response.read()
            meta = {'fingerprint': fingerprint, 'request_id': response.headers.get('request-id'),
                    'billed_characters': response.headers.get('x-character-count')}
        if len(audio) < 500:
            raise ValueError(f'{line_id}: empty or invalid audio')
        raw.write_bytes(audio)
        write_json(receipt, meta)
    target = out / 'voice' / (line_id + '.mp3')
    # Preserve every pause and breath. No pitch shift, tremolo, silence removal,
    # or baked reverb; device/room effects belong to the game's mixer.
    loudness = -23 if performance['delivery'] == 'whisper' else -19
    filters = f'highpass=f=65,loudnorm=I={loudness}:TP=-2:LRA=11'
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', str(raw), '-af', filters,
                    '-ac', '1', '-ar', '44100', '-b:a', '128k', str(target)], check=True)
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                     'format=duration', '-of', 'csv=p=0', str(target)], text=True).strip())
    if not 0.3 < duration < 180:
        raise ValueError(f'{line_id}: implausible duration {duration}')
    entry = {**info, 'dur': round(duration, 3), 'baked': True, 'eleven': info['text']}
    entry.pop('nofile', None)
    entry['generation'] = {'voice_id': voice['voice_id'], 'model_id': config['model_id'],
        'language_code': 'ko', 'voice_settings': body['voice_settings'],
        'delivery': performance['delivery'], 'input_sha256': digest(body['text']),
        'audio_sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'request_id': meta['request_id'], 'review_status': 'listening_required'}
    return line_id, entry


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--generate', action='store_true')
    p.add_argument('--only', help='comma-separated line IDs')
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--workers', type=int, default=2, choices=[1, 2, 3])
    args = p.parse_args()
    config = json.loads((ROOT / 'tools/korean_performance.json').read_text())
    manifest = json.loads((ROOT / 'voice/manifest.json').read_text())
    ids = args.only.split(',') if args.only else list(config['lines'])
    for line_id in ids:
        info = manifest[line_id]
        if digest(info['text']) != config['lines'][line_id]['source_sha256']:
            raise ValueError(f'{line_id}: source dialogue changed; update direction first')
        assert info['spk'] in config['speakers']
    print(json.dumps({'lines': len(ids), 'input_characters': sum(len(config['lines'][i]['input']) for i in ids),
                      'model': config['model_id'], 'generate': args.generate}), flush=True)
    if not args.generate:
        return
    args.out = args.out.resolve()
    if args.out == ROOT or ROOT in args.out.parents:
        raise ValueError('Output must be outside the repository; review takes before importing')
    for directory in ['raw', 'voice']:
        (args.out / directory).mkdir(parents=True, exist_ok=True)
    results, failures = {}, {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(render, i, manifest[i], config, args.out): i for i in ids}
        for future in as_completed(jobs):
            line_id = jobs[future]
            try:
                _, entry = future.result()
                results[line_id] = entry
                print('OK', len(results), '/', len(ids), line_id, entry['dur'], flush=True)
            except Exception as exc:
                failures[line_id] = str(exc)
                print('FAILED', line_id, str(exc), flush=True)
            write_json(args.out / 'results.json', {'lines': results, 'failures': failures})
    if failures:
        raise SystemExit(f'{len(failures)} failed; successful takes saved; no automatic retries')
    write_json(args.out / 'voice/manifest.json', {**manifest, **results})


if __name__ == '__main__':
    main()
