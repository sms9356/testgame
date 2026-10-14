"""Haegyo UE5 설정 스크립트 (Unreal Editor Python) — 포팅 가이드 Phase B + Phase C 블록아웃.

언리얼 에디터에서 실행:
  1) Edit > Plugins 에서 'Python Editor Script Plugin' · 'Editor Scripting Utilities' 활성화 후 재시작
  2) Tools > Execute Python Script... 로 이 파일 실행 (또는 출력 로그 Python 콘솔: py "<경로>/haegyo_setup.py")
하는 일:
  - <프로젝트>/Textures/<id>/T_<id>_{BC,N_DX,ORM} 를 /Game/Haegyo/Textures/<id> 로 임포트하고 색공간 · 압축 지정
  - 마스터 머티리얼 /Game/Haegyo/Materials/Masters/M_HaegyoPBR (BC · Normal · ORM · Tiling) 생성
  - 재질마다 /Game/Haegyo/Materials/Instances/MI_<id> 생성 (materials.json 의 반복 UV)
  - Data/haegyo_layout.json 으로 1층 복도 + 교무실 파일럿 블록아웃(벽 · 바닥 · 문 · 열쇠 표식 · 조명)을 현재 레벨에 배치
주의: 이 스크립트는 웹 게임 저장소에서 작성되었고 언리얼 에디터에서 실행 검증되지 않았다. 처음 실행 시 출력 로그를 확인할 것.
"""
import json, os
import unreal

PROJ = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
TEX_DIR = os.path.join(PROJ, 'Textures')
LAYOUT = os.path.join(PROJ, 'Data', 'haegyo_layout.json')
MATS_JSON = os.path.join(PROJ, 'SourceTextures', 'materials.json')
GAME_TEX = '/Game/Haegyo/Textures'
MASTER = '/Game/Haegyo/Materials/Masters/M_HaegyoPBR'
MI_DIR = '/Game/Haegyo/Materials/Instances'
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
MEL = unreal.MaterialEditingLibrary
EAL = unreal.EditorAssetLibrary


def import_textures():
    tasks = []
    for mid in sorted(os.listdir(TEX_DIR)):
        for f in sorted(os.listdir(os.path.join(TEX_DIR, mid))):
            t = unreal.AssetImportTask()
            t.filename = os.path.join(TEX_DIR, mid, f); t.destination_path = f'{GAME_TEX}/{mid}'
            t.automated = True; t.replace_existing = True; t.save = True
            tasks.append(t)
    asset_tools.import_asset_tasks(tasks)
    for mid in os.listdir(TEX_DIR):
        for suffix, srgb, comp in (('BC', True, unreal.TextureCompressionSettings.TC_DEFAULT),
                                   ('N_DX', False, unreal.TextureCompressionSettings.TC_NORMALMAP),
                                   ('ORM', False, unreal.TextureCompressionSettings.TC_MASKS)):
            path = f'{GAME_TEX}/{mid}/T_{mid}_{suffix}'
            tex = EAL.load_asset(path)
            if not tex:
                unreal.log_warning(f'[haegyo] missing {path}'); continue
            tex.set_editor_property('srgb', srgb)
            tex.set_editor_property('compression_settings', comp)
            if suffix == 'N_DX':
                tex.set_editor_property('flip_green_channel', False)   # 이미 DirectX 로 변환됨 — 다시 뒤집지 않는다
            EAL.save_asset(path)
    unreal.log('[haegyo] textures imported')


