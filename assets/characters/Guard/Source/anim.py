# 경비원 동작 9종 — game_engine(UE 마네킹 이름) 리그에 코드로 키프레임 (모션 캡처 아님: 자세 함수를 시간에 따라 계산)
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
def stand(P, t, arms=True):
    """편히 선 자세 + 숨쉬기 (모든 동작의 바탕)"""
    br = math.sin(t * 2 * math.pi / 3.6)
    rot(P, 'spine_02', X, -1.0 * br); rot(P, 'spine_03', X, -1.2 * br)
    if arms:
        aim(P, 'upperarm_l', (.16, .03, -1)); aim(P, 'lowerarm_l', (.1, -.18, -1)); aim(P, 'upperarm_r', (-.16, .03, -1)); aim(P, 'lowerarm_r', (-.08, -.35, -1))
        curl(P, 'l', 18, 8); curl(P, 'r', 72, 30)   # 오른손은 손전등을 쥔다
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
def walk_pose(run):
    def p(P, t, u):
        ph = u * 2 * math.pi; s = math.sin(ph); c = math.cos(ph)
        A = 40 if run else 24; lean = 9 if run else 2
        P['pelvis'].location = (0, 0, 0); bob = (.025 if run else .014) * abs(math.cos(ph))
        P['pelvis'].location = (0, 0, 0)
        rot(P, 'pelvis', Z, 4 * s); rot(P, 'spine_01', X, -lean); rot(P, 'spine_03', Z, -6 * s)
        for side, sg in (('l', 1), ('r', -1)):
            sw = s * sg; rot(P, f'thigh_{side}', X, -A * sw)
            knee = max(0, -math.cos(ph + (0 if sg > 0 else math.pi))) * (75 if run else 45) + 6; rot(P, f'calf_{side}', X, knee)
            rot(P, f'foot_{side}', X, -A * .35 * sw - knee * .25)
            arm_side = 'l' if side == 'r' else 'r'
        for side, sg in (('l', -1), ('r', 1)):
            ax = .16 * (1 if side == 'l' else -1)
            aim(P, f'upperarm_{side}', (ax, -.1 * sg * s * (2.2 if run else 1) , -1)); rot(P, f'upperarm_{side}', X, (30 if run else 16) * sg * s)
            aim(P, f'lowerarm_{side}', (ax * .5, -(1.2 if run else .35) - .2 * sg * s, -1 if not run else -.4))
        curl(P, 'l', 25 if run else 18, 10); curl(P, 'r', 72, 30)
        rot(P, 'head', X, lean * .6)
    return p
def guard_stance(P, t, u):
    stand(P, t, arms=False)
    rot(P, 'thigh_l', Y, 5); rot(P, 'thigh_r', Y, -5); rot(P, 'foot_l', Y, -5); rot(P, 'foot_r', Y, 5)
    aim(P, 'upperarm_l', (.45, .25, -1)); aim(P, 'lowerarm_l', (-.35, -.6, -.3)); curl(P, 'l', 35, 15)          # 왼손은 무전기 파우치 위
    aim(P, 'upperarm_r', (-.4, .2, -1)); aim(P, 'lowerarm_r', (.3, -.7, -.35)); curl(P, 'r', 72, 30)
    rot(P, 'head', X, -4); rot(P, 'neck_01', Z, 8 * math.sin(t * 2 * math.pi / 5))
def flashlight_hold(P, t, u):
    stand(P, t, arms=False)
    sweep = 12 * math.sin(u * 2 * math.pi)
    aim(P, 'upperarm_r', (-.25, -.85, -.35)); aim(P, 'lowerarm_r', (-.05, -1, .05)); rot(P, 'upperarm_r', Z, sweep); curl(P, 'r', 72, 30)
    aim(P, 'upperarm_l', (.2, -.2, -1)); aim(P, 'lowerarm_l', (0, -.6, -.6)); curl(P, 'l', 25, 10)
    rot(P, 'spine_03', Z, sweep * .4); rot(P, 'head', Z, sweep * .6); rot(P, 'head', X, -3)
