/**
 * Cắt tiếng gõ phím thật từ một bản thu (sound test trên YouTube…) thành từng đoạn ngắn.
 *
 * Luồng: mẫu âm thanh → đường bao năng lượng (RMS mỗi 1ms) → tìm điểm năng lượng vọt lên đột ngột
 * (onset = lúc phím chạm đáy) → cắt mỗi tiếng tới ngay trước tiếng kế tiếp → đo đặc trưng từng đoạn
 * → chọn đoạn sạch nhất cho từng nhóm (phím thường, phím cách, tiếng nhả phím).
 * Toàn bộ là hàm thuần trên Float32Array: chạy được trong Node (script) lẫn test.
 */

export interface SlicerOptions {
  sampleRate: number;
  /** Bước của đường bao (ms) */
  hopMs?: number;
  /** Cửa sổ tính RMS (ms) */
  windowMs?: number;
  /** Hai tiếng gõ cách nhau ít nhất (ms) */
  minGapMs?: number;
  /** Năng lượng phải gấp bao nhiêu lần mức thấp nhất trong 15ms trước đó mới tính là tiếng gõ mới */
  riseRatio?: number;
}

const DEFAULTS = { hopMs: 1, windowMs: 3, minGapMs: 45, riseRatio: 2.5 };

export const percentile = (values: ArrayLike<number>, p: number): number => {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[index];
};

/** RMS theo từng bước `hopMs`. Phần tử i ứng với mẫu bắt đầu tại i × hop. */
export const envelope = (samples: Float32Array, sampleRate: number, windowMs = 3, hopMs = 1): Float32Array => {
  const hop = Math.max(1, Math.round((sampleRate * hopMs) / 1000));
  const win = Math.max(1, Math.round((sampleRate * windowMs) / 1000));
  if (samples.length < win) return new Float32Array(0);
  const frames = Math.floor((samples.length - win) / hop) + 1;
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * hop;
    for (let i = start; i < start + win; i++) sum += samples[i] * samples[i];
    out[f] = Math.sqrt(sum / win);
  }
  return out;
};

/** Vị trí (tính theo mẫu) các tiếng gõ trong bản thu. */
export const detectOnsets = (samples: Float32Array, options: SlicerOptions): number[] => {
  const { hopMs, windowMs, minGapMs, riseRatio } = { ...DEFAULTS, ...options };
  const hop = Math.max(1, Math.round((options.sampleRate * hopMs) / 1000));
  const env = envelope(samples, options.sampleRate, windowMs, hopMs);
  if (env.length === 0) return [];

  const floor = percentile(env, 0.3);
  const peak = percentile(env, 0.995);
  if (peak <= floor * 1.5 || peak === 0) return [];
  const threshold = floor + (peak - floor) * 0.12;
  const lookback = Math.max(1, Math.round(15 / hopMs));
  const gap = Math.max(1, Math.round(minGapMs / hopMs));

  const onsets: number[] = [];
  let last = -Infinity;
  for (let i = 1; i < env.length; i++) {
    if (env[i] < threshold || i - last < gap) continue;
    let recentMin = Infinity;
    for (let j = Math.max(0, i - lookback); j < i; j++) recentMin = Math.min(recentMin, env[j]);
    if (env[i] < riseRatio * Math.max(recentMin, floor * 0.5)) continue;
    // Lùi về chân sườn lên để không cắt mất phần đầu tiếng gõ
    let start = i;
    while (start > 0 && env[start - 1] < env[start] && env[start - 1] > floor * 1.2) start--;
    onsets.push(start * hop);
    last = i;
  }
  return onsets;
};

export interface Clip {
  /** Mẫu bắt đầu / kết thúc (không gồm end) trong bản thu gốc */
  start: number;
  end: number;
  peak: number;
  /** Tỉ lệ đổi dấu: càng cao tiếng càng sáng/đanh */
  zcr: number;
  /** Năng lượng phần đuôi (sau 40ms) so với phần đầu: càng cao càng ngân (phím cách có tiếng stab) */
  tail: number;
  /** Nhiễu nền 20ms ngay trước tiếng gõ so với đỉnh: càng thấp càng sạch */
  preNoise: number;
  /** Đỉnh lớn nhất sau 10ms đầu so với đỉnh chính: cao nghĩa là dính thêm một cú gõ khác (gõ dồn hai phím) */
  secondHit: number;
  /** Thời gian từ đầu đoạn tới đỉnh (ms): tiếng chạm đáy lên đỉnh trong vài ms; tiếng ù, nhạc nền phồng lên chậm */
  attackMs: number;
}

