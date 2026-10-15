# 민아 동작 — game_engine(UE 마네킹 이름) 리그에 코드로 키프레임 (모션 캡처 아님: 자세 함수 + 키 자세 사이 구면 보간 + 발 접지 풀이)
import bpy, math
from mathutils import Vector as V, Matrix, Quaternion
FPS = 30
def setup(arm):
    bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    return arm.pose.bones
def reset(P):
    for pb in P: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
def _set(pb, M):
    # 포즈 행렬을 직접 넣으면 오차가 크기(scale)로 쌓인다 → 로컬 공간으로 바꿔 '회전만' 정규화해 넣는다
    basis = pb.id_data.convert_space(pose_bone=pb, matrix=M, from_space='POSE', to_space='LOCAL')
    pb.rotation_quaternion = basis.to_quaternion().normalized(); bpy.context.view_layer.update()
def rot(P, b, axis, deg):
    pb = P[b]; M = pb.matrix.copy(); h = M.translation.copy()
    _set(pb, Matrix.Translation(h) @ Matrix.Rotation(math.radians(deg), 4, V(axis).normalized()) @ Matrix.Translation(-h) @ M)
def aim(P, b, d, amt=1.):
    pb = P[b]; M = pb.matrix.copy(); cur = (M.to_3x3() @ V((0, 1, 0))).normalized(); q = cur.rotation_difference(V(d).normalized())
    if amt < 1: q = Quaternion().slerp(q, amt)
    h = M.translation.copy(); _set(pb, Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ M)
def local_x(P, b): return (P[b].matrix.to_3x3() @ V((1, 0, 0))).normalized()
FING = ['index', 'middle', 'ring', 'pinky']
def curl(P, side, deg, thumb=None):
    for f in FING:
        for i in (1, 2, 3): rot(P, f'{f}_0{i}_{side}', local_x(P, f'{f}_0{i}_{side}'), deg * (.8 if i == 1 else 1.))
    if thumb is not None:
        for i in (2, 3): rot(P, f'thumb_0{i}_{side}', local_x(P, f'thumb_0{i}_{side}'), thumb)
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)

def k_all(arm, P, f):
    for pb in P:
        pb.keyframe_insert('rotation_quaternion', frame=f)
    P['pelvis'].keyframe_insert('location', frame=f)
def bake(arm, name, frames, pose, loop=True):
    P = arm.pose.bones; act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = act
    for f in range(frames + (1 if loop else 0)):
        reset(P); pose(P, f / FPS, f / frames); k_all(arm, P, f + 1)
    return act
def capture(P):
    d = {pb.name: pb.rotation_quaternion.copy() for pb in P}; d['_loc'] = P['pelvis'].location.copy(); return d
def apply_q(P, Q):
    for pb in P: pb.rotation_quaternion = Q[pb.name]
    P['pelvis'].location = Q['_loc']; bpy.context.view_layer.update()
def mixq(A, B, k):
    o = {n: A[n].slerp(B[n], k) for n in A if n != '_loc'}; o['_loc'] = A['_loc'].lerp(B['_loc'], k); return o
def move_pelvis(P, target):
    pb = P['pelvis']; M = pb.matrix.copy(); M.translation = V(target)
    basis = pb.id_data.convert_space(pose_bone=pb, matrix=M, from_space='POSE', to_space='LOCAL'); pb.location = basis.to_translation(); bpy.context.view_layer.update()
def ik2(P, a, b, c, target, pole):
    """2본 IK: a(위) · b(아래) 를 돌려 c(끝 본 머리)가 target 에 닿게. pole = 무릎/팔꿈치가 향할 방향"""
    bpy.context.view_layer.update()
    A = P[a].head.copy(); la = (P[b].head - P[a].head).length; lb = (P[c].head - P[b].head).length
    d = V(target) - A; dist = max(.01, min(d.length, la + lb - 1e-4)); n = d.normalized()
    ca = max(-1., min(1., (la * la + dist * dist - lb * lb) / (2 * la * dist))); sa = math.sqrt(1 - ca * ca)
    p = V(pole); p = (p - n * p.dot(n)).normalized(); knee = A + n * la * ca + p * la * sa
    aim(P, a, knee - A); aim(P, b, (A + n * dist) - knee)
