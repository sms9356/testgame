# R02-01 학생용 책상 · R02-02 학생용 의자 · R02-03 교탁 — Blender Z-up 에서 만들고 glTF Y-up 으로 낸다.
# 게임 방향: 학생은 +Z(glTF) 쪽에서 칠판(-Z)을 본다 = Blender 의 -Y 쪽이 학생 쪽
import sys, os, math; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
OUT = os.path.join(lib.B, 'out')
which = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['R02-01', 'R02-02', 'R02-03']
STEEL_UV = 0.5
def mats():
    return (lib.pbr('V4_wood_worn', 'wood_table_worn'), lib.pbr('V4_steel_dusty', 'rusty_metal_02'), lib.flat('V4_rubber', (0.025, 0.025, 0.025), 0.85))
if 'R02-01' in which:   # 학생용 책상 650 x 450 x 730
    lib.reset(); lib.parts.clear(); WOOD, STEEL, RUB = mats(); box, cyl = lib.box, lib.cyl
    W, D, H, T, LEG, TB = 0.65, 0.45, 0.73, 0.018, 0.025, 0.02
    box('top', W, D, T, 0, 0, H - T / 2, WOOD, bevel=0.004, uvs=1.2)
    zf = H - T - TB / 2
    for s in (-1, 1):
        box(f'apron_x{s}', W - 0.04, TB, TB, 0, s * (D / 2 - 0.03), zf, STEEL, bevel=0.002)
        box(f'apron_y{s}', TB, D - 0.06, TB, s * (W / 2 - 0.03), 0, zf, STEEL, bevel=0.002)
    lh = zf - 0.012
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (W / 2 - 0.03), sy * (D / 2 - 0.03)
            box(f'leg{sx}{sy}', LEG, LEG, lh, x, y, 0.012 + lh / 2, STEEL, bevel=0.002); box(f'glide{sx}{sy}', LEG + 0.006, LEG + 0.006, 0.012, x, y, 0.006, RUB, bevel=0.002)
        box(f'str_side{sx}', TB, D - 0.06, TB, sx * (W / 2 - 0.03), 0, 0.16, STEEL, bevel=0.002)
    box('str_back', W - 0.06, TB, TB, 0, D / 2 - 0.03, 0.42, STEEL, bevel=0.002)
    ts, tz = 0.0015, zf - 0.12
    box('shelf', W - 0.08, D - 0.12, ts, 0, 0.02, tz, STEEL); box('shelf_back', W - 0.08, ts, 0.10, 0, D / 2 - 0.04, tz + 0.05, STEEL)
    for sx in (-1, 1):
        box(f'shelf_side{sx}', ts, D - 0.12, 0.10, sx * (W / 2 - 0.04), 0.02, tz + 0.05, STEEL)
        lib.tube(f'hook_arm{sx}', 0.004, (sx * (W / 2 - 0.02), -0.10, zf - 0.03), (sx * (W / 2 + 0.025), -0.10, zf - 0.03), STEEL)
        lib.tube(f'hook_tip{sx}', 0.004, (sx * (W / 2 + 0.025), -0.10, zf - 0.03), (sx * (W / 2 + 0.025), -0.10, zf - 0.005), STEEL)
        for yy in (-0.12, 0.12): cyl(f'bolt{sx}{yy}', 0.005, 0.004, sx * (W / 2 - 0.0185), yy, zf, STEEL, rot=(0, math.pi / 2, 0), v=12)
    for sy in (-1, 1):
        for xx in (-0.2, 0.2): cyl(f'bolty{sy}{xx}', 0.005, 0.004, xx, sy * (D / 2 - 0.0185), zf, STEEL, rot=(math.pi / 2, 0, 0), v=12)
    lib.finish('R02-01_StudentDesk', os.path.join(OUT, 'R02-01'))
