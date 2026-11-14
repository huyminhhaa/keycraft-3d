import { describe, it, expect } from 'vitest';
import { KEYCAP_SETS, findKeycapSet, legendColorFor, relativeLuminance } from './keycapSets';

describe('Bộ màu keycap', () => {
  it('id của các bộ là duy nhất', () => {
    const ids = KEYCAP_SETS.map((set) => set.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('findKeycapSet khớp cả 3 màu, không phân biệt hoa thường', () => {
    const red = KEYCAP_SETS[0];
    expect(
      findKeycapSet({
        keycapColor: red.alpha.toUpperCase(),
        keycapModifierColor: red.modifier,
        keycapAccentColor: red.accent,
      })?.id
    ).toBe('red-two-tone');
    expect(
      findKeycapSet({ keycapColor: red.alpha, keycapModifierColor: '#000000', keycapAccentColor: red.accent })
    ).toBeUndefined();
  });

  it('relativeLuminance: đen = 0, trắng = 1, nhận cả mã 3 ký tự', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('not-a-color')).toBe(0);
  });

  it('legendColorFor chọn chữ sáng trên nền tối và chữ tối trên nền sáng', () => {
    expect(legendColorFor('#7c1521')).toBe('#f1eee8');
    expect(legendColorFor('#efebe3')).toBe('#26262a');
  });
});
