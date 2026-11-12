#!/usr/bin/env python3
"""Korean recast plan: cast sheet + per-line eleven_v4 performance direction + priority order.

    python3 tools/recast_plan.py PLAN.json      # writes the ordered plan (id, voice_id, prompt, chars)

The spoken Korean text is never changed; only English audio tags are prepended
(and Korean bracket labels such as [수아] become plain "수아," so v4 reads them
instead of treating them as tags).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODEL = 'eleven_v4'

# speaker -> (voice_id, library name, base delivery tag)
CAST = {
    'jihun':     ('HrAPO433QYkPmU4F4CHw', 'Jun Ho - Friendly & Drama Actor', '[nervous]'),
    'seoyeon':   ('O2KReOFLpoR65nz6C9Se', 'Aria - Bright & Youthful Korean', '[nervous]'),
    'mina':      ('5I7B1di44aCL15NkP0jn', 'Kanna - Calm & Friendly', '[worried]'),
    'haneul':    ('1BZBO072RKJTzZcDjRox', 'Sora - Warm Korean Storyteller', '[softly]'),
    'narrator':  ('8G6jifm9f1BhHXadvwOt', 'Kang - Calm, Deep Korean Storyteller', '[low voice]'),
    'guard':     ('UmYoqGlufKxhJ6NCx5Mv', 'Jang ho 장호', '[elderly voice]'),
    'headTeacher': ('4JJwo477JUAx3HV0T7n7', 'Yohan Koo - Confident authority', '[serious]'),
    'teacher':   ('4JJwo477JUAx3HV0T7n7', 'Yohan Koo - Confident authority', '[serious]'),
    'principal': ('kiVK4omWhBQ9AzwcaRq7', 'Hyeonwoo', '[regretful]'),
    'witness_principal': ('kiVK4omWhBQ9AzwcaRq7', 'Hyeonwoo', '[regretful]'),
    'scienceTeacher': ('l6fNdLYgoqjfTIPUeFc9', 'MJ - Calm, Clear, Versatile', '[serious]'),
    'witness_science': ('l6fNdLYgoqjfTIPUeFc9', 'MJ - Calm, Clear, Versatile', '[serious]'),
    'junho':     ('Ir7oQcBXWiq4oFGROCfj', 'taemin', '[regretful]'),
    'mother':    ('tbMC7ogaglVnkFQgUOta', 'Anisia - Calm, natural, warm', '[sad]'),
    'cook':      ('0oqpliV6dVSr9XomngOW', 'Jini - Warm & Intelligent', '[warmly]'),
    'dormMother': ('0oqpliV6dVSr9XomngOW', 'Jini - Warm & Intelligent', '[quietly]'),
    'mom':       ('9cino9hfS3ougiPeFvp1', '수진 - 밝고 친근한 여성', '[worried]'),
}
# speakers kept on their current voice (already a good fit) but re-performed with new direction
KEEP_TAG = {
    'reporter': '[serious]', 'pa': '[calm]', 'peTeacher': '[gruff]', 'homeroom': '[tearful]', 'nurse': '[softly]',
    'witness_nurse': '[softly]', 'librarian': '[hushed, nervous]', 'counselor': '[gently]', 'witness_counselor': '[gently]',
    'friend': '[casual]', 'friend2': '[casual]', 'snackLady': '[warmly]', 'paramedic': '[urgently]',
    'vicePrincipal': '[serious]', 'electrician': '[rough]', 'musicTeacher': '[softly]', 'artTeacher': '[quietly]',
    'janitor': '[quietly]', 'dispatcher': '[calm]', 'police': '[calm]', 'classRep': '[nervous]',
}
EMO_TAG = {'fear': '[frightened]', 'urgent': '[urgently]', 'surprise': '[surprised]', 'whisper': '[whispers]',
           'resolve': '[determined]', 'relief': '[relieved]', 'sad': '[sad]'}


def emo_of(line_id):
    src = (ROOT / 'voice.js').read_text()
    def table(name):
        body = re.search(name + r' = \{(.*?)\};', src, re.S).group(1)
        return dict(re.findall(r"(\w+): '(\w+)'", body))
    return table('LINE_EMO'), table('VO_EMO')


def priority(k):
    order = [r'^intro', r'^(l_|cam|bc|mw|news|mc_|cue_|pr_|ghThanks|pa1|echo|guard|teacher)', r'^end', r'^(call|phone|r_)',
             r'^(tape|mtape|ts_|vo_|gd_|cr_)', r'^(note|nd_|nv_)']
    for i, p in enumerate(order):
        if re.match(p, k):
            return i
    return len(order)


def direction(k, v, line_emo, vo_emo):
    spk = v['spk']
    base = CAST[spk][2] if spk in CAST else KEEP_TAG.get(spk, '')
    m = re.match(r'^l_(.+)_[js]$', k)
    emo = line_emo.get(m.group(1)) if m else vo_emo.get(k)
    tags = []
    if emo in EMO_TAG:
        tags.append(EMO_TAG[emo])
    elif base:
        tags.append(base)
    text = v['text']
    if re.match(r'^(tape|mtape|ts_|vo_|cr_)', k) and '[trembling voice]' not in tags and spk not in ('reporter', 'pa'):
        tags.append('[slowly]')
    if re.match(r'^(call|phone|gd_)', k):
        tags.insert(0, '[over the phone]' if not k.startswith('gd_') else '[over a walkie-talkie]')
    if re.match(r'^(note|nd_)', k) and spk == 'narrator':
        tags = ['[quietly]', '[slowly]']
    if text.startswith('……') or text.startswith('...'):
        tags.append('[hesitant]')
    if spk == 'pa' and k.startswith('elv'):
        tags = ['[calm]']
    # Korean bracket labels (speaker names, document headers) are spoken, not tags
    text = re.sub(r'\[([^\]\x00-\x7f][^\]]*)\]', lambda mm: mm.group(1) + ',', text)
    return (' '.join(dict.fromkeys(tags)) + ' ' + text).strip()


def main(out):
    manifest = json.loads((ROOT / 'voice/manifest.json').read_text())
    line_emo, vo_emo = emo_of(None)
    plan = []
    for k, v in manifest.items():
        spk = v['spk']
        vid = CAST[spk][0] if spk in CAST else (v.get('generation') or {}).get('voice_id')
        prompt = direction(k, v, line_emo, vo_emo)
        plan.append({'id': k, 'spk': spk, 'voice_id': vid, 'prompt': prompt, 'chars': len(prompt), 'pri': priority(k)})
    plan.sort(key=lambda p: p['pri'])
    Path(out).write_text(json.dumps(plan, ensure_ascii=False, indent=1))
    by = {}
    for p in plan:
        by[p['pri']] = by.get(p['pri'], 0) + p['chars']
    print(len(plan), sum(p['chars'] for p in plan), by)


if __name__ == '__main__':
    main(sys.argv[1])