const rms = (samples: Float32Array, from: number, to: number): number => {
  const a = Math.max(0, from);
  const b = Math.min(samples.length, to);
  if (b <= a) return 0;
  let sum = 0;
  for (let i = a; i < b; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (b - a));
};

export interface ExtractOptions {
  sampleRate: number;
  /** Lấy thêm trước điểm gõ (ms) */
  prerollMs?: number;
  maxClipMs?: number;
  /** Đoạn ngắn hơn (do gõ quá dồn) thì bỏ */
  minClipMs?: number;
}

export const extractClips = (samples: Float32Array, onsets: number[], options: ExtractOptions): Clip[] => {
  const sr = options.sampleRate;
  const ms = (value: number) => Math.round((sr * value) / 1000);
  const preroll = ms(options.prerollMs ?? 2);
  const maxLen = ms(options.maxClipMs ?? 220);
  const minLen = ms(options.minClipMs ?? 70);
  // Mức tạp âm nền của cả bản thu: 30% khoảng 5ms yên tĩnh nhất
  const floor = percentile(envelope(samples, sr, 5, 5), 0.3);

  const clips: Clip[] = [];
  onsets.forEach((onset, k) => {
    const start = Math.max(0, onset - preroll);
    const next = k + 1 < onsets.length ? onsets[k + 1] - preroll : samples.length;
    const room = Math.min(start + maxLen, next, samples.length);
    // Tiếng gõ kế tiếp tới quá sớm (gõ dồn): không đủ chỗ cho một tiếng trọn vẹn
    if (room - start < minLen) return;

    let peak = 0;
    let peakAt = start;
    for (let i = start; i < room; i++) {
      if (Math.abs(samples[i]) > peak) {
        peak = Math.abs(samples[i]);
        peakAt = i;
      }
    }
    if (peak === 0) return;

    // Cắt đuôi khi tiếng đã tắt (RMS 5ms dưới −34 dB so với đỉnh, hoặc chạm mức tạp âm nền của bản thu)
    const step = ms(5);
    const silence = Math.max(peak * 0.02, floor * 2);
    let end = room;
    for (let i = start + ms(30); i + step <= room; i += step) {
      if (rms(samples, i, i + step) < silence) {
        end = Math.min(room, i + ms(10));
        break;
      }
    }

    let crossings = 0;
    let later = 0;
    for (let i = start + 1; i < end; i++) {
      if (samples[i - 1] < 0 !== samples[i] < 0) crossings++;
      if (i >= start + ms(10)) later = Math.max(later, Math.abs(samples[i]));
    }
    const head = rms(samples, start, start + ms(40));
    clips.push({
      start,
      end,
      peak,
      zcr: crossings / (end - start),
      tail: head > 0 ? rms(samples, start + ms(40), end) / head : 0,
      preNoise: rms(samples, start - ms(20), start) / peak,
      secondHit: later / peak,
      attackMs: ((peakAt - start) * 1000) / sr,
    });
  });
  return clips;
};

export interface Selection {
  alpha: Clip[];
  space: Clip[];
  up: Clip[];
}

export interface SelectOptions {
  sampleRate: number;
  alpha?: number;
  space?: number;
  up?: number;
  /** Khoảng thời gian (giây) trong bản thu chỉ gõ phím cách. Không có thì đoán theo tiếng trầm + ngân. */
  spaceRanges?: [number, number][];
}

/** Tiếng gõ thật đạt đỉnh trong khoảng này kể từ đầu đoạn (gồm 2ms lấy dư phía trước) */
export const MAX_ATTACK_MS = 8;

const rankBy =<T>(items: T[], score: (item: T) => number): T[] => [...items].sort((a, b) => score(a) - score(b));

/**
 * Chia tiếng gõ thành nhóm:
 *  - Tiếng to là tiếng nhấn (chạm đáy); tiếng nhỏ hơn hẳn là tiếng nhả phím.
 *  - Phím cách: trầm hơn (ít đổi dấu) và ngân lâu hơn (stabilizer). Ưu tiên khoảng thời gian người dùng chỉ định.
 *  - Phím thường: chọn tiếng sạch nhất, độ to gần trung vị để gõ liên tục nghe đều.
 */
