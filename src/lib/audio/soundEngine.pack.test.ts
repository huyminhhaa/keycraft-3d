import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { soundEngine } from './soundEngine';

/** AudioBuffer giả: chỉ cần biết đoạn nào được phát */
interface FakeBuffer {
  file: string;
}

const started: FakeBuffer[] = [];
const oscillators = vi.fn();

class Param {
  value = 1;
  setValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeContext {
  currentTime = 0;
  sampleRate = 48000;
  state: AudioContextState = 'running';
  destination = {};
  createGain = () => ({ gain: new Param(), connect: vi.fn() });
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
      stop: vi.fn(),
      start: () => {
        if (source.buffer?.file) started.push(source.buffer);
      },
    };
    return source;
  };
  decodeAudioData = async (data: ArrayBuffer) => ({ file: new TextDecoder().decode(data) });
  resume = vi.fn().mockResolvedValue(undefined);
}

const MANIFEST = {
  id: 'test-pack',
  name: 'Test',
  switch: 'Test switch',
  clips: { alpha: ['alpha-01.wav', 'alpha-02.wav'], space: ['space-01.wav'], up: ['up-01.wav'] },
};

describe('SoundEngine phát bản thu thật', () => {
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    (window as unknown as { AudioContext: typeof FakeContext }).AudioContext = FakeContext;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('pack.json')) return new Response(JSON.stringify(MANIFEST));
      if (url.includes('/sounds/test-pack/')) return new Response(url.split('/').pop());
      return new Response('', { status: 404 });
    }) as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('nạp gói rồi phát đúng nhóm tiếng theo phím, nhả phím phát tiếng nhả', async () => {
    await soundEngine.loadPack('test-pack');
    expect(soundEngine.getLoadedPackId()).toBe('test-pack');

    soundEngine.playKeySound('KeyA');
    soundEngine.playKeySound('Space');
    soundEngine.playKeyUp();
    expect(started.map((b) => b.file)).toEqual([expect.stringMatching(/^alpha-0[12]\.wav$/), 'space-01.wav', 'up-01.wav']);
    expect(oscillators).not.toHaveBeenCalled();
  });

  it('hai lần gõ liên tiếp không phát trùng một đoạn', () => {
    started.length = 0;
    for (let i = 0; i < 6; i++) soundEngine.playKeySound('KeyB');
    for (let i = 1; i < started.length; i++) expect(started[i].file).not.toBe(started[i - 1].file);
  });

  it('customConfig (trang giới thiệu so sánh plate) vẫn dùng tiếng tổng hợp', () => {
    soundEngine.playKeySound('KeyA', { plateMaterial: 'pom', switchType: 'linear' });
    expect(oscillators).toHaveBeenCalled();
  });

  it('gói không tồn tại thì báo lỗi; bỏ gói thì quay về tiếng tổng hợp', async () => {
    await expect(soundEngine.loadPack('khong-co')).rejects.toThrow(/khong-co/);
    await soundEngine.loadPack(null);
    expect(soundEngine.getLoadedPackId()).toBeNull();
  });
});
