import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KEYBOARD_BUILDS, buildSchema, filterBuilds, findBuild } from './builds';
import { buildModelEntry } from './models';
import { topRowModuleCodes } from './layouts';
import { HARDWARE_CATALOG } from '@/lib/ai/hardwareCatalog';
import { createKeycapGeometry, getKeycapShape, keycapSurfaceY, DISH_DEPTH } from '@/components/canvas/geometry/keyboardGeometry';

describe('thư viện build mở rộng', () => {
  it('có ít nhất 20 build, đủ layout 65%, 75%, TKL, 96%', () => {
    expect(KEYBOARD_BUILDS.length).toBeGreaterThanOrEqual(20);
    const layouts = new Set(KEYBOARD_BUILDS.map((b) => b.look.layout));
    ['65%', '75%', 'TKL', '96%'].forEach((l) => expect(layouts.has(l as '65%')).toBe(true));
  });

  it('mỗi build có gói tiếng và ảnh thật trong public/', () => {
    KEYBOARD_BUILDS.forEach((build) => {
      expect(existsSync(join(process.cwd(), 'public', 'sounds', build.soundPackId, 'pack.json'))).toBe(true);
      expect(existsSync(join(process.cwd(), 'public', 'builds', `${build.id}.jpg`))).toBe(true);
    });
  });

  it('gói tiếng của các build mới đều sạch (noise ≤ 0.02)', () => {
    const fresh = KEYBOARD_BUILDS.slice(9);
    fresh.forEach((build) => {
      const pack = JSON.parse(readFileSync(join(process.cwd(), 'public', 'sounds', build.soundPackId, 'pack.json'), 'utf8')) as {
        noise: number;
      };
      expect(pack.noise).toBeLessThanOrEqual(0.02);
    });
  });

  it('shellStyle và keycapProfile có mặc định khi không khai báo', () => {
    const rainy = findBuild('wobkey-rainy75-pro');
    expect(rainy?.look.shellStyle).toBe('default');
    expect(rainy?.look.keycapProfile).toBe('cherry');
    expect(findBuild('leobog-hi75-vertex')?.look.keycapProfile).toBe('moa');
  });

  it('modelUrl chỉ nhận file .glb trong /models/', () => {
    const base = KEYBOARD_BUILDS[0];
    expect(buildSchema.safeParse({ ...base, modelUrl: '/models/aula-f75.glb' }).success).toBe(true);
    expect(buildSchema.safeParse({ ...base, modelUrl: 'https://example.com/a.glb' }).success).toBe(false);
  });
});

describe('màu switch thật', () => {
  it('mọi build đều có màu switch thật (Cocoa vỏ kem stem nâu, Ice Vein xanh ngọc stem trắng…)', () => {
    expect(KEYBOARD_BUILDS.every((b) => b.look.switchColors)).toBe(true);
    expect(findBuild('wobkey-rainy75-pro')?.look.switchColors).toMatchObject({ stem: '#6b3a24' });
    expect(findBuild('aula-f75-ice-vein')?.look.switchColors).toMatchObject({ stem: '#f3f5f5' });
  });

  it('đổi build thì đổi màu switch; đặt lại cấu hình thì về màu mặc định', async () => {
    const { useKeyboardStore } = await import('@/store/useKeyboardStore');
    useKeyboardStore.getState().applyBuild('neo65');
    expect(useKeyboardStore.getState().switchColors?.bottom).toBe('#d9762e');
    useKeyboardStore.getState().applyBuild('aula-f75-ice-vein');
    expect(useKeyboardStore.getState().switchColors?.bottom).toBe('#8acfc6');
    useKeyboardStore.getState().resetConfig();
    expect(useKeyboardStore.getState().switchColors).toBeUndefined();
  });

  it('thông số không còn ghi chú lấp lửng (chưa xác minh, có nguồn ghi, tuỳ bản…)', () => {
    const hedges = /chưa xác minh|có nguồn ghi|tuỳ bản|theo video|theo bản|dựng bằng|không ghi/i;
    KEYBOARD_BUILDS.forEach((b) => Object.values(b.specs).forEach((value) => expect(value).not.toMatch(hedges)));
  });
});