export const selectClips = (clips: Clip[], options: SelectOptions): Selection => {
  const want = { alpha: options.alpha ?? 16, space: options.space ?? 6, up: options.up ?? 10 };
  if (clips.length === 0) return { alpha: [], space: [], up: [] };

  // Chỉ giữ tiếng lên đỉnh nhanh: loại tiếng ù/nhạc nền lọt qua bước tìm onset
  const strikes = clips.filter((c) => c.attackMs <= MAX_ATTACK_MS);
  const loud = percentile(strikes.map((c) => c.peak), 0.9);
  const clean = strikes.filter((c) => c.preNoise < 0.1 && c.secondHit < 0.55);
  const pool = clean.length >= want.alpha ? clean : strikes;
  const down = pool.filter((c) => c.peak >= loud * 0.45);
  const upCandidates = pool.filter((c) => c.peak < loud * 0.45 && c.peak >= loud * 0.12);

  let space: Clip[];
  let alphaPool: Clip[];
  if (options.spaceRanges && options.spaceRanges.length > 0) {
    const inRange = (c: Clip) =>
      options.spaceRanges!.some(([a, b]) => c.start / options.sampleRate >= a && c.start / options.sampleRate <= b);
    space = down.filter(inRange).slice(0, want.space);
    alphaPool = down.filter((c) => !inRange(c));
  } else {
    // Điểm "trầm + ngân": xếp hạng zcr tăng dần và tail giảm dần, cộng hạng lại
    const byZcr = rankBy(down, (c) => c.zcr);
    const byTail = rankBy(down, (c) => -c.tail);
    const score = new Map<Clip, number>();
    byZcr.forEach((c, i) => score.set(c, i));
    byTail.forEach((c, i) => score.set(c, (score.get(c) ?? 0) + i));
    const take = Math.min(want.space, Math.floor(down.length * 0.12));
    space = rankBy(down, (c) => score.get(c) ?? 0).slice(0, take);
    alphaPool = down.filter((c) => !space.includes(c));
  }

  const median = percentile(alphaPool.map((c) => c.peak), 0.5);
  const alpha = rankBy(alphaPool, (c) => Math.abs(c.peak - median) / (median || 1) + c.preNoise * 4).slice(0, want.alpha);
  const up = rankBy(upCandidates, (c) => c.preNoise - c.peak).slice(0, want.up);

  // Giữ thứ tự thời gian cho dễ nghe lại khi kiểm tra
  const byTime = (a: Clip, b: Clip) => a.start - b.start;
  return { alpha: alpha.sort(byTime), space: space.sort(byTime), up: up.sort(byTime) };
};

/** Cắt đoạn, nhân hệ số âm lượng chung, vuốt đầu 1ms và đuôi 15ms để không nghe tiếng "bụp" khi cắt. */
export const renderClip = (samples: Float32Array, clip: Clip, gain: number, sampleRate: number): Float32Array => {
  const out = samples.slice(clip.start, clip.end);
  const fadeIn = Math.min(out.length, Math.round(sampleRate * 0.001));
  const fadeOut = Math.min(out.length, Math.round(sampleRate * 0.015));
  for (let i = 0; i < out.length; i++) {
    let g = gain;
    if (i < fadeIn) g *= i / fadeIn;
    const fromEnd = out.length - 1 - i;
    if (fromEnd < fadeOut) g *= fromEnd / fadeOut;
    out[i] *= g;
  }
  return out;
};

/** Hệ số âm lượng chung: tiếng to nhất của nhóm nhấn phím đạt 0.9, giữ nguyên độ to tương đối giữa các tiếng. */
export const packGain = (selection: Selection): number => {
  const peak = Math.max(0, ...selection.alpha.map((c) => c.peak), ...selection.space.map((c) => c.peak));
  return peak > 0 ? 0.9 / peak : 1;
};

/** Mã hoá WAV PCM 16-bit mono (trình duyệt nào cũng giải mã được). */
export const encodeWav = (data: Float32Array, sampleRate: number): Uint8Array => {
  const bytes = new Uint8Array(44 + data.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + data.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, data.length * 2, true);
  data.forEach((sample, i) => {
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  });
  return bytes;
};