if 'R02-02' in which:   # 학생용 의자 440 x 470 x 820 — 합판 좌판 · 등판, 둥근 철관 다리, 고무 발, 리벳
    lib.reset(); lib.parts.clear(); WOOD, STEEL, RUB = mats(); box, tube = lib.box, lib.tube
    R = 0.011; SH = 0.43; xs = 0.205
    box('seat', 0.42, 0.40, 0.012, 0, 0.0, SH, WOOD, bevel=0.004, uvs=1.5)
    # 등판: 학생 등 쪽(-Y), 8° 뒤로 눕힘
    box('back', 0.42, 0.012, 0.17, 0, -0.215, 0.735, WOOD, bevel=0.004, uvs=1.5, rot=(math.radians(-8), 0, 0))
    for sx in (-1, 1):
        x = sx * xs
        tube(f'leg_front{sx}', R, (x, 0.2, 0.012), (x, 0.18, SH - 0.008), STEEL)
        tube(f'leg_rear_low{sx}', R, (x, -0.2, 0.012), (x, -0.18, SH - 0.008), STEEL)
        tube(f'leg_rear_up{sx}', R, (x, -0.18, SH - 0.008), (x, -0.235, 0.82), STEEL)   # 뒷다리는 등판까지 이어진다
        tube(f'rail_seat{sx}', R * 0.9, (x, 0.18, SH - 0.014), (x, -0.18, SH - 0.014), STEEL)
        tube(f'stretcher{sx}', R * 0.8, (x, 0.196, 0.14), (x, -0.196, 0.14), STEEL)
        lib.box(f'foot_f{sx}', 0.026, 0.026, 0.014, x, 0.2, 0.007, RUB, bevel=0.003)
        lib.box(f'foot_r{sx}', 0.026, 0.026, 0.014, x, -0.2, 0.007, RUB, bevel=0.003)
        for zz in (0.68, 0.79): lib.cyl(f'rivet{sx}{zz}', 0.006, 0.006, x * 0.94, -0.2 - (zz - 0.68) * 0.14, zz, STEEL, rot=(math.radians(90 - 8), 0, 0), v=10)
    tube('stretcher_front', R * 0.8, (-xs, 0.196, 0.14), (xs, 0.196, 0.14), STEEL)
    lib.finish('R02-02_StudentChair', os.path.join(OUT, 'R02-02'))
if 'R02-03' in which:   # 교탁 1200 x 600 x 850 — 학생 쪽(-Y)은 막힌 앞판, 교사 쪽(+Y)은 열린 수납, 목재 상판
    lib.reset(); lib.parts.clear(); WOOD, STEEL, RUB = mats(); box = lib.box
    W, D, H, t = 1.2, 0.6, 0.82, 0.02
    box('top', W, D, 0.03, 0, 0, H - 0.015, WOOD, bevel=0.005, uvs=1.0)
    box('top_lip', W, 0.03, 0.03, 0, D / 2 - 0.015, H + 0.015, WOOD, bevel=0.004)   # 교사 쪽 책 받침 턱
    box('front', W - 0.02, t, H - 0.09, 0, -D / 2 + 0.03, 0.06 + (H - 0.09) / 2, STEEL, bevel=0.002, uvs=1.0)
    for sx in (-1, 1): box(f'side{sx}', t, D - 0.04, H - 0.09, sx * (W / 2 - 0.02), 0, 0.06 + (H - 0.09) / 2, STEEL, bevel=0.002)
    box('bottom', W - 0.06, D - 0.06, t, 0, 0, 0.07, STEEL); box('shelf', W - 0.06, D - 0.12, t, 0, 0.02, 0.45, STEEL)
    box('divider', t, D - 0.12, 0.36, 0.0, 0.02, 0.26, STEEL)
    box('plinth', W - 0.04, D - 0.06, 0.06, 0, 0.0, 0.03, lib.flat('V4_plinth', (0.06, 0.06, 0.065), 0.7, 0.3), bevel=0.003)
    for k in (-0.3, 0.0, 0.3): box(f'seam{k}', 0.004, 0.003, H - 0.14, k, -D / 2 + 0.019, 0.06 + (H - 0.09) / 2, STEEL)   # 앞판 접합 줄눈
    box('nameplate', 0.22, 0.004, 0.06, 0, -D / 2 + 0.018, 0.67, lib.flat('V4_brass', (0.55, 0.42, 0.18), 0.35, 0.9), bevel=0.002)
    for sx in (-1, 1):
        for sy in (-1, 1): box(f'foot{sx}{sy}', 0.04, 0.04, 0.008, sx * (W / 2 - 0.05), sy * (D / 2 - 0.05), 0.004, RUB)
    lib.finish('R02-03_TeacherPodium', os.path.join(OUT, 'R02-03'))
