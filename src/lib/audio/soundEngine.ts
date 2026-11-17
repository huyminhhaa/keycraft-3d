/**
 * KeyCraft 3D - Procedural Web Audio Key Sound Synthesizer
 * -----------------------------------------------------------------------------
 * Bộ tổng hợp âm thanh phím cơ thời gian thực bằng Web Audio API thuần (Procedural Audio).
 * Không cần tải file audio mẫu ngoài (.mp3/.wav), độ trễ 0ms (zero-latency).
 *
 * Âm thanh được mô phỏng vật lý đa thành phần:
 * 1. Bottom-out Impact: Sóng tam giác/sin tần số thấp mô tả switch chạm đáy plate.
 * 2. Plate Resonance: Bộ lọc Bandpass filter cộng hưởng theo vật liệu (Nhôm clack vs POM thock).
 * 3. Friction & Air Release: White noise burst rất ngắn qua bộ lọc Highpass filter.
 * 4. Switch Modifier:
 *    - Clicky: Xung kim loại nảy lá đồng (Click leaf/bar) tần số 2.5kHz - 3.8kHz.
 *    - Tactile: Tiếng va khấc đôi (Double-bump impulse).
 *    - Silent: Triệt tiêu tần số cao, giảm decay 60% mô phỏng đệm cao su giảm chấn.
 *    - Phím lớn (Spacebar, Enter): Tần số trầm sâu hơn và cộng hưởng buồng khoang lớn hơn.
 */

import { PlateMaterial, SwitchType, SoundProfile } from '@/types/keyboard';
import { useKeyboardStore } from '@/store/useKeyboardStore';

export interface SoundEngineOptions {
  volume?: number; // 0.0 -> 1.0 (mặc định 0.7)
  muted?: boolean;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.7;
  private muted: boolean = false;
  private initialized: boolean = false;

  constructor(options?: SoundEngineOptions) {
    if (options?.volume !== undefined) this.volume = Math.max(0, Math.min(1, options.volume));
    if (options?.muted !== undefined) this.muted = options.muted;
  }