REST = {}
def ground(P, anchor_y=True):
    """발목(foot 본 머리)이 바닥 위 쉬는 높이에 닿도록 골반을 옮긴다. anchor_y: 발 앞뒤 위치를 선 자세와 같게"""
    bpy.context.view_layer.update()
    fz = min(P['foot_l'].head.z, P['foot_r'].head.z); dz = REST['fz'] - fz
    dy = (REST['fy'] - (P['foot_l'].head.y + P['foot_r'].head.y) / 2) if anchor_y else 0.
    pb = P['pelvis']; M = pb.matrix.copy(); M.translation += V((0, dy, dz))
    basis = pb.id_data.convert_space(pose_bone=pb, matrix=M, from_space='POSE', to_space='LOCAL'); pb.location = basis.to_translation(); bpy.context.view_layer.update()
def ss(x): x = max(0., min(1., x)); return x * x * (3 - 2 * x)
def stand(P, t, arms=True):
    br = math.sin(t * 2 * math.pi / 3.4)
    rot(P, 'spine_02', X, -.8 * br); rot(P, 'spine_03', X, -1.0 * br)
    if arms:
        aim(P, 'upperarm_l', (.14, .02, -1)); aim(P, 'lowerarm_l', (.06, -.15, -1)); aim(P, 'upperarm_r', (-.14, .02, -1)); aim(P, 'lowerarm_r', (-.06, -.15, -1))
        curl(P, 'l', 20, 8); curl(P, 'r', 20, 8)
def idle(P, t, u):
    stand(P, t); rot(P, 'head', Z, 6 * math.sin(u * 2 * math.pi)); rot(P, 'pelvis', Y, .8 * math.sin(u * 2 * math.pi))
def scared_idle(P, t, u):
    stand(P, t, arms=False); tr = math.sin(t * 2 * math.pi * 6) * .8
    rot(P, 'spine_01', X, 6); rot(P, 'spine_03', X, 5); rot(P, 'head', Z, 25 * math.sin(u * 2 * math.pi) + tr); rot(P, 'head', X, 4)
    aim(P, 'upperarm_l', (.22, -.45, -.85)); aim(P, 'lowerarm_l', (-.75, -.35, .45)); aim(P, 'upperarm_r', (-.22, -.45, -.85)); aim(P, 'lowerarm_r', (.75, -.3, .55))
    curl(P, 'l', 45, 20); curl(P, 'r', 45, 20)
def walk_pose(run):
    def p(P, t, u):
        ph = u * 2 * math.pi; s = math.sin(ph)
        A = 38 if run else 22; lean = 9 if run else 2
        rot(P, 'pelvis', Z, 5 * s); rot(P, 'spine_01', X, -lean); rot(P, 'spine_03', Z, -6 * s)
        for side, sg in (('l', 1), ('r', -1)):
            sw = s * sg; rot(P, f'thigh_{side}', X, -A * sw)
            knee = max(0, -math.cos(ph + (0 if sg > 0 else math.pi))) * (75 if run else 42) + 5; rot(P, f'calf_{side}', X, knee)
            rot(P, f'foot_{side}', X, -A * .35 * sw - knee * .25)
        for side, sg in (('l', -1), ('r', 1)):
            ax = .14 * (1 if side == 'l' else -1)
            aim(P, f'upperarm_{side}', (ax, -.1 * sg * s * (2.2 if run else 1), -1)); rot(P, f'upperarm_{side}', X, (30 if run else 14) * sg * s)
            aim(P, f'lowerarm_{side}', (ax * .5, -(1.2 if run else .3) - .2 * sg * s, -1 if not run else -.4))
        curl(P, 'l', 30 if run else 20, 10); curl(P, 'r', 30 if run else 20, 10)
        rot(P, 'head', X, lean * .6)
        ground(P, anchor_y=False)
    return p
def frightened(P, t, u):
    stand(P, t, arms=False); tr = math.sin(t * 2 * math.pi * 7) * 1.4
    rot(P, 'spine_01', X, 14); rot(P, 'spine_03', X, 8 + tr * .5); rot(P, 'head', X, 12); rot(P, 'neck_01', X, 6)
    for s_ in ('l', 'r'): rot(P, f'thigh_{s_}', X, -26); rot(P, f'calf_{s_}', X, 48); rot(P, f'foot_{s_}', X, -22)
    aim(P, 'upperarm_l', (.32, -.75, -.3)); aim(P, 'lowerarm_l', (-.6, -.3, .75)); aim(P, 'upperarm_r', (-.32, -.75, -.3)); aim(P, 'lowerarm_r', (.6, -.3, .75))
    rot(P, 'upperarm_l', X, tr); curl(P, 'l', 50, 20); curl(P, 'r', 50, 20)
    ground(P)
