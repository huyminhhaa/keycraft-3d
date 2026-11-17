import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KEYBOARD_BUILDS, findBuild } from './builds';
import { LAYOUTS, knobKeyCode } from './layouts';
import { useKeyboardStore, INITIAL_KEYBOARD_STATE } from '@/store/useKeyboardStore';
import { layerDetails } from '@/components/canvas/KeyboardModel';
import { DEFAULT_CASE_SHAPE } from '@/types/keyboard';

describe('danh mục build phím thật', () => {
  it('mỗi build trỏ tới một video trong danh sách nguồn của npm run sounds', () => {
    const sources = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'sounds', 'sources.json'), 'utf8')) as { id: string }[];
    const ids = new Set(sources.map((s) => s.id));
    KEYBOARD_BUILDS.forEach((build) => expect(ids.has(build.soundPackId)).toBe(true));
  });

  it('id lạ hoặc null không tìm thấy build', () => {
    expect(findBuild('khong-co')).toBeUndefined();
    expect(findBuild(null)).toBeUndefined();
  });
});

describe('applyBuild', () => {
  beforeEach(() => useKeyboardStore.getState().resetConfig());

  it('đổi layout, màu, chất liệu, dáng vỏ theo build và tắt LED hông', () => {
    useKeyboardStore.getState().applyBuild('aula-f99-asura');
    const state = useKeyboardStore.getState();
    const build = findBuild('aula-f99-asura')!;
    expect(state).toMatchObject({
      buildId: 'aula-f99-asura',
      layout: '96%',
      caseMaterial: 'plastic',
      caseColor: build.look.caseColor,
      plateMaterial: 'polycarbonate',
      caseShape: build.look.caseShape,
      underglowEnabled: false,
    });
  });

  it('đặt lại cấu hình thì bỏ build, về dáng vỏ mặc định', () => {
    useKeyboardStore.getState().applyBuild('lucky65-husky');
    useKeyboardStore.getState().resetConfig();
    expect(useKeyboardStore.getState()).toMatchObject({ buildId: null, caseShape: DEFAULT_CASE_SHAPE });
    expect(INITIAL_KEYBOARD_STATE.buildId).toBeNull();
  });

  it('id không có thì không đổi gì', () => {
    useKeyboardStore.getState().applyBuild('khong-co');
    expect(useKeyboardStore.getState().buildId).toBeNull();
  });
});

describe('layout 96% và núm xoay', () => {
  it('96% rộng 19u, mọi hàng đủ phím, không trùng mã phím', () => {
    const layout = LAYOUTS['96%'];
    expect(layout.width).toBe(19);
    const codes = layout.keys.map((k) => k.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(['Numpad0', 'NumpadEnter', 'ArrowUp', 'Space']));
  });

  it('núm xoay thay phím ngoài cùng bên phải hàng trên', () => {
    expect(knobKeyCode('75%')).toBe('Delete');
    expect(knobKeyCode('96%')).toBe('PrintScreen');
  });
});

describe('layerDetails', () => {
  const build = findBuild('aula-f75-reaper')!;

  it('build thật: chú thích đúng linh kiện thật', () => {
    expect(layerDetails(build, 'polycarbonate', 'linear')).toMatchObject({
      plate: build.specs.plate,
      switches: 'Leobog Reaper (linear)',
      foam: build.specs.foam,
      topCase: 'Gasket mount',
    });
  });

  it('đổi plate/switch khác build thì ghi theo lựa chọn mới', () => {
    expect(layerDetails(build, 'aluminum', 'clicky')).toMatchObject({ plate: 'ALUMINUM', switches: 'clicky' });
  });

  it('không có build: chú thích mặc định', () => {
    expect(layerDetails(undefined, 'fr4', 'silent_linear')).toMatchObject({ bottomCase: 'Tạ đồng', plate: 'FR4', switches: 'silent linear' });
  });
});

describe('playDemo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('nhấn rồi nhả lần lượt từng phím, huỷ được giữa chừng', async () => {
    const { playDemo } = await import('@/components/ui/BuildsPanel');
    const { isKeyPressed } = await import('@/lib/keyboard/pressedKeys');
    const stop = playDemo(['KeyA', 'KeyB']);
    vi.advanceTimersByTime(10);
    expect(isKeyPressed('KeyA')).toBe(true);
    vi.advanceTimersByTime(100);
    expect(isKeyPressed('KeyA')).toBe(false);
    stop();
    vi.advanceTimersByTime(1000);
    expect(isKeyPressed('KeyB')).toBe(false);
  });
});