describe('màu PCB và foam thật', () => {
  it('AULA F75 mạch trắng foam trắng, Hi75 mạch đen Poron đen, Bridge75 foam be, Envoy mạch trắng', () => {
    expect(findBuild('aula-f75-reaper')?.look).toMatchObject({ pcbColor: '#ecebe6', foamColor: '#e9e8e2' });
    expect(findBuild('leobog-hi75-vertex')?.look).toMatchObject({ pcbColor: '#1b1c1f', foamColor: '#222326' });
    expect(findBuild('bridge75-plus')?.look.foamColor).toBe('#cdb48c');
    expect(findBuild('mode-envoy-pc')?.look.pcbColor).toBe('#ecebe6');
  });

  it('đợt 2: Neo65 mạch trắng, K2 HE mạch đen, X85 foam trắng, Hi75C foam đen', () => {
    expect(findBuild('neo65')?.look.pcbColor).toBe('#ecebe6');
    expect(findBuild('keychron-k2-he-se')?.look.pcbColor).toBe('#1b1c1f');
    expect(findBuild('attack-shark-x85')?.look.foamColor).toBe('#e9e8e2');
    expect(findBuild('leobog-hi75c-pro')?.look.foamColor).toBe('#222326');
  });

  it('chỗ chưa thấy tận mắt thì để trống (dùng màu mặc định)', () => {
    expect(findBuild('attack-shark-x85')?.look.pcbColor).toBeUndefined();
    expect(findBuild('nuphy-halo75-v2')?.look.pcbColor).toBeUndefined();
    expect(findBuild('nuphy-halo75-v2')?.look.foamColor).toBeUndefined();
  });

  it('Hi75 dùng plate PP như trong video tháo máy', () => {
    expect(findBuild('leobog-hi75-vertex')?.specs.plate).toBe('PP');
  });
});

describe('build không foam', () => {
  it('Neo65 và Mode Envoy (theo video) không vẽ lớp foam; build có foam thì vẽ', async () => {
    const { hasNoFoam } = await import('@/components/canvas/KeyboardModel');
    expect(hasNoFoam(findBuild('neo65'))).toBe(true);
    expect(hasNoFoam(findBuild('mode-envoy-pc'))).toBe(true);
    expect(hasNoFoam(findBuild('wobkey-rainy75-pro'))).toBe(false);
    expect(hasNoFoam(undefined)).toBe(false);
  });
});

describe('build có file .glb thật', () => {
  it('chỉ tạo mẫu .glb khi build có modelUrl, giữ nguyên màu của file', () => {
    const build = KEYBOARD_BUILDS[0];
    expect(buildModelEntry(build)).toBeNull();
    expect(buildModelEntry({ ...build, modelUrl: '/models/aula-f75.glb' })).toMatchObject({
      source: 'glb',
      url: '/models/aula-f75.glb',
      layout: '75%',
      recolor: false,
    });
  });
});

describe('filterBuilds', () => {
  it('lọc theo layout', () => {
    const tkl = filterBuilds(KEYBOARD_BUILDS, 'TKL', '');
    expect(tkl.length).toBeGreaterThan(0);
    tkl.forEach((b) => expect(b.look.layout).toBe('TKL'));
  });

  it('tìm theo tên switch, không phân biệt hoa thường, nhiều từ phải khớp hết', () => {
    const cocoa = filterBuilds(KEYBOARD_BUILDS, 'all', 'cocoa');
    expect(cocoa.map((b) => b.id).sort()).toEqual(['wobkey-crush80-pro', 'wobkey-rainy75-pro']);
    expect(filterBuilds(KEYBOARD_BUILDS, 'all', 'cocoa tkl')).toHaveLength(0);
    expect(filterBuilds(KEYBOARD_BUILDS, '65%', 'LUCKY65').length).toBe(3);
  });
});

describe('module góc phải hàng trên', () => {
  it('LCD 2U chiếm 2 phím ngoài cùng bên phải, núm xoay chiếm 1', () => {
    expect(topRowModuleCodes('75%', 2)).toEqual(['Delete', 'PrintScreen']);
    expect(topRowModuleCodes('75%', 1)).toEqual(['Delete']);
  });
});

describe('keycap MOA', () => {
  it('mọi hàng cao như nhau và không nghiêng', () => {
    const r1 = getKeycapShape(1, 1, 'moa');
    const r4 = getKeycapShape(1, 4, 'moa');
    expect(r1.height).toBe(r4.height);
    expect(r1.tilt).toBe(0);
  });

  it('lòng chảo cầu: mép trước/sau cao hơn tâm (khác Cherry chỉ lõm theo chiều ngang)', () => {
    const moa = getKeycapShape(1, 3, 'moa');
    const cherry = getKeycapShape(1, 3);
    const edgeZ = moa.topDepth / 2;
    expect(keycapSurfaceY(moa, 0, edgeZ) - keycapSurfaceY(moa, 0, 0)).toBeCloseTo(DISH_DEPTH, 6);
    expect(keycapSurfaceY(cherry, 0, cherry.topDepth / 2)).toBeCloseTo(keycapSurfaceY(cherry, 0, 0), 6);
  });

  it('cache tách riêng theo profile', () => {
    expect(createKeycapGeometry(1, 3, 'moa')).not.toBe(createKeycapGeometry(1, 3, 'cherry'));
  });
});

describe('danh mục linh kiện cho trợ lý AI', () => {
  it('id không trùng và có các switch/plate của thư viện build mới', () => {
    const ids = HARDWARE_CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    ['switch-kailh-cocoa', 'switch-hmx-violet', 'switch-gateron-jupiter-banana', 'plate-pp'].forEach((id) =>
      expect(ids).toContain(id)
    );
  });
});
