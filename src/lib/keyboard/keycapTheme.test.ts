import { describe, it, expect } from 'vitest';
import { getLayout } from './layouts';
import { keycapRowIndex, resolveKeycapSlot, type KeycapTheme } from './keycapTheme';

const base: KeycapTheme = { alpha: '#f4f4f4', modifier: '#5a5c62', accent: '#262a40' };
const key = (code: string, role: 'alpha' | 'modifier' | 'accent' = 'alpha') => ({ code, role });

describe('keycapTheme: phối màu keycap theo ảnh thật', () => {
  it('mặc định tô theo vai trò phím', () => {
    expect(resolveKeycapSlot(key('KeyA'), 3, base)).toMatchObject({ id: 'alpha:pbt', color: '#f4f4f4' });
    expect(resolveKeycapSlot(key('Tab', 'modifier'), 2, base)).toMatchObject({ id: 'modifier:pbt', color: '#5a5c62' });
  });

  it('accentKeys ép phím cách / mũi tên sang màu nhấn (Hi75C Space nâu, F75 mũi tên navy)', () => {
    const theme = { ...base, accentKeys: ['Space', 'ArrowUp'] };
    expect(resolveKeycapSlot(key('Space'), 5, theme).color).toBe('#262a40');
    expect(resolveKeycapSlot(key('ArrowUp', 'modifier'), 4, theme).id).toBe('accent:pbt');
  });

  it('màu theo hàng: hàng F sáng → hàng dưới tối; phím ép màu vẫn thắng màu hàng', () => {
    const theme = { ...base, rows: ['#eeeeee', '#cccccc', '#aaaaaa', '#888888', '#666666', '#444444'], accentKeys: ['Escape'] };
    expect(resolveKeycapSlot(key('F1'), 0, theme)).toMatchObject({ id: 'row0:pbt', color: '#eeeeee' });
    expect(resolveKeycapSlot(key('Space'), 5, theme).color).toBe('#444444');
    expect(resolveKeycapSlot(key('Escape', 'accent'), 0, theme).id).toBe('accent:pbt');
    // Ít màu hơn số hàng: hàng dưới dùng màu cuối
    expect(resolveKeycapSlot(key('Space'), 5, { ...base, rows: ['#111111', '#222222'] }).color).toBe('#222222');
  });

  it('hàng thứ mấy: layout 65% không có hàng F nên hàng số là hàng 1 (gradient khớp ảnh)', () => {
    const tkl = getLayout('TKL');
    const sixtyFive = getLayout('65%');
    expect(keycapRowIndex(tkl.keys.find((k) => k.code === 'F1') as (typeof tkl.keys)[number], tkl)).toBe(0);
    expect(keycapRowIndex(tkl.keys.find((k) => k.code === 'Space') as (typeof tkl.keys)[number], tkl)).toBe(5);
    expect(keycapRowIndex(sixtyFive.keys.find((k) => k.code === 'Digit1') as (typeof sixtyFive.keys)[number], sixtyFive)).toBe(1);
  });

  it('hoàn thiện: jelly chỉ cho phím nhấn (QK61), toàn bộ trong (Nova75), carbon forged (Nut65)', () => {
    const jelly = { ...base, jellyAccent: true, accentKeys: ['Enter'] };
    expect(resolveKeycapSlot(key('Enter', 'accent'), 3, jelly).finish).toBe('translucent');
    expect(resolveKeycapSlot(key('KeyA'), 3, jelly).finish).toBe('pbt');
    expect(resolveKeycapSlot(key('KeyA'), 3, { ...base, finish: 'translucent' }).id).toBe('alpha:translucent');
    expect(resolveKeycapSlot(key('KeyA'), 3, { ...base, finish: 'forged-carbon' }).finish).toBe('forged-carbon');
  });

  it('màu chữ: tự suy theo nền, hoặc màu riêng của build (chữ cam Lucky65)', () => {
    expect(resolveKeycapSlot(key('KeyA'), 3, base).legend).toBe('#26262a');
    expect(resolveKeycapSlot(key('KeyA'), 3, { ...base, alpha: '#222222' }).legend).toBe('#f1eee8');
    expect(resolveKeycapSlot(key('KeyA'), 3, { ...base, legend: '#f2a33a' }).legend).toBe('#f2a33a');
  });
});
