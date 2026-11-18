import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { MAX_VOICES, LIMITER, soundEngine } from './soundEngine';
import { LOUDNESS_TARGET, SPACE_CEILING, measureLevel } from './loudness';

/**
 * Chuyển gói tiếng khi đổi mẫu phím, cache, huỷ request, giới hạn voice, limiter, chống dính tiếng,
 * cân bằng âm lượng phím cách. Web Audio + fetch đều là bản giả.
 */

const SAMPLE_RATE = 48000;

/** AudioBuffer giả có dữ liệu thật để đo độ to: tên file chứa "loud" thì biên độ 0.9, còn lại 0.2 */
const fakeBuffer = (file: string) => {
  const amplitude = file.includes('loud') ? 0.9 : 0.2;
  const data = new Float32Array(SAMPLE_RATE * 0.05).map((_, i) => amplitude * Math.sin(i / 7) * Math.exp(-i / 900));
  return { file, duration: 0.05, sampleRate: SAMPLE_RATE, getChannelData: () => data };
};
type FakeBuffer = ReturnType<typeof fakeBuffer>;

const started: string[] = [];
const stopped: string[] = [];
const oscillators = vi.fn();
const compressorParams: Record<string, number> = {};

class Param {
  constructor(private readonly name = '') {}
  value = 1;
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn((v: number) => {
    if (this.name) compressorParams[this.name] = v;
  });
  setTargetAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeContext {
  currentTime = 0;
  sampleRate = SAMPLE_RATE;
  state: AudioContextState = 'running';
  destination = {};
  createGain = () => ({ gain: new Param(), connect: vi.fn() });
  createDynamicsCompressor = () => ({
    threshold: new Param('threshold'),
    knee: new Param('knee'),
    ratio: new Param('ratio'),
    attack: new Param('attack'),
    release: new Param('release'),
    connect: vi.fn(),
  });
  createBiquadFilter = () => ({ frequency: new Param(), Q: new Param(), type: 'lowpass', connect: vi.fn() });
  createBuffer = (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) });
  createOscillator = () => {
    oscillators();
    return { type: 'sine', frequency: new Param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  };
  createBufferSource = () => {
    const source = {
      buffer: null as FakeBuffer | null,
      playbackRate: new Param(),
      connect: vi.fn(),
      stop: vi.fn(() => {
        if (source.buffer) stopped.push(source.buffer.file);
      }),
      start: () => {
        if (source.buffer?.file) started.push(source.buffer.file);
      },
    };
    return source;
  };
  decodeAudioData = async (data: ArrayBuffer) => fakeBuffer(new TextDecoder().decode(data));
  resume = vi.fn().mockResolvedValue(undefined);
}

const manifest = (id: string, space = 'space-01.wav') => ({
  id,
  name: id,
  switch: 'Test',
  clips: { alpha: ['alpha-01.wav', 'alpha-02.wav', 'alpha-03.wav'], space: [space], up: ['up-01.wav'] },
});

/** Gói "slow" chỉ trả lời khi test gọi releaseSlow() */
let releaseSlow: (() => void) | null = null;
const signals = new Map<string, AbortSignal>();
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const id = url.split('/')[2];
  if (init?.signal) signals.set(id, init.signal);
  if (id.startsWith('slow') && url.endsWith('pack.json')) {
    await new Promise<void>((resolve, reject) => {
      releaseSlow = resolve;
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  }
  if (id === 'missing') return new Response('', { status: 404 });
  if (url.endsWith('pack.json')) return new Response(JSON.stringify(manifest(id, id === 'boomy' ? 'loud-space.wav' : 'space-01.wav')));
  return new Response(`${id}/${url.split('/').pop()}`);
});

