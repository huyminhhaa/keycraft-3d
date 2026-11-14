import { describe, it, expect } from 'vitest';
import { FLOOR_FADE_STOPS, createRadialFadeTexture } from './floorTexture';

describe('Mặt nạ sàn phản chiếu', () => {
  it('đặc ở giữa, trong suốt hoàn toàn ở mép (không bao giờ lộ mép sàn)', () => {
    expect(FLOOR_FADE_STOPS[0]).toEqual([0, 1]);
    expect(FLOOR_FADE_STOPS[FLOOR_FADE_STOPS.length - 1]).toEqual([1, 0]);
  });

  it('độ đặc giảm dần từ tâm ra ngoài', () => {
    for (let i = 1; i < FLOOR_FADE_STOPS.length; i++) {
      expect(FLOOR_FADE_STOPS[i][0]).toBeGreaterThan(FLOOR_FADE_STOPS[i - 1][0]);
      expect(FLOOR_FADE_STOPS[i][1]).toBeLessThan(FLOOR_FADE_STOPS[i - 1][1]);
    }
  });

  it('môi trường không có canvas 2D (jsdom) trả về null thay vì lỗi', () => {
    expect(createRadialFadeTexture()).toBeNull();
  });
});
