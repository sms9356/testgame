"""rc.py next N        -> list next N pending lines (id|voice|prompt)
rc.py start id=sess ...  -> mark started with session id
rc.py done FILE      -> FILE lines: "id gen url credits" ; writes done_cur.json for recast_apply
rc.py stat"""
import json, sys
S = '/tmp/claude-0/-home-user-testgame/fdfd7214-ba27-557e-a3d2-82d60d020e16/scratchpad/recast/'
plan = json.load(open(S + 'plan.json')); prog = json.load(open(S + 'progress.json'))
cmd = sys.argv[1]
if cmd == 'next':
    n = int(sys.argv[2]); out = []
    for p in plan:
        st = prog.get(p['id'], {}).get('status')
        if st in ('applied', 'started', 'take_saved_not_applied'):
            continue
        out.append(p)
        if len(out) >= n: break
    for p in out: print(p['id'] + '|' + p['voice_id'] + '|' + p['prompt'])
elif cmd == 'start':
    for a in sys.argv[2:]:
        k, s = a.split('=')
        prog[k] = {'status': 'started', 'session_id': s}
    json.dump(prog, open(S + 'progress.json', 'w'), indent=1)
elif cmd == 'done':
    d = {}
    for ln in open(sys.argv[2]):
        if not ln.strip(): continue
        k, g, u, c = ln.split()
        d[k] = {'url': u, 'generation_id': g, 'session_id': prog.get(k, {}).get('session_id'), 'credits': float(c)}
    json.dump(d, open(S + 'done_cur.json', 'w'), indent=1)
elif cmd == 'stat':
    from collections import Counter
    print(Counter(v.get('status') for v in prog.values()), 'pending', sum(1 for p in plan if prog.get(p['id'], {}).get('status') != 'applied'),
          'credits', round(sum(v.get('credits') or 0 for v in prog.values() if v.get('status') in ('applied', 'discarded_test'))))
