import type { SoundCategory } from './soundPacks';

/**
 * Cân bằng âm lượng lúc phát (không sửa file .wav): đo độ to từng đoạn tiếng sau khi giải mã,
 * rồi tính hệ số gain riêng cho từng đoạn để
 *  - phím thường (alpha) đều nhau quanh trung vị của chính gói đó (giữ nguyên chất âm, chỉ nắn đoạn lệch),
 *  - phím cách (space) chỉ to hơn phím thường một chút, không bao giờ vọt lên,
 *  - tiếng nhả (up) dịu hơn hẳn tiếng nhấn.
 */

export interface ClipLevel {
  /** RMS lớn nhất trong cửa sổ 5ms: bám theo độ to cảm nhận của cú gõ (transient) */
  rms: number;
  /** Biên độ đỉnh tuyệt đối */
  peak: number;
}

/** Độ to tương đối so với phím thường */
export const LOUDNESS_TARGET: Record<SoundCategory, number> = {
  alpha: 1,
  space: 1.08,
  up: 0.55,
};

/** Trần độ to của phím cách so với phím thường (chặn trường hợp bản thu space quá lớn) */
export const SPACE_CEILING = 1.15;
/** Đỉnh tối đa sau khi nhân gain (chừa đầu cho limiter, tránh vỡ tiếng) */
const PEAK_LIMIT = 0.95;
const WINDOW_SECONDS = 0.005;

export const measureLevel = (samples: Float32Array, sampleRate: number): ClipLevel => {
  const window = Math.max(1, Math.round(sampleRate * WINDOW_SECONDS));
  let peak = 0;
  let best = 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    const abs = Math.abs(v);
    if (abs > peak) peak = abs;
    sum += v * v;
    if (i >= window) sum -= samples[i - window] * samples[i - window];
    if (i >= window - 1) best = Math.max(best, sum / window);
  }
  // Đoạn ngắn hơn một cửa sổ: lấy RMS cả đoạn
  if (samples.length > 0 && samples.length < window) best = sum / samples.length;
  return { rms: Math.sqrt(Math.max(0, best)), peak };
};

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * Hệ số gain cho từng đoạn của gói. Mốc chuẩn = trung vị RMS của phím thường, nên phím thường
 * ở mức trung bình giữ gain ≈ 1 (không đổi tiếng gốc).
 */
export const computeClipGains = (levels: Record<SoundCategory, ClipLevel[]>): Record<SoundCategory, number[]> => {
  const reference = median(levels.alpha.map((l) => l.rms)) || median(levels.space.map((l) => l.rms)) || 1;
  const gainFor = (category: SoundCategory, level: ClipLevel): number => {
    if (level.rms <= 1e-6) return 1;
    const target = reference * LOUDNESS_TARGET[category];
    let gain = target / level.rms;
    // Phím thường: chỉ nắn nhẹ đoạn lệch, giữ độ biến thiên tự nhiên giữa các lần gõ
    if (category === 'alpha') gain = clamp(gain, 0.7, 1.4);
    // Phím cách: không bao giờ to hơn trần, nhưng cũng không bị bóp mất chất trầm
    if (category === 'space') gain = Math.min(clamp(gain, 0.3, 1.6), (reference * SPACE_CEILING) / level.rms);
    // Tiếng nhả: chỉ giảm, không bao giờ khuếch đại
    if (category === 'up') gain = clamp(gain, 0.15, 1);
    if (level.peak > 0) gain = Math.min(gain, PEAK_LIMIT / level.peak);
    // Làm tròn xuống: không bao giờ vượt các trần ở trên vì sai số làm tròn
    return Math.floor(gain * 1e4) / 1e4;
  };
  return {
    alpha: levels.alpha.map((l) => gainFor('alpha', l)),
    space: levels.space.map((l) => gainFor('space', l)),
    up: levels.up.map((l) => gainFor('up', l)),
  };
};
