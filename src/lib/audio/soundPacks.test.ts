import { describe, it, expect } from 'vitest';
import { packManifestSchema, pickVariant, planForKey } from './soundPacks';

describe('planForKey', () => {
  const full = { alpha: 16, space: 4, up: 10 };

  it('phím cách và phím có stabilizer dùng tiếng phím cách; phím thường dùng tiếng phím thường', () => {
    expect(planForKey('Space', full)).toEqual({ category: 'space', rate: 1 });
    expect(planForKey('Enter', full)).toEqual({ category: 'space', rate: 1.06 });
    expect(planForKey('KeyA', full)).toEqual({ category: 'alpha', rate: 1 });
  });

  it('gói không có tiếng phím cách thì phím cách dùng tiếng phím thường', () => {
    expect(planForKey('Space', { alpha: 16, space: 0, up: 0 })).toEqual({ category: 'alpha', rate: 1 });
  });
});

describe('pickVariant', () => {
  it('không bao giờ lặp lại đúng biến thể vừa phát', () => {
    for (let last = 0; last < 5; last++) {
      for (let r = 0; r < 1; r += 0.05) expect(pickVariant(5, last, () => r)).not.toBe(last);
    }
  });

  it('chọn được mọi biến thể và luôn nằm trong khoảng', () => {
    const seen = new Set<number>();
    for (let r = 0; r < 1; r += 0.01) {
      const v = pickVariant(4, -1, () => r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
      seen.add(v);
    }
    expect(seen.size).toBe(4);
    expect(pickVariant(1, 0)).toBe(0);
  });
});

describe('packManifestSchema', () => {
  it('bắt buộc có ít nhất một tiếng phím thường', () => {
    const base = { id: 'a', name: 'A', switch: 'S', clips: { alpha: ['alpha-01.wav'], space: [], up: [] } };
    expect(packManifestSchema.safeParse(base).success).toBe(true);
    expect(packManifestSchema.safeParse({ ...base, clips: { alpha: [], space: [], up: [] } }).success).toBe(false);
  });
});