def make_master():
    if EAL.does_asset_exist(MASTER):
        return EAL.load_asset(MASTER)
    pkg, name = MASTER.rsplit('/', 1)
    mat = asset_tools.create_asset(name, pkg, unreal.Material, unreal.MaterialFactoryNew())
    tc = MEL.create_material_expression(mat, unreal.MaterialExpressionTextureCoordinate, -900, 0)
    til = MEL.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, -900, 120)
    til.set_editor_property('parameter_name', 'Tiling'); til.set_editor_property('default_value', 1.0)
    mul = MEL.create_material_expression(mat, unreal.MaterialExpressionMultiply, -700, 40)
    MEL.connect_material_expressions(tc, '', mul, 'A'); MEL.connect_material_expressions(til, '', mul, 'B')

    def sampler(pname, y, stype, suf):
        s = MEL.create_material_expression(mat, unreal.MaterialExpressionTextureSampleParameter2D, -450, y)
        s.set_editor_property('parameter_name', pname); s.set_editor_property('sampler_type', stype)
        # 샘플러 종류와 맞는 기본 텍스처 (색공간이 다르면 머티리얼 컴파일 오류가 난다)
        s.set_editor_property('texture', EAL.load_asset(f'{GAME_TEX}/corridor_peeling_wall/T_corridor_peeling_wall_{suf}'))
        MEL.connect_material_expressions(mul, '', s, 'UVs')
        return s
    bc = sampler('BaseColor', -300, unreal.MaterialSamplerType.SAMPLERTYPE_COLOR, 'BC')
    nm = sampler('Normal', 0, unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL, 'N_DX')
    orm = sampler('ORM', 300, unreal.MaterialSamplerType.SAMPLERTYPE_MASKS, 'ORM')
    MEL.connect_material_property(bc, 'RGB', unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(nm, 'RGB', unreal.MaterialProperty.MP_NORMAL)
    MEL.connect_material_property(orm, 'R', unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)
    MEL.connect_material_property(orm, 'G', unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.connect_material_property(orm, 'B', unreal.MaterialProperty.MP_METALLIC)
    MEL.recompile_material(mat); EAL.save_asset(MASTER)
    unreal.log('[haegyo] master material created')
    return mat


def make_instances(master):
    reps = {m['id']: m.get('repeat', [1, 1])[0] for m in json.load(open(MATS_JSON, encoding='utf-8'))}
    out = {}
    for mid in sorted(os.listdir(TEX_DIR)):
        path = f'{MI_DIR}/MI_{mid}'
        mi = EAL.load_asset(path) if EAL.does_asset_exist(path) else asset_tools.create_asset(f'MI_{mid}', MI_DIR, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
        MEL.set_material_instance_parent(mi, master)
        for p, suf in (('BaseColor', 'BC'), ('Normal', 'N_DX'), ('ORM', 'ORM')):
            MEL.set_material_instance_texture_parameter_value(mi, p, EAL.load_asset(f'{GAME_TEX}/{mid}/T_{mid}_{suf}'))
        MEL.set_material_instance_scalar_parameter_value(mi, 'Tiling', float(reps.get(mid, 2)))
        EAL.save_asset(path); out[mid] = mi
    unreal.log(f'[haegyo] {len(out)} material instances')
    return out


# 좌표 규약 (포팅 가이드 4장): UE_X = -100·Z, UE_Y = 100·X, UE_Z = 100·Y  (cm)
def ue(x, y, z):
    return unreal.Vector(-100.0 * z, 100.0 * x, 100.0 * y)


def spawn_box(label, x1, x2, z1, z2, y0, h, mat, folder):
    cube = EAL.load_asset('/Engine/BasicShapes/Cube')
    a = unreal.EditorLevelLibrary.spawn_actor_from_object(cube, ue((x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2))
    a.set_actor_scale3d(unreal.Vector(abs(z2 - z1), abs(x2 - x1), h))   # 큐브 100cm: X↔z 폭, Y↔x 폭
    a.set_actor_label(label); a.set_folder_path(folder)
    if mat:
        a.static_mesh_component.set_material(0, mat)
    return a


def blockout(mis, x_range=(-14.0, 14.0)):
    """1층 중앙(교무실 · 중앙계단 · 1-1 주변) 파일럿. x_range 를 넓히면 층 전체도 가능."""
    L = json.load(open(LAYOUT, encoding='utf-8'))
    F0 = next(f for f in L['floors'] if f['f'] == 0)
    CH = L['constants']['CH']; folder = 'Haegyo/Pilot_1F'
    wall_mi = mis.get('corridor_peeling_wall'); floor_mi = mis.get('ph_old_mosaic_floor') or mis.get('terrazzo_dirty_floor')
    n = 0
    for w in F0['walls']:
        cx = (w['x1'] + w['x2']) / 2
        if not (x_range[0] <= cx <= x_range[1]) or not (-10 <= (w['z1'] + w['z2']) / 2 <= 10):
            continue
        spawn_box(f'Wall_{n}', w['x1'], w['x2'], w['z1'], w['z2'], 0, CH, wall_mi, folder); n += 1
    spawn_box('Floor_1F', x_range[0], x_range[1], -9.9, 9.9, -.1, .1, floor_mi, folder)
    for d in L['doors']:
        if d['floor'] == 0 and x_range[0] <= d['x'] <= x_range[1]:
            r = d['rect']; a = spawn_box(f"Door_{d['name']}_{d['x']}", r['x1'], r['x2'], r['z1'], r['z2'], 0, 2.3, mis.get('painted_rust_metal'), folder)
            a.tags = [unreal.Name('HaegyoDoor'), unreal.Name(d['kind'])]
    for k in L['keys']:
        if k['f'] == 0:
            sph = EAL.load_asset('/Engine/BasicShapes/Sphere')
            a = unreal.EditorLevelLibrary.spawn_actor_from_object(sph, ue(k['x'], .9, k['z'])); a.set_actor_scale3d(unreal.Vector(.2, .2, .2))
            a.set_actor_label(f"Key_{k['name']}"); a.set_folder_path(folder); a.tags = [unreal.Name('HaegyoKey')]
    for l in F0['lamps']:
        if x_range[0] <= l['x'] <= x_range[1] and l['kind'] != 'dead':
            lt = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.PointLight, ue(l['x'], CH - .15, l['z']))
            lt.point_light_component.set_editor_property('intensity', 1800.0 if l['kind'] == 'on' else 700.0)
            lt.point_light_component.set_editor_property('light_color', unreal.Color(255, 244, 228, 255))
            lt.point_light_component.set_editor_property('attenuation_radius', 800.0)
            lt.set_actor_label(f"Lamp_{l['x']}_{l['z']}"); lt.set_folder_path(folder)
    unreal.log(f'[haegyo] pilot blockout: {n} walls')


def main():
    import_textures()
    mis = make_instances(make_master())
    if os.path.exists(LAYOUT):
        blockout(mis)
    else:
        unreal.log_warning('[haegyo] Data/haegyo_layout.json 이 없어 블록아웃을 건너뜀')


main()
