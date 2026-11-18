import { describe, it, expect } from 'vitest';
import { LOUDNESS_TARGET, SPACE_CEILING, computeClipGains, measureLevel, type ClipLevel } from './loudness';
import { createPressGate } from './pressGate';

const level = (rms: number, peak = rms * 3): ClipLevel => ({ rms, peak });

describe('measureLevel', () => {
  it('đo RMS cửa sổ 5ms lớn nhất và đỉnh tuyệt đối', () => {
    const data = new Float32Array(4800);
    for (let i = 1000; i < 1240; i++) data[i] = i % 2 ? 0.5 : -0.5; // cú gõ 5ms biên độ 0.5
    const result = measureLevel(data, 48000);
    expect(result.peak).toBeCloseTo(0.5);
    expect(result.rms).toBeCloseTo(0.5, 2);
  });

  it('đoạn rỗng hoặc im lặng thì bằng 0', () => {
    expect(measureLevel(new Float32Array(0), 48000)).toEqual({ rms: 0, peak: 0 });
    expect(measureLevel(new Float32Array(100), 48000).rms).toBe(0);
  });
});

describe('computeClipGains', () => {
  it('phím thường ở mức trung vị giữ gain 1, đoạn lệch bị nắn nhẹ', () => {
    const gains = computeClipGains({ alpha: [level(0.1), level(0.2), level(0.3)], space: [], up: [] });
    expect(gains.alpha[1]).toBe(1);
    expect(gains.alpha[0]).toBeCloseTo(1.4); // kẹp tối đa ×1.4
    expect(gains.alpha[2]).toBeCloseTo(0.7, 1);
  });

  it('phím cách to vọt (×5) bị kéo về dưới trần, không bao giờ to hơn 1.15× phím thường', () => {
    const gains = computeClipGains({ alpha: [level(0.2)], space: [level(1)], up: [] });
    expect(1 * gains.space[0]).toBeLessThanOrEqual(0.2 * SPACE_CEILING + 1e-9);
  });

  it('phím cách nhỏ hơn phím thường được nâng lên vừa đủ dày hơn một chút', () => {
    const gains = computeClipGains({ alpha: [level(0.2)], space: [level(0.15)], up: [] });
    expect(0.15 * gains.space[0]).toBeCloseTo(0.2 * LOUDNESS_TARGET.space, 3);
  });

  it('tiếng nhả luôn dịu hơn tiếng nhấn và không bao giờ bị khuếch đại', () => {
    const gains = computeClipGains({ alpha: [level(0.2)], space: [], up: [level(0.3), level(0.02)] });
    expect(0.3 * gains.up[0]).toBeLessThan(0.2);
    expect(gains.up[1]).toBeLessThanOrEqual(1);
  });

  it('đỉnh sau khi nhân gain không vượt 0.95 (chừa đầu cho limiter)', () => {
    const gains = computeClipGains({ alpha: [level(0.2, 0.3), level(0.1, 0.9)], space: [], up: [] });
    expect(0.9 * gains.alpha[1]).toBeLessThanOrEqual(0.95);
  });
});

describe('createPressGate', () => {
  it('bỏ lần nhấn trùng của cùng phím < 22ms và của phím bất kỳ < 12ms', () => {
    const gate = createPressGate({ sameKeyMs: 22, anyKeyMs: 12 });
    expect(gate('KeyA', 0)).toBe(true);
    expect(gate('Backspace', 1)).toBe(false);
    expect(gate('KeyA', 15)).toBe(false);
    expect(gate('KeyB', 13)).toBe(true);
    expect(gate('KeyA', 30)).toBe(true);
  });

  it('gõ nhanh thật (≥ 30ms/phím) không bị mất tiếng nào', () => {
    const gate = createPressGate();
    const codes = ['KeyH', 'KeyE', 'KeyL', 'KeyL', 'KeyO'];
    expect(codes.map((code, i) => gate(code, i * 35))).toEqual([true, true, true, true, true]);
  });
});