def radio_use(P, t, u):
    stand(P, t)
    k = min(1, u * 4) if u < .8 else max(0, (1 - u) * 5)
    aim(P, 'upperarm_l', (.35, -.6, -.75), k); aim(P, 'lowerarm_l', (-.75, -.35, .55), k); curl(P, 'l', 55, 25)
    rot(P, 'head', Y, -10 * k); rot(P, 'head', X, 6 * k)
def inspect(P, t, u):
    stand(P, t, arms=False)
    k = math.sin(min(1, u * 2.2) * math.pi / 2) if u < .75 else math.cos((u - .75) / .25 * math.pi / 2)
    rot(P, 'spine_01', X, 16 * k); rot(P, 'spine_02', X, 12 * k); rot(P, 'neck_01', X, 14 * k); rot(P, 'head', X, 12 * k)
    for s_, sg in (('l', 1), ('r', -1)): rot(P, f'thigh_{s_}', X, -22 * k); rot(P, f'calf_{s_}', X, 40 * k); rot(P, f'foot_{s_}', X, -18 * k)
    aim(P, 'upperarm_r', (-.2, -.7, -.7)); aim(P, 'lowerarm_r', (0, -.6, -.8)); curl(P, 'r', 72, 30)
    aim(P, 'upperarm_l', (.25, -.4, -.9)); aim(P, 'lowerarm_l', (.05, -.5, -.85)); curl(P, 'l', 30, 10)
def surprised(P, t, u):
    stand(P, t, arms=False)
    k = math.sin(min(1, u * 5) * math.pi / 2) * (1 - max(0, u - .6) / .4 * .6)
    rot(P, 'spine_02', X, -9 * k); rot(P, 'head', X, -10 * k); rot(P, 'clavicle_l', Y, -10 * k); rot(P, 'clavicle_r', Y, 10 * k)
    aim(P, 'upperarm_l', (.5, -.4, -.75)); aim(P, 'lowerarm_l', (.2, -.8, .2), k); aim(P, 'upperarm_r', (-.5, -.4, -.75)); aim(P, 'lowerarm_r', (-.2, -.8, .1), k)
    curl(P, 'l', 10, 0); curl(P, 'r', 72, 30)
def frightened(P, t, u):
    stand(P, t, arms=False); tr = math.sin(t * 2 * math.pi * 7) * 1.4
    rot(P, 'spine_01', X, 14); rot(P, 'spine_03', X, 8 + tr * .5); rot(P, 'head', X, 12); rot(P, 'neck_01', X, 6)
    for s_ in ('l', 'r'): rot(P, f'thigh_{s_}', X, -28); rot(P, f'calf_{s_}', X, 50); rot(P, f'foot_{s_}', X, -22)
    aim(P, 'upperarm_l', (.35, -.75, -.3)); aim(P, 'lowerarm_l', (-.6, -.3, .75)); aim(P, 'upperarm_r', (-.35, -.75, -.3)); aim(P, 'lowerarm_r', (.6, -.3, .75))
    rot(P, 'upperarm_l', X, tr); curl(P, 'l', 40, 15); curl(P, 'r', 72, 30)
def idle(P, t, u):
    stand(P, t); rot(P, 'head', Z, 5 * math.sin(u * 2 * math.pi)); rot(P, 'pelvis', Y, .8 * math.sin(u * 2 * math.pi))
CLIPS = [('Idle', 108, idle, True), ('Walk', 34, walk_pose(False), True), ('Run', 22, walk_pose(True), True), ('GuardStance', 150, guard_stance, True),
         ('FlashlightHold', 120, flashlight_hold, True), ('RadioUse', 90, radio_use, False), ('Inspect', 90, inspect, False), ('Surprised', 36, surprised, False), ('Frightened', 60, frightened, True)]
def build_all(arm):
    setup(arm); out = []
    for name, n, fn, loop in CLIPS: out.append((name, n, bake(arm, name, n, fn, loop)))
    arm.animation_data.action = bpy.data.actions['Idle']; reset(arm.pose.bones); bpy.ops.object.mode_set(mode='OBJECT')
    return out