# ── 앉은 자세들 (벽은 등 뒤 +y · 얼굴은 -y)
SEAT, REACH = .155, .44   # 앉았을 때 골반 높이 · 발목이 골반보다 앞에 있는 거리
def sit_base(P, t, head=(.32, -.55, .75), arms='asleep', br_amp=1., reach=REACH, seat=SEAT, lean=.42):
    br = math.sin(t * 2 * math.pi / (4.6 if arms == 'asleep' else 3.2)) * br_amp
    aim(P, 'spine_01', (0, lean, 1)); aim(P, 'spine_02', (0, lean * .66 - .03 * br, 1)); aim(P, 'spine_03', (0, lean * .2 - .04 * br, 1))
    aim(P, 'neck_01', (head[0] * .4, -.15, 1)); aim(P, 'head', head)
    move_pelvis(P, (REST['px'], REST['fy'] + reach, seat))
    for side, sx in (('l', 1), ('r', -1)):
        ik2(P, f'thigh_{side}', f'calf_{side}', f'foot_{side}', (sx * (.12 if side == 'l' else .09), REST['fy'] - (0 if side == 'l' else .05), REST['fz']), (sx * .25, -1, 1.1))
        aim(P, f'foot_{side}', (sx * .12, -1, -.5))
    kl, kr = P['calf_l'].head.copy(), P['calf_r'].head.copy()
    if arms == 'asleep':   # 왼손은 무릎 위, 오른팔은 옆 바닥에 늘어뜨림
        ik2(P, 'upperarm_l', 'lowerarm_l', 'hand_l', kl + V((-.02, .05, .035)), (1, .6, -.4)); aim(P, 'hand_l', (-.3, -.5, -.8))
        ik2(P, 'upperarm_r', 'lowerarm_r', 'hand_r', V((REST['px'] - .3, REST['fy'] + reach - .08, .085)), (-.4, .8, .2)); aim(P, 'hand_r', (-.35, -.7, -.6))
        curl(P, 'l', 30, 12); curl(P, 'r', 22, 8)
    else:
        if arms == 'temple':
            fh = P['head'].matrix @ REST['fh']; fwd = (P['head'].matrix.to_3x3() @ REST['fwd']).normalized()
            ik2(P, 'upperarm_r', 'lowerarm_r', 'hand_r', fh + fwd * .1 + V((-.07, 0, -.04)), (-1, .2, -.5)); aim(P, 'hand_r', (fh - P['hand_r'].head) + V((0, 0, .03))); curl(P, 'r', 15, 5)
        else:
            ik2(P, 'upperarm_r', 'lowerarm_r', 'hand_r', kr + V((.02, .05, .035)), (-1, .6, -.4)); aim(P, 'hand_r', (.3, -.5, -.8)); curl(P, 'r', 35, 12)
        ik2(P, 'upperarm_l', 'lowerarm_l', 'hand_l', kl + V((-.02, .05, .035)), (1, .6, -.4)); aim(P, 'hand_l', (-.3, -.5, -.8)); curl(P, 'l', 35, 12)
def sitting(P, t, u):
    sit_base(P, t); rot(P, 'head', Y, 2 * math.sin(u * 2 * math.pi)); ground(P)
def pose_at(P, fn, t, u=0.):
    reset(P); fn(P, t, u); ground(P); return capture(P)
def recovery(P, t, u):
    """잠에서 깨어남: 고개 들기 → 이마 짚기 → 두리번 → 무릎 위 손 (3.5초)"""
    A = pose_at(P, lambda P, t, u: sit_base(P, t), t)
    Bq = pose_at(P, lambda P, t, u: sit_base(P, t, head=(-.1, -.45, .9), arms='temple', br_amp=1.6), t)
    C = pose_at(P, lambda P, t, u: sit_base(P, t, head=(.45 * math.sin(u * 9), -.75, .55), arms='knees', br_amp=1.6), t, u)
    D = pose_at(P, lambda P, t, u: sit_base(P, t, head=(0, -.8, .55), arms='knees', br_amp=1.4), t)
    if u < .3: Q = mixq(A, Bq, ss(u / .3))
    elif u < .55: Q = Bq
    elif u < .8: Q = mixq(Bq, C, ss((u - .55) / .25))
    else: Q = mixq(C, D, ss((u - .8) / .2))
    reset(P); apply_q(P, Q); ground(P)
