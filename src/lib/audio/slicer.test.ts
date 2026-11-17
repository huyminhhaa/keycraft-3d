import { describe, it, expect } from 'vitest';
import { detectOnsets, encodeWav, extractClips, packGain, renderClip, selectClips, type Clip } from './slicer';

const SR = 48000;

/** Bộ sinh số giả ngẫu nhiên có hạt giống: test lần nào cũng ra cùng kết quả */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/** Bản thu giả: tạp âm nền nhỏ + tiếng gõ (nhiễu tắt dần theo hàm mũ) tại các thời điểm cho trước */
const recording = (
  seconds: number,
  hits: { at: number; amp: number; decayMs?: number; toneHz?: number }[],
  floor = 0.002
): Float32Array => {
  const random = rng(42);
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) out[i] = (random() * 2 - 1) * floor;
  hits.forEach(({ at, amp, decayMs = 12, toneHz }) => {
    const start = Math.round(at * SR);
    for (let i = 0; i < SR * 0.15 && start + i < out.length; i++) {
      const env = Math.exp(-i / ((SR * decayMs) / 1000));
      const body = toneHz ? Math.sin((2 * Math.PI * toneHz * i) / SR) : random() * 2 - 1;
      out[start + i] += amp * env * body;
    }
  });
  return out;
};

describe('detectOnsets', () => {
  it('tìm đúng thời điểm từng tiếng gõ (sai lệch dưới 3ms)', () => {
    const times = [0.2, 0.5, 0.75, 1.1, 1.4];
    const onsets = detectOnsets(recording(1.6, times.map((at) => ({ at, amp: 0.6 }))), { sampleRate: SR });
    expect(onsets).toHaveLength(times.length);
    onsets.forEach((onset, i) => expect(Math.abs(onset / SR - times[i])).toBeLessThan(0.003));
  });

  it('bản thu im lặng không có tiếng gõ nào', () => {
    expect(detectOnsets(new Float32Array(SR), { sampleRate: SR })).toEqual([]);
  });

  it('hai cú gõ sát hơn minGap chỉ tính một', () => {
    const onsets = detectOnsets(recording(0.6, [{ at: 0.2, amp: 0.6 }, { at: 0.22, amp: 0.6 }]), { sampleRate: SR });
    expect(onsets).toHaveLength(1);
  });
});

describe('extractClips', () => {
  it('cắt đuôi khi tiếng đã tắt, không kéo theo tạp âm nền', () => {
    const samples = recording(1, [{ at: 0.2, amp: 0.6, decayMs: 8 }]);
    const [clip] = extractClips(samples, detectOnsets(samples, { sampleRate: SR }), { sampleRate: SR });
    const lengthMs = ((clip.end - clip.start) * 1000) / SR;
    expect(lengthMs).toBeGreaterThan(30);
    expect(lengthMs).toBeLessThan(120);
    expect(clip.attackMs).toBeLessThan(8);
    expect(clip.preNoise).toBeLessThan(0.02);
  });

  it('bỏ tiếng gõ bị tiếng kế tiếp chen quá sớm', () => {
    const samples = recording(1, [{ at: 0.2, amp: 0.6 }, { at: 0.25, amp: 0.6 }, { at: 0.6, amp: 0.6 }]);
    const clips = extractClips(samples, detectOnsets(samples, { sampleRate: SR }), { sampleRate: SR });
    expect(clips.map((c) => Math.round((c.start / SR) * 100) / 100)).toEqual([0.25, 0.6]);
  });
});

const clip = (over: Partial<Clip>): Clip => ({
  start: 0,
  end: 4800,
  peak: 0.5,
  zcr: 0.2,
  tail: 0.2,
  preNoise: 0.01,
  secondHit: 0.1,
  attackMs: 3,
  ...over,
});

describe('selectClips', () => {
  it('tiếng to là tiếng nhấn, tiếng nhỏ là tiếng nhả; loại tiếng ù lên đỉnh chậm', () => {
    const downs = Array.from({ length: 20 }, (_, i) => clip({ start: i * 10000, peak: 0.5 + (i % 3) * 0.02 }));
    const ups = Array.from({ length: 5 }, (_, i) => clip({ start: 300000 + i * 10000, peak: 0.12 }));
    const hum = clip({ start: 400000, peak: 0.9, attackMs: 30, zcr: 0.01, tail: 3 });
    const result = selectClips([...downs, ...ups, hum], { sampleRate: SR, alpha: 10, space: 2, up: 3 });

    expect(result.alpha).toHaveLength(10);
    expect(result.up).toHaveLength(3);
    [...result.alpha, ...result.space].forEach((c) => expect(c.peak).toBeGreaterThanOrEqual(0.5));
    expect([...result.alpha, ...result.space, ...result.up]).not.toContain(hum);
  });

  it('phím cách: đoán theo tiếng trầm + ngân, hoặc lấy đúng khoảng thời gian chỉ định', () => {
    const normal = Array.from({ length: 20 }, (_, i) => clip({ start: i * 10000 }));
    const deep = clip({ start: 250000, zcr: 0.02, tail: 0.9 });
    expect(selectClips([...normal, deep], { sampleRate: SR, space: 1 }).space).toEqual([deep]);

    const chosen = selectClips([...normal, deep], { sampleRate: SR, space: 2, spaceRanges: [[0, 0.3]] });
    expect(chosen.space.map((c) => c.start)).toEqual([0, 10000]);
    expect(chosen.alpha).not.toContain(normal[0]);
  });

  it('loại đoạn dính cú gõ thứ hai hoặc nhiều tạp âm khi còn đủ đoạn sạch', () => {
    const good = Array.from({ length: 16 }, (_, i) => clip({ start: i * 10000 }));
    const doubled = clip({ start: 200000, secondHit: 0.9 });
    const noisy = clip({ start: 210000, preNoise: 0.3 });
    const result = selectClips([...good, doubled, noisy], { sampleRate: SR, space: 0 });
    expect(result.alpha).not.toContain(doubled);
    expect(result.alpha).not.toContain(noisy);
  });

  it('không có tiếng nào thì trả về nhóm rỗng', () => {
    expect(selectClips([], { sampleRate: SR })).toEqual({ alpha: [], space: [], up: [] });
  });
});

describe('renderClip, packGain, encodeWav', () => {
  it('tiếng to nhất đạt 0.9, đầu và cuối đoạn vuốt về 0', () => {
    const samples = new Float32Array(6000).fill(0.5);
    const c = clip({ start: 100, end: 5000, peak: 0.5 });
    const gain = packGain({ alpha: [c], space: [], up: [] });
    expect(gain).toBeCloseTo(1.8, 6);
    const out = renderClip(samples, c, gain, SR);
    expect(out).toHaveLength(4900);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(0);
    // Giữa đoạn (ngoài 1ms vuốt đầu và 15ms vuốt đuôi) giữ nguyên âm lượng đã chuẩn hoá
    expect(out[2000]).toBeCloseTo(0.9, 6);
  });

  it('WAV 16-bit mono có header RIFF đúng chuẩn', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]), SR);
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(SR);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(46, true)).toBe(0x7fff);
    expect(view.getInt16(48, true)).toBe(-0x8000);
  });
});
