import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KEYBOARD_BUILDS, buildBrand, buildSchema, filterBuilds, findBuild } from './builds';
import { KEYBOARD_LAYOUTS } from '@/types/keyboard';
import { buildModelEntry } from './models';
import { topRowModuleCodes } from './layouts';
import { HARDWARE_CATALOG } from '@/lib/ai/hardwareCatalog';
import { createKeycapGeometry, getKeycapShape, keycapSurfaceY, DISH_DEPTH } from '@/components/canvas/geometry/keyboardGeometry';

describe('thư viện build mở rộng', () => {
  it('có 41 build, đủ mọi layout từ 60% tới full-size', () => {
    expect(KEYBOARD_BUILDS.length).toBe(41);
    const layouts = new Set(KEYBOARD_BUILDS.map((b) => b.look.layout));
    KEYBOARD_LAYOUTS.forEach((l) => expect(layouts.has(l)).toBe(true));
  });

  it('đợt 3: QK61 là 60%, Nut108 full-size mạch trắng, Stars75 S có dải đèn chéo 2 góc', () => {
    expect(findBuild('cidoo-qk61-v2')?.look.layout).toBe('60%');
    expect(findBuild('weikav-nut108')?.look).toMatchObject({ layout: '100%', pcbColor: '#ecebe6' });
    expect(findBuild('weikav-stars75s')?.look.shellStyle).toBe('stars-s');
    expect(buildBrand({ name: 'Weikav Nut75' })).toBe('Weikav');
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
  it('mọi build đều có màu switch thật, trừ các mẫu không nhìn thấy switch trong video', () => {
    const unseen = ['weikav-nut75', 'weikav-nut87', 'aula-nova75-pro', 'weikav-nut65', 'weikav-nut108', 'riccks-rs8', 'aula-l99', 'mchose-g75-v2', 'cidoo-qk75'];
    expect(KEYBOARD_BUILDS.filter((b) => !b.look.switchColors).map((b) => b.id).sort()).toEqual([...unseen].sort());
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

describe('thông số thật, không ghi mơ hồ', () => {
  it('không trường nào trong specs của 41 build còn ghi "theo máy", "theo laptop", "chưa rõ"', () => {
    const vague = /theo máy|theo laptop|chưa rõ/i;
    expect(KEYBOARD_BUILDS).toHaveLength(41);
    KEYBOARD_BUILDS.forEach((b) =>
      Object.entries(b.specs).forEach(([field, value]) => expect(`${b.id}.${field}: ${value}`).not.toMatch(vague))
    );
  });

  it('các trường từng ghi "Theo máy" nay là thông số cụ thể (vật liệu + profile keycap, mount, foam)', () => {
    expect(findBuild('aula-f99-asura')?.specs.keycap).toBe('PBT Double-shot, profile Cherry');
    expect(findBuild('leobog-hi75c-pro')?.specs.keycap).toMatch(/PBT.*profile/);
    expect(findBuild('nuphy-halo75-v2')?.specs.keycap).toMatch(/mSA/);
    expect(findBuild('keychron-k2-he-se')?.specs.foam).toMatch(/EVA/);
    expect(findBuild('riccks-rs8')?.specs.mount).toMatch(/Gasket/);
    ['lucky65-creamy-yellow', 'wobkey-crush80-pro', 'neo65'].forEach((id) => expect(findBuild(id)?.specs.keycap).toMatch(/profile/));
  });

  it('metadata gói tiếng (sources.json, index.json) cũng không còn "Switch theo máy"', () => {
    const sources = readFileSync(join(process.cwd(), 'scripts', 'sounds', 'sources.json'), 'utf8');
    const index = readFileSync(join(process.cwd(), 'public', 'sounds', 'index.json'), 'utf8');
    expect(sources).not.toMatch(/theo máy/i);
    expect(index).not.toMatch(/theo máy/i);
  });
});

describe('module phần cứng soi theo ảnh thật', () => {
  const kinds = (id: string) => findBuild(id)?.look.modules.map((m) => m.kind) ?? [];
  const moduleOf = (id: string, kind: string) => findBuild(id)?.look.modules.find((m) => m.kind === kind);

  it('AULA L99 dùng layout 75% + màn hình lớn 3u × 5 hàng (không phải màn mini 1u)', async () => {
    const { getLayout } = await import('./layouts');
    const { resolveModules } = await import('./modules');
    const l99 = findBuild('aula-l99');
    expect(l99?.look.layout).toBe('75%-screen');
    const screens = resolveModules({ layout: getLayout('75%-screen'), modules: l99?.look.modules }).filter((m) => m.kind === 'screen');
    expect(screens).toHaveLength(1);
    expect(screens[0]).toMatchObject({ size: 'large', ui: 'calculator', rect: { w: 3, h: 5 } });
  });

  it('màn hình nhỏ/trung đúng chỗ: S75 Pro + ND75 dọc cột phải, Nova75 Pro + Zoom75 2u sau F12', () => {
    expect(moduleOf('aula-s75-pro', 'screen')).toMatchObject({ size: 'mini', replaces: ['PageDown', 'End'] });
    expect(moduleOf('chilkey-nd75', 'screen')).toMatchObject({ size: 'mini', replaces: ['PageDown', 'End'] });
    expect(moduleOf('aula-nova75-pro', 'screen')).toMatchObject({ size: 'medium', replaces: ['PrintScreen', 'Delete'] });
    expect(moduleOf('zoom75-ee', 'screen')).toMatchObject({ size: 'medium' });
  });

  it('con lăn trụ nằm ngang ≠ núm xoay: Mercury K1, Nut75, G87 V2 dùng roller', () => {
    ['gravastar-mercury-k1', 'weikav-nut75', 'mchose-g87-v2'].forEach((id) => {
      expect(kinds(id)).toContain('roller');
      expect(kinds(id)).not.toContain('knob');
    });
    expect(moduleOf('weikav-nut75', 'roller')).toMatchObject({ replaces: ['End'] });
  });

  it('núm xoay tròn đúng mẫu, đúng kiểu; mẫu không núm thì không vẽ núm', () => {
    const withKnob = [
      'aula-f75-reaper', 'aula-f75-ice-vein', 'aula-f99-asura', 'leobog-hi75-vertex', 'leobog-hi75c-pro', 'attack-shark-x85',
      'keychron-q1-max', 'monsgeek-m1w-v3', 'leobog-hi8-se', 'aula-s75-pro', 'aula-nova75-pro', 'mchose-g75-v2', 'cidoo-qk75',
    ];
    expect(KEYBOARD_BUILDS.filter((b) => b.look.caseShape.knob).map((b) => b.id).sort()).toEqual([...withKnob].sort());
    expect(moduleOf('mchose-g75-v2', 'knob')).toMatchObject({ style: 'flat', replaces: ['End'] });
    expect(moduleOf('aula-nova75-pro', 'knob')).toMatchObject({ style: 'side' });
    expect(moduleOf('leobog-hi75c-pro', 'knob')).toMatchObject({ cap: '#1b1c1f' });
    ['lucky65-husky', 'wobkey-rainy75-pro', 'wobkey-crush80-pro', 'neo65', 'mode-envoy-pc'].forEach((id) =>
      expect(kinds(id)).not.toContain('knob')
    );
  });

  it('mọi module của mọi build đặt được trong layout của build (không trỏ tới phím không tồn tại)', async () => {
    const { getLayout } = await import('./layouts');
    const { resolveModules } = await import('./modules');
    KEYBOARD_BUILDS.forEach((b) => {
      const placed = resolveModules({ layout: getLayout(b.look.layout), modules: b.look.modules }).filter((m) => !m.fromLayout);
      expect(placed.length, b.id).toBe(b.look.modules.length);
    });
  });

  it('dáng vỏ đặc thù: K1 skeletal + OEM, K2 HE ốp gỗ, Halo75 đáy halo, Envoy PC mờ phát sáng', () => {
    expect(findBuild('gravastar-mercury-k1')?.look).toMatchObject({ shellStyle: 'skeletal', keycapProfile: 'oem' });
    expect(findBuild('keychron-k2-he-se')?.look.shellStyle).toBe('wood-accent');
    expect(findBuild('nuphy-halo75-v2')?.look.shellStyle).toBe('halo-rgb');
    expect(findBuild('mode-envoy-pc')?.look).toMatchObject({ shellStyle: 'frosted-pc', glowColor: '#2f6bff' });
  });

  it('phối màu keycap theo ảnh: gradient theo hàng, keycap trong, carbon forged, chữ cam', () => {
    expect(findBuild('monsgeek-m1w-v3')?.look.keycapRows).toHaveLength(6);
    expect(findBuild('weikav-nut108')?.look.keycapRows?.[3]).toBe('#a2242c');
    expect(findBuild('aula-nova75-pro')?.look.keycapFinish).toBe('translucent');
    expect(findBuild('weikav-nut65')?.look.keycapFinish).toBe('forged-carbon');
    expect(findBuild('cidoo-qk61-v2')?.look.jellyAccent).toBe(true);
    expect(findBuild('lucky65-creamy-yellow')?.look.legendColor).toBe('#f2a33a');
    expect(findBuild('leobog-hi75c-pro')?.look.accentKeys).toContain('Space');
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

  it('X85 dùng plate PC flex-cut (video tháo máy + ảnh cấu trúc chính hãng), không phải nhôm', () => {
    const x85 = findBuild('attack-shark-x85');
    expect(x85?.specs.plate).toBe('PC flex-cut');
    expect(x85?.look.plateMaterial).toBe('polycarbonate');
  });
});

describe('build không foam', () => {
  it('Neo65 và Mode Envoy (theo video) không vẽ lớp foam; build có foam thì vẽ', async () => {
    const { hasNoFoam } = await import('@/components/canvas/KeyboardModel');
    expect(hasNoFoam(findBuild('neo65'))).toBe(true);
    expect(hasNoFoam(findBuild('mode-envoy-pc'))).toBe(true);
    expect(hasNoFoam(findBuild('wobkey-rainy75-pro'))).toBe(false);
    expect(hasNoFoam(undefined)).toBe(false);
    // Nạp KeyboardModel (three + drei) lần đầu có thể mất vài giây khi cả bộ test chạy song song
  }, 30_000);
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
    expect(createKeycapGeometry(1, 3, 'oem')).not.toBe(createKeycapGeometry(1, 3, 'cherry'));
  });

  it('OEM: cùng kiểu điêu khắc theo hàng như Cherry nhưng cao hơn', () => {
    expect(getKeycapShape(1, 1, 'oem').height).toBeGreaterThan(getKeycapShape(1, 1, 'cherry').height * 1.1);
    expect(getKeycapShape(1, 3, 'oem').dish).toBe('cylindrical');
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
