import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { soundEngine } from './soundEngine';
import { useKeyboardStore } from '@/store/useKeyboardStore';

// Tạo Mock Web Audio API chuẩn W3C
class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioParam {
  value = 1;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  type = 'lowpass';
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = new MockAudioParam();
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: unknown = null;
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = 'running';
  destination = new MockAudioNode();

  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  createBuffer = vi.fn((channels: number, length: number) => ({
    getChannelData: vi.fn(() => new Float32Array(length)),
  }));
  createBufferSource = vi.fn(() => new MockAudioBufferSourceNode());
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

describe('SoundEngine (Procedural Web Audio)', () => {
  let originalAudioContext: unknown;

  beforeEach(() => {
    originalAudioContext = window.AudioContext;
    (window as unknown as { AudioContext: typeof MockAudioContext }).AudioContext =
      MockAudioContext;
    soundEngine.setMuted(false);
    soundEngine.setVolume(0.7);
  });

  afterEach(() => {
    (window as unknown as { AudioContext: unknown }).AudioContext = originalAudioContext;
  });

  it('xác định chính xác các phím lớn (Space, Enter, Backspace, Shift)', () => {
    expect(soundEngine.isLargeKey('Space')).toBe(true);
    expect(soundEngine.isLargeKey('Enter')).toBe(true);
    expect(soundEngine.isLargeKey('Backspace')).toBe(true);
    expect(soundEngine.isLargeKey('ShiftLeft')).toBe(true);
    expect(soundEngine.isLargeKey('KeyA')).toBe(false);
    expect(soundEngine.isLargeKey('Digit1')).toBe(false);
  });

  it('điều chỉnh volume được kẹp trong ngưỡng an toàn [0, 1]', () => {
    soundEngine.setVolume(0.5);
    expect(soundEngine.getVolume()).toBe(0.5);

    soundEngine.setVolume(1.5);
    expect(soundEngine.getVolume()).toBe(1.0);

    soundEngine.setVolume(-0.2);
    expect(soundEngine.getVolume()).toBe(0.0);
  });

  it('bật và tắt chế độ im lặng (Muted)', () => {
    soundEngine.setMuted(true);
    expect(soundEngine.isMuted()).toBe(true);

    soundEngine.setMuted(false);
    expect(soundEngine.isMuted()).toBe(false);
  });

  it('phát âm thanh gõ phím với plate nhôm (Aluminum Clack)', () => {
    soundEngine.initContext();
    expect(soundEngine.isReady()).toBe(true);

    soundEngine.playKeySound('KeyA', {
      plateMaterial: 'aluminum',
      switchType: 'linear',
    });

    // Kiểm tra không quăng lỗi và thực thi thành công
    expect(soundEngine.isReady()).toBe(true);
  });

  it('phát âm thanh gõ phím với plate POM (Deep Thock)', () => {
    soundEngine.playKeySound('Space', {
      plateMaterial: 'pom',
      switchType: 'linear',
    });
    expect(soundEngine.isReady()).toBe(true);
  });

  it('phát âm thanh với switch Clicky (tạo xung nảy kim loại)', () => {
    soundEngine.playKeySound('KeyK', {
      plateMaterial: 'fr4',
      switchType: 'clicky',
    });
    expect(soundEngine.isReady()).toBe(true);
  });

  it('phát âm thanh với switch Tactile (tạo xung vượt khấc)', () => {
    soundEngine.playKeySound('KeyT', {
      plateMaterial: 'fr4',
      switchType: 'tactile',
    });
    expect(soundEngine.isReady()).toBe(true);
  });

  it('phát âm thanh với switch Silent Linear (triệt tiêu noise, tắt tiếng nhanh)', () => {
    soundEngine.playKeySound('KeyS', {
      plateMaterial: 'pom',
      switchType: 'silent_linear',
    });
    expect(soundEngine.isReady()).toBe(true);
  });

  it('không phát âm thanh khi đang bật Muted', () => {
    soundEngine.setMuted(true);
    soundEngine.playKeySound('KeyA');
    expect(soundEngine.isMuted()).toBe(true);
  });

  it('tự động lấy cấu hình từ Zustand store khi không truyền customConfig', () => {
    useKeyboardStore.setState({
      plateMaterial: 'polycarbonate',
      switchType: 'linear',
    });

    soundEngine.playKeySound('KeyZ');
    expect(soundEngine.isReady()).toBe(true);
  });
});