  /**
   * Khởi tạo AudioContext sau tương tác người dùng (User Gesture).
   * Tuân thủ triệt để Autoplay Policy của trình duyệt hiện đại (Chrome/Safari/Edge).
   */
  public initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) return null;

      try {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
      } catch {
        return null;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isReady(): boolean {
    return this.initialized && this.ctx !== null;
  }

  /**
   * Xác định xem phím có phải phím lớn (Space, Enter, Backspace, Shift) để tạo âm trầm hơn
   */
  public isLargeKey(code: string): boolean {
    const largeCodes = [
      'Space',
      'Enter',
      'NumpadEnter',
      'Backspace',
      'ShiftLeft',
      'ShiftRight',
      'CapsLock',
      'Tab',
    ];
    return largeCodes.includes(code);
  }

  /**
   * Phát âm thanh gõ phím cơ theo đặc tính vật lý hiện tại
   */
  public playKeySound(
    code: string = 'KeyA',
    customConfig?: {
      plateMaterial?: PlateMaterial;
      switchType?: SwitchType;
      soundProfile?: SoundProfile;
    }
  ): void {
    if (this.muted) return;

    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    const store = useKeyboardStore.getState();
    const plate = customConfig?.plateMaterial ?? store.plateMaterial;
    const swType = customConfig?.switchType ?? store.switchType;
    const profile = customConfig?.soundProfile ?? store.soundProfile;

    const now = ctx.currentTime;
    const isLarge = this.isLargeKey(code);

    // =========================================================================
    // 1. TÍNH TOÁN THÔNG SỐ VẬT LÝ ÂM HỌC (Acoustic Parameters)
    // =========================================================================
    // Jitter vi mô ngẫu nhiên (±2% pitch, ±5% gain) để tránh hiệu ứng machine-gun
    const jitter = 0.98 + Math.random() * 0.04;
    const gainJitter = 0.95 + Math.random() * 0.1;

    // Tần số va đập đáy cơ bản theo vật liệu plate
    let baseFreq = 420; // Chuẩn cân bằng
    let filterQ = 3.0; // Độ sắc nhọn của đỉnh cộng hưởng
    let decayTime = 0.06; // Thời gian tắt tiếng (giây)

    switch (plate) {
      case 'aluminum':
        // Plate nhôm: Đanh, cao, vang nảy (Clack)
        baseFreq = 680 * profile.pitchMultiplier * jitter;
        filterQ = 4.5;
        decayTime = 0.07 * (1.2 / profile.damping);
        break;
      case 'fr4':
        // Plate FR4: Cân bằng, giòn
        baseFreq = 520 * profile.pitchMultiplier * jitter;
        filterQ = 3.2;
        decayTime = 0.065 * (1.0 / profile.damping);
        break;
      case 'pom':
        // Plate POM: Trầm, mềm, ấm (Thock)
        baseFreq = 340 * profile.pitchMultiplier * jitter;
        filterQ = 2.2;
        decayTime = 0.08 * (1.1 / profile.damping);
        break;
      case 'polycarbonate':
        // Plate PC: Trầm sâu, êm (Deep Thock)
        baseFreq = 290 * profile.pitchMultiplier * jitter;
        filterQ = 1.8;
        decayTime = 0.085 * (1.1 / profile.damping);
        break;
    }

    // Nếu là phím lớn (Spacebar, v.v.), hạ tần số xuống 25-35% và tăng độ ngân buồng rỗng
    if (isLarge) {
      baseFreq *= 0.72;
      decayTime *= 1.25;
    }

    // Xử lý riêng cho Silent Switch
    if (swType === 'silent_linear') {
      decayTime *= 0.45; // Tắt tiếng cực nhanh
      baseFreq *= 0.8;
    }

    // =========================================================================
    // 2. LAYER 1: SÓNG BOTTOM-OUT IMPACT (Va đập đáy Switch + Plate)
    // =========================================================================
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Sóng tam giác cho âm thanh gỗ/nhựa cơ học mộc mạc, giàu họa âm
    osc.type = isLarge ? 'sine' : 'triangle';

    // Pitch envelope: Bắt đầu ở tần số cao hơn một chút rồi tụt nhanh về baseFreq
    const startFreq = baseFreq * (swType === 'clicky' ? 1.8 : 1.35);
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, baseFreq), now + 0.015);

    // Bandpass filter cộng hưởng
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq * 1.1, now);
    filter.Q.setValueAtTime(filterQ, now);

    // Gain envelope (ADSR)
    const impactVolume = (isLarge ? 0.9 : 0.75) * gainJitter;
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(impactVolume, now + 0.003); // Attack cực nhanh 3ms
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + decayTime);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + decayTime + 0.01);

    // =========================================================================
    // 3. LAYER 2: NOISE BURST (Tiếng ma sát vỏ switch & không khí)
    // =========================================================================
    if (swType !== 'silent_linear') {
      const bufferSize = Math.floor(ctx.sampleRate * 0.03); // 30ms noise
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(plate === 'aluminum' ? 2200 : 1400, now);

      const noiseGain = ctx.createGain();
      const noiseVol = (plate === 'aluminum' ? 0.18 : 0.1) * gainJitter;
      noiseGain.gain.setValueAtTime(noiseVol, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noiseSource.start(now);
      noiseSource.stop(now + 0.03);
    }

    // =========================================================================
    // 4. LAYER 3: CLICKY / TACTILE SPECIAL IMPULSES
    // =========================================================================
    if (swType === 'clicky') {
      // Tiếng "Click" đặc trưng của lá đồng kim loại (Click Jacket / Click Bar)
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      const clickFilter = ctx.createBiquadFilter();

      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(3200 * jitter, now);
      clickOsc.frequency.exponentialRampToValueAtTime(1200, now + 0.01);

      clickFilter.type = 'bandpass';
      clickFilter.frequency.setValueAtTime(3000, now);
      clickFilter.Q.setValueAtTime(6.0, now);

      clickGain.gain.setValueAtTime(0.001, now);
      clickGain.gain.linearRampToValueAtTime(0.35 * gainJitter, now + 0.001);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

      clickOsc.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(this.masterGain);

      clickOsc.start(now);
      clickOsc.stop(now + 0.02);
    } else if (swType === 'tactile') {
      // Tiếng vượt khấc tactile bump (Một xung tần số thấp nhẹ đi trước 4ms)
      const bumpOsc = ctx.createOscillator();
      const bumpGain = ctx.createGain();

      bumpOsc.type = 'sine';
      bumpOsc.frequency.setValueAtTime(180 * jitter, now);

      bumpGain.gain.setValueAtTime(0.001, now);
      bumpGain.gain.linearRampToValueAtTime(0.2 * gainJitter, now + 0.004);
      bumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

      bumpOsc.connect(bumpGain);
      bumpGain.connect(this.masterGain);

      bumpOsc.start(now);
      bumpOsc.stop(now + 0.025);
    }
  }
}

// Singleton Audio Synthesizer Engine
export const soundEngine = new SoundEngine();
