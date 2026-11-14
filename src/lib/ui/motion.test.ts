import { describe, it, expect } from 'vitest';
import {
  SPRINGS,
  createStaggerContainer,
  getStaggerDelay,
  kineticWord,
  splitWords,
} from './motion';

describe('motion language', () => {
  it('splitWords tách từ và bỏ khoảng trắng thừa', () => {
    expect(splitWords('  Điêu khắc   âm thanh ')).toEqual(['Điêu', 'khắc', 'âm', 'thanh']);
    expect(splitWords('   ')).toEqual([]);
  });

  it('getStaggerDelay tăng tuyến tính và không âm', () => {
    expect(getStaggerDelay(0, 0.07, 0.2)).toBe(0.2);
    expect(getStaggerDelay(3, 0.07, 0.2)).toBe(0.41);
    expect(getStaggerDelay(-5, 0.07, 0.2)).toBe(0.2);
  });

  it('createStaggerContainer cấu hình staggerChildren và delayChildren', () => {
    const variants = createStaggerContainer(0.08, 0.3);
    expect(variants.visible).toEqual({
      transition: { staggerChildren: 0.08, delayChildren: 0.3 },
    });
  });

  it('kineticWord đi từ dưới mặt nạ (110%) về vị trí gốc', () => {
    expect(kineticWord.hidden).toMatchObject({ y: '110%', opacity: 0 });
    expect(kineticWord.visible).toMatchObject({ y: '0%', opacity: 1 });
  });

  it('mọi spring đều là lò xo có damping dương', () => {
    Object.values(SPRINGS).forEach((spring) => {
      expect(spring.type).toBe('spring');
      expect(spring.damping).toBeGreaterThan(0);
      expect(spring.stiffness).toBeGreaterThan(0);
    });
  });
});
