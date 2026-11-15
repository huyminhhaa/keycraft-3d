import { describe, it, expect } from 'vitest';
import { INITIAL_KEYBOARD_STATE, calculateSoundProfile } from '@/store/useKeyboardStore';
import { buildHotspots } from './Hotspots';

describe('buildHotspots', () => {
  it('mặc định có 4 điểm, nội dung khớp đúng cấu hình đang chọn', () => {
    const spots = buildHotspots(INITIAL_KEYBOARD_STATE);
    expect(spots.map((s) => s.id)).toEqual(['keycap', 'case', 'switch', 'led']);
    expect(spots[0].title).toBe('Keycap Đỏ hai tông');
    expect(spots[1].title).toBe('Vỏ nhôm đỏ');
    expect(spots[2]).toMatchObject({ title: 'Switch Linear', detail: 'Trơn, không khấc, plate FR4' });
    expect(spots[3].detail).toBe('Độ sáng 70%');
  });

  it('tắt LED thì bỏ điểm LED; vỏ gỗ không kèm màu; keycap lạ là tự phối', () => {
    const spots = buildHotspots({
      ...INITIAL_KEYBOARD_STATE,
      underglowEnabled: false,
      caseMaterial: 'wood',
      keycapColor: '#123456',
      plateMaterial: 'pom',
      soundProfile: calculateSoundProfile('pom', 'linear'),
    });
    expect(spots.map((s) => s.id)).not.toContain('led');
    expect(spots[0].title).toBe('Keycap tự phối');
    expect(spots[1].title).toBe('Vỏ gỗ');
  });

  it('điểm keycap nằm trên phím Esc (góc sau-trái, xa người gõ), điểm vỏ ở góc phải', () => {
    const [keycap, kase] = buildHotspots(INITIAL_KEYBOARD_STATE);
    expect(keycap.position[0]).toBeLessThan(0);
    expect(keycap.position[2]).toBeLessThan(0);
    expect(kase.position[0]).toBeGreaterThan(0);
  });
});