describe('SoundEngine: đổi gói tiếng khi đổi mẫu phím', () => {
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    (window as unknown as { AudioContext: typeof FakeContext }).AudioContext = FakeContext;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    soundEngine.setPressGate({ sameKeyMs: 0, anyKeyMs: 0 });
    started.length = 0;
    stopped.length = 0;
    oscillators.mockClear();
  });

  it('lắp limiter masterGain → compressor → loa với đúng thông số', () => {
    soundEngine.initContext();
    expect(soundEngine.hasLimiter()).toBe(true);
    expect(compressorParams).toMatchObject({
      threshold: LIMITER.threshold,
      ratio: LIMITER.ratio,
      attack: LIMITER.attack,
      release: LIMITER.release,
    });
    expect(LIMITER).toMatchObject({ threshold: -10, ratio: 12, attack: 0.002, release: 0.08 });
  });

  it('gỡ gói cũ NGAY khi bắt đầu đổi: gõ trong lúc chờ không ra tiếng phím cũ', async () => {
    await soundEngine.loadPack('pack-a');
    soundEngine.playKeySound('KeyA');
    expect(started.at(-1)).toMatch(/^pack-a\//);

    const pending = soundEngine.loadPack('slow');
    expect(soundEngine.getLoadedPackId()).toBeNull();
    started.length = 0;
    soundEngine.playKeySound('KeyA');
    expect(started).toEqual([]);
    // Trong lúc chờ: tiếng tổng hợp theo plate/switch của mẫu mới
    expect(oscillators).toHaveBeenCalled();

    // Gói "slow" về xong thì mới phát gói mới
    await vi.waitFor(() => expect(releaseSlow).not.toBeNull());
    releaseSlow?.();
    await pending;
    expect(soundEngine.getLoadedPackId()).toBe('slow');
    releaseSlow = null;
  });

  it('bấm nhiều phím liên tiếp: huỷ request cũ bằng AbortController, chỉ gói cuối được dùng', async () => {
    const first = soundEngine.loadPack('slow-2');
    await vi.waitFor(() => expect(releaseSlow).not.toBeNull());
    const second = soundEngine.loadPack('pack-b');
    expect(signals.get('slow-2')?.aborted).toBe(true);
    await expect(first).resolves.toBeNull();
    await second;
    expect(soundEngine.getLoadedPackId()).toBe('pack-b');
    releaseSlow = null;
  });

  it('gói đã nghe nằm trong cache: đổi lại không tải/giải mã lại, có tiếng ngay', async () => {
    await soundEngine.loadPack('pack-a');
    await soundEngine.loadPack('pack-b');
    const calls = fetchMock.mock.calls.length;
    expect(soundEngine.isPackCached('pack-a')).toBe(true);

    const back = soundEngine.loadPack('pack-a');
    // Gói trong cache được gắn đồng bộ, trước cả khi promise trả về
    expect(soundEngine.getLoadedPackId()).toBe('pack-a');
    await back;
    expect(fetchMock.mock.calls.length).toBe(calls);
    soundEngine.playKeySound('KeyA');
    expect(started.at(-1)).toMatch(/^pack-a\//);
  });

  it('gói không tồn tại: báo lỗi, không giữ tiếng gói trước mà quay về tiếng tổng hợp', async () => {
    await soundEngine.loadPack('pack-a');
    await expect(soundEngine.loadPack('missing')).rejects.toThrow(/missing/);
    expect(soundEngine.getLoadedPackId()).toBeNull();
    soundEngine.playKeySound('KeyA');
    expect(started).toEqual([]);
    expect(oscillators).toHaveBeenCalled();
  });

  it(`giới hạn ${MAX_VOICES} tiếng cùng lúc: tiếng cũ nhất bị tắt dần rồi dừng`, async () => {
    await soundEngine.loadPack('pack-a');
    for (let i = 0; i < 20; i++) soundEngine.playKeySound('KeyA');
    expect(started).toHaveLength(20);
    expect(soundEngine.getActiveVoiceCount()).toBeLessThanOrEqual(MAX_VOICES);
    // Ít nhất 12 tiếng cũ bị cắt (cộng thêm tiếng còn ngân từ các test trước)
    expect(stopped.length).toBeGreaterThanOrEqual(20 - MAX_VOICES);
  });

  it('chống dính tiếng: cùng phím < 22ms và phím bất kỳ < 12ms bị bỏ (Unikey bắn Backspace + ký tự)', async () => {
    await soundEngine.loadPack('pack-a');
    soundEngine.setPressGate();
    const now = vi.spyOn(performance, 'now');
    const at = (ms: number, code: string) => {
      now.mockReturnValue(ms);
      soundEngine.playKeySound(code);
    };
    at(10_000, 'KeyA'); // phát
    at(10_001, 'Backspace'); // bộ gõ bắn dồn: bỏ
    at(10_015, 'KeyA'); // cùng phím < 22ms: bỏ
    at(10_040, 'KeyB'); // phát
    at(10_090, 'KeyA'); // phát
    expect(started).toHaveLength(3);
    now.mockRestore();
  });

  it('cân bằng âm lượng: phím cách thu quá to bị kéo về ≤ 1.15× phím thường, tiếng nhả dịu hơn', async () => {
    await soundEngine.loadPack('boomy');
    const gains = soundEngine.getPackGains();
    expect(gains).not.toBeNull();
    const alphaLevel = measureLevel(fakeBuffer('alpha-01.wav').getChannelData(), SAMPLE_RATE);
    const spaceLevel = measureLevel(fakeBuffer('loud-space.wav').getChannelData(), SAMPLE_RATE);
    const spaceOut = spaceLevel.rms * (gains?.space[0] ?? 0);
    expect(spaceOut).toBeLessThanOrEqual(alphaLevel.rms * SPACE_CEILING + 1e-6);
    expect(spaceOut).toBeGreaterThan(alphaLevel.rms * 0.9);
    // Phím thường ở mức trung vị giữ nguyên tiếng gốc (gain ≈ 1)
    expect(gains?.alpha[0]).toBeCloseTo(1, 2);
    expect(gains?.up[0]).toBeLessThanOrEqual(LOUDNESS_TARGET.up + 1e-6);
  });
});
