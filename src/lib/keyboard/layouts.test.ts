import { describe, it, expect } from 'vitest';
import { LAYOUTS, countKeys, getLayout } from './layouts';

describe('Bố cục phím ANSI', () => {
  it('TKL có đúng 87 phím, rộng 18.25u và sâu 6.25u (có khoảng cách hàng F)', () => {
    const tkl = getLayout('TKL');
    expect(countKeys('TKL')).toBe(87);
    expect(tkl.width).toBe(18.25);
    expect(tkl.depth).toBe(6.25);
  });

  it('75% và 65% đều rộng 16u', () => {
    expect(getLayout('75%').width).toBe(16);
    expect(getLayout('65%').width).toBe(16);
    expect(getLayout('65%').depth).toBe(5);
  });

  it('mỗi hàng kết thúc thẳng mép phải của khối chính hoặc của cả bàn phím', () => {
    // TKL: hàng Home không có cụm điều hướng (dừng ở 15u), hàng Shift dừng ở phím ↑ (giữa cụm, 17.25u)
    const allowedEdges: Record<string, number[]> = { TKL: [15, 17.25, 18.25], '75%': [16], '65%': [16] };
    Object.values(LAYOUTS).forEach((layout) => {
      const rows = new Map<number, number>();
      layout.keys.forEach((key) => rows.set(key.y, Math.max(rows.get(key.y) ?? 0, key.x + key.w)));
      rows.forEach((rightEdge) => expect(allowedEdges[layout.id]).toContain(rightEdge));
    });
  });

  it('không có hai phím chồng lên nhau trong cùng một hàng', () => {
    Object.values(LAYOUTS).forEach((layout) => {
      const byRow = new Map<number, { x: number; w: number }[]>();
      layout.keys.forEach((key) => byRow.set(key.y, [...(byRow.get(key.y) ?? []), key]));
      byRow.forEach((keys) => {
        const sorted = [...keys].sort((a, b) => a.x - b.x);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i].x).toBeGreaterThanOrEqual(sorted[i - 1].x + sorted[i - 1].w);
        }
      });
    });
  });

  it('mã phím là duy nhất trong mỗi layout và Esc/Enter là phím nhấn (accent)', () => {
    Object.values(LAYOUTS).forEach((layout) => {
      const codes = layout.keys.map((key) => key.code);
      expect(new Set(codes).size).toBe(codes.length);
      expect(layout.keys.find((key) => key.code === 'Enter')?.role).toBe('accent');
      expect(layout.keys.find((key) => key.code === 'Escape')?.role).toBe('accent');
      expect(layout.keys.find((key) => key.code === 'Space')?.w).toBe(6.25);
    });
  });
});
