import { describe, it, expect } from 'vitest';
import { calculateSoundProfile } from '@/store/useKeyboardStore';
import {
  ACOUSTIC_RANGES,
  PLATE_MATERIALS,
  SWITCH_TYPES,
  buildWaveform,
  describeTone,
  toMeterPercent,
} from './meter';

describe('acoustic meter math', () => {
  it('toMeterPercent kẹp biên 0–100 và xử lý đầu vào hỏng', () => {
    const range = { min: 1, max: 2 };
    expect(toMeterPercent(1.5, range)).toBe(50);
    expect(toMeterPercent(0, range)).toBe(0);
    expect(toMeterPercent(5, range)).toBe(100);
    expect(toMeterPercent(Number.NaN, range)).toBe(0);
    expect(toMeterPercent(1, { min: 2, max: 2 })).toBe(0);
  });

  it('ACOUSTIC_RANGES phủ trọn mọi tổ hợp plate × switch (chạm đúng 0% và 100%)', () => {
    const pitches = PLATE_MATERIALS.flatMap((plate) =>
      SWITCH_TYPES.map((sw) => toMeterPercent(calculateSoundProfile(plate, sw).pitchMultiplier, ACOUSTIC_RANGES.pitch))
    );
    expect(Math.min(...pitches)).toBe(0);
    expect(Math.max(...pitches)).toBe(100);
    expect(ACOUSTIC_RANGES.damping.min).toBeLessThan(ACOUSTIC_RANGES.damping.max);
  });

  it('describeTone gắn nhãn đúng tính cách âm thanh', () => {
    expect(describeTone(calculateSoundProfile('pom', 'silent_linear'))).toBe('Muted');
    expect(describeTone(calculateSoundProfile('polycarbonate', 'linear'))).toBe('Thock');
    expect(describeTone(calculateSoundProfile('aluminum', 'linear'))).toBe('Clack');
    expect(describeTone(calculateSoundProfile('fr4', 'linear'))).toBe('Balanced');
  });

  it('buildWaveform trả về đúng số cột, giá trị trong [0.12, 1] và tất định', () => {
    const profile = calculateSoundProfile('aluminum', 'clicky');
    const wave = buildWaveform(profile, 14);
    expect(wave).toHaveLength(14);
    wave.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0.12);
      expect(v).toBeLessThanOrEqual(1);
    });
    expect(buildWaveform(profile, 14)).toEqual(wave);
    expect(buildWaveform(profile, 0)).toHaveLength(1);
  });

  it('plate khác nhau cho dạng sóng khác nhau', () => {
    const alu = buildWaveform(calculateSoundProfile('aluminum', 'linear'));
    const pc = buildWaveform(calculateSoundProfile('polycarbonate', 'linear'));
    expect(alu).not.toEqual(pc);
  });
});
