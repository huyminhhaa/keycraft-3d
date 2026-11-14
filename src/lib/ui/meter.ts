import { calculateSoundProfile } from '@/store/useKeyboardStore';
import type { PlateMaterial, SoundProfile, SwitchType } from '@/types/keyboard';

/**
 * Bộ toán hiển thị cho bảng Acoustic Telemetry:
 * quy đổi chỉ số âm học thô (pitch, resonance, damping) thành % thanh đo,
 * nhãn tính cách âm thanh và dạng sóng minh hoạ.
 */

export const PLATE_MATERIALS: readonly PlateMaterial[] = ['aluminum', 'polycarbonate', 'pom', 'fr4'];
export const SWITCH_TYPES: readonly SwitchType[] = ['linear', 'tactile', 'clicky', 'silent_linear'];

export interface MeterRange {
  min: number;
  max: number;
}

export interface AcousticRanges {
  pitch: MeterRange;
  resonance: MeterRange;
  damping: MeterRange;
}

/**
 * Quét mọi tổ hợp plate × switch để lấy biên min/max thật của từng chỉ số.
 * Nhờ vậy thanh đo luôn chạm đúng 0% và 100% ngay cả khi công thức âm học đổi.
 */
export const computeAcousticRanges = (): AcousticRanges => {
  const profiles = PLATE_MATERIALS.flatMap((plate) =>
    SWITCH_TYPES.map((sw) => calculateSoundProfile(plate, sw))
  );
  const rangeOf = (pick: (p: SoundProfile) => number): MeterRange => {
    const values = profiles.map(pick);
    return { min: Math.min(...values), max: Math.max(...values) };
  };
  return {
    pitch: rangeOf((p) => p.pitchMultiplier),
    resonance: rangeOf((p) => p.resonance),
    damping: rangeOf((p) => p.damping),
  };
};

export const ACOUSTIC_RANGES: AcousticRanges = computeAcousticRanges();

/** Quy đổi giá trị về phần trăm 0–100 (đã kẹp biên, làm tròn). */
export const toMeterPercent = (value: number, range: MeterRange): number => {
  if (!Number.isFinite(value) || range.max <= range.min) return 0;
  const ratio = (value - range.min) / (range.max - range.min);
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
};

export type ToneCharacter = 'Muted' | 'Thock' | 'Clack' | 'Balanced';

/** Gắn nhãn tính cách âm thanh ngắn gọn cho chip hiển thị. */
export const describeTone = (profile: SoundProfile): ToneCharacter => {
  if (profile.damping <= 0.25) return 'Muted';
  if (profile.pitchMultiplier < 0.95) return 'Thock';
  if (profile.pitchMultiplier >= 1.2) return 'Clack';
  return 'Balanced';
};

/**
 * Dạng sóng minh hoạ (0.12–1) suy ra từ hồ sơ âm học:
 * pitch quyết định tần số dao động, damping quyết định độ tắt dần, resonance quyết định biên độ.
 */
export const buildWaveform = (profile: SoundProfile, count = 14): number[] => {
  const safeCount = Math.max(1, Math.floor(count));
  return Array.from({ length: safeCount }, (_, i) => {
    const oscillation = 0.5 + 0.5 * Math.sin((i + 1) * profile.pitchMultiplier * 1.3);
    const envelope = Math.exp(-(i / safeCount) * profile.damping * 2);
    const amplitude = 0.18 + oscillation * envelope * profile.resonance * 0.6;
    return Number(Math.min(1, Math.max(0.12, amplitude)).toFixed(2));
  });
};