def standup(P, t, u):
    """일어서기 (2.6초): 무릎 위 손 → 몸을 앞으로 · 발을 당겨 쪼그려 앉기 → 반쯤 일어남 → 선 자세"""
    K0 = pose_at(P, lambda P, t, u: sit_base(P, t, head=(0, -.8, .55), arms='knees', br_amp=1.4), t)
    def crouch(P, t, u):
        aim(P, 'thigh_l', (.2, -.92, .28)); aim(P, 'thigh_r', (-.2, -.92, .28)); aim(P, 'calf_l', (.02, .42, -1)); aim(P, 'calf_r', (-.02, .42, -1))
        aim(P, 'foot_l', (.1, -1, -.5)); aim(P, 'foot_r', (-.1, -1, -.5))
        aim(P, 'spine_01', (0, -.55, .85)); aim(P, 'spine_02', (0, -.4, 1)); aim(P, 'spine_03', (0, -.25, 1)); aim(P, 'neck_01', (0, -.2, 1)); aim(P, 'head', (0, -.45, .9))
        aim(P, 'upperarm_l', (.25, -.55, -.8)); aim(P, 'lowerarm_l', (.1, -.4, -1)); aim(P, 'upperarm_r', (-.25, -.55, -.8)); aim(P, 'lowerarm_r', (-.1, -.4, -1))
        curl(P, 'l', 20, 6); curl(P, 'r', 20, 6)
    def half(P, t, u):
        aim(P, 'thigh_l', (.1, -.7, -.7)); aim(P, 'thigh_r', (-.1, -.7, -.7)); aim(P, 'calf_l', (.02, .3, -1)); aim(P, 'calf_r', (-.02, .3, -1))
        aim(P, 'foot_l', (.1, -1, -.5)); aim(P, 'foot_r', (-.1, -1, -.5))
        aim(P, 'spine_01', (0, -.45, 1)); aim(P, 'spine_02', (0, -.25, 1)); aim(P, 'spine_03', (0, -.1, 1)); aim(P, 'neck_01', (0, -.1, 1)); aim(P, 'head', (0, -.3, 1))
        aim(P, 'upperarm_l', (.25, -.3, -1)); aim(P, 'lowerarm_l', (.1, -.4, -1)); aim(P, 'upperarm_r', (-.25, -.3, -1)); aim(P, 'lowerarm_r', (-.1, -.4, -1))
        curl(P, 'l', 25, 8); curl(P, 'r', 25, 8)
    K1 = pose_at(P, crouch, t); K2 = pose_at(P, half, t); K3 = pose_at(P, lambda P, t, u: stand(P, t), t)
    if u < .38: Q = mixq(K0, K1, ss(u / .38))
    elif u < .7: Q = mixq(K1, K2, ss((u - .38) / .32))
    else: Q = mixq(K2, K3, ss((u - .7) / .3))
    reset(P); apply_q(P, Q); ground(P)
def idle_g(fn):
    def p(P, t, u): fn(P, t, u); ground(P)
    return p
CLIPS = [('Idle', 102, idle_g(idle), True), ('ScaredIdle', 120, idle_g(scared_idle), True), ('Walk', 34, walk_pose(False), True), ('Run', 22, walk_pose(True), True),
         ('Frightened', 60, frightened, True), ('SittingAgainstWall', 138, sitting, True), ('Recovery', 105, recovery, False), ('StandUp', 78, standup, False)]
def build_all(arm):
    P = setup(arm); reset(P)
    REST['fz'] = min(P['foot_l'].head.z, P['foot_r'].head.z); REST['fy'] = (P['foot_l'].head.y + P['foot_r'].head.y) / 2; REST['px'] = P['pelvis'].head.x
    ev = [v.co for v in bpy.data.objects['Mina_Eyes'].data.vertices]; ec = sum(ev, V()) / len(ev); hb = arm.data.bones['head'].matrix_local
    REST['fh'] = hb.inverted() @ (ec + V((0, -.03, .05))); REST['fwd'] = hb.to_3x3().inverted() @ V((0, -1, 0))
    out = []
    for name, n, fn, loop in CLIPS: out.append((name, n, bake(arm, name, n, fn, loop)))
    arm.animation_data.action = bpy.data.actions['SittingAgainstWall']; reset(arm.pose.bones); bpy.ops.object.mode_set(mode='OBJECT')
    return out
