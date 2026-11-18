import { describe, it, expect } from 'vitest';
import { getLayout } from './layouts';
import { moduleFootprint, moduleSchema, rectOfKeys, replacedKeyCodes, resolveModules } from './modules';

describe('modules: đặt module phần cứng vào lưới phím', () => {
  it('khung bao các phím bị thay chỗ (màn mini dọc PgDn + End của 75%)', () => {
    expect(rectOfKeys(getLayout('75%'), ['PageDown', 'End'])).toEqual({ x: 15, y: 3.25, w: 1, h: 2 });
    expect(rectOfKeys(getLayout('75%'), ['KhongCo'])).toBeNull();
  });

  it('module thay phím: bỏ đúng các phím đó khỏi keycap/switch', () => {
    const modules = resolveModules({
      layout: getLayout('75%'),
      modules: [
        { kind: 'knob', replaces: ['Delete'], style: 'knurled' },
        { kind: 'screen', replaces: ['PageDown', 'End'], size: 'mini', ui: 'status' },
      ],
    });
    expect([...replacedKeyCodes(modules)].sort()).toEqual(['Delete', 'End', 'PageDown']);
    expect(modules.every((m) => m.mount === 'plate')).toBe(true);
  });

  it('module nằm ngoài vùng phím (badge viền trên, núm hông) gắn trên mặt vỏ', () => {
    const [badge, knob] = resolveModules({
      layout: getLayout('75%'),
      modules: [
        { kind: 'badge', at: { x: 14.8, y: -0.4, w: 0.9, h: 0.3 }, finish: 'gold' },
        { kind: 'knob', at: { x: 16.1, y: 0, w: 0.6, h: 1 }, style: 'side' },
      ],
    });
    expect(badge.mount).toBe('case');
    expect(knob.mount).toBe('case');
  });

  it('layout 75%-screen luôn có màn hình lớn 3u × 5 hàng (AULA L99) dù build không khai báo', () => {
    const [screen] = resolveModules({ layout: getLayout('75%-screen') });
    expect(screen).toMatchObject({ kind: 'screen', size: 'large', fromLayout: true, rect: { x: 16.25, y: 1.25, w: 3, h: 5 } });
    expect(getLayout('75%-screen').width).toBe(19.25);
  });

  it('mẫu tự phối / build đã lưu kiểu cũ: núm góc phải + LCD 2U theo shellStyle lcd-75', () => {
    const legacy = resolveModules({ layout: getLayout('75%'), legacyKnob: true, shellStyle: 'lcd-75' });
    expect(legacy.map((m) => m.kind)).toEqual(['knob', 'screen']);
    // Núm và LCD cùng muốn góc phải: LCD chiếm Delete + PrintScreen
    expect(legacy[1].replaces).toEqual(['Delete', 'PrintScreen']);
  });

  it('toạ độ thế giới cùng hệ với keyCenter (tâm bàn phím ở gốc)', () => {
    const foot = moduleFootprint({ x: 0, y: 0, w: 2, h: 1 }, 16, 6.25, 0.38);
    expect(foot.x).toBeCloseTo((1 - 8) * 0.38);
    expect(foot.z).toBeCloseTo((0.5 - 3.125) * 0.38);
    expect(foot.width).toBeCloseTo(0.76);
  });

  it('schema bắt buộc đúng một trong replaces / at', () => {
    expect(moduleSchema.safeParse({ kind: 'blank' }).success).toBe(false);
    expect(moduleSchema.safeParse({ kind: 'blank', replaces: ['ControlRight'] }).success).toBe(true);
    expect(
      moduleSchema.safeParse({ kind: 'blank', replaces: ['ControlRight'], at: { x: 0, y: 0, w: 1, h: 1 } }).success
    ).toBe(false);
  });
});
