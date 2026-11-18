/**
 * KeyCraft 3D - Bộ phát tiếng gõ phím
 * -----------------------------------------------------------------------------
 * Ưu tiên phát **bản thu thật** (gói âm thanh cắt từ video sound test, xem soundPacks.ts và
 * scripts/sounds/make-pack.ts): mỗi lần gõ chọn ngẫu nhiên một biến thể, lệch nhẹ tốc độ/âm lượng
 * để không nghe như súng máy; nhả phím phát tiếng nhả.
 *
 * Chưa có gói nào (chưa chạy `npm run sounds`) thì dùng bộ tổng hợp procedural bên dưới:
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
import {
  SOUND_ROOT,
  packManifestSchema,
  pickVariant,
  planForKey,
  type PackManifest,
  type SoundCategory,
} from './soundPacks';
import { computeClipGains, measureLevel, type ClipLevel } from './loudness';
import { DEFAULT_PRESS_GATE, createPressGate, type PressGate, type PressGateOptions } from './pressGate';

export interface LoadedPack {
  id: string;
  manifest: PackManifest;
  buffers: Record<SoundCategory, AudioBuffer[]>;
  /** Gain cân bằng âm lượng của từng đoạn (loudness.ts) */
  gains: Record<SoundCategory, number[]>;
}

const CATEGORIES: SoundCategory[] = ['alpha', 'space', 'up'];
/** Số gói giữ trong RAM: đổi qua lại giữa các phím đã nghe là có tiếng ngay (0ms) */
export const PACK_CACHE_LIMIT = 12;
/** Số tiếng phát cùng lúc tối đa; vượt thì tắt dần tiếng cũ nhất trong 10ms */
export const MAX_VOICES = 8;
const VOICE_FADE_SECONDS = 0.01;

/** Limiter trước loa: gõ dồn nhiều phím không cộng biên độ thành tiếng nổ */
export const LIMITER = { threshold: -10, knee: 4, ratio: 12, attack: 0.002, release: 0.08 } as const;

interface Voice {
  gain: GainNode;
  endsAt: number;
  stop: (when: number) => void;
}

const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

const levelOf = (buffer: AudioBuffer): ClipLevel =>
  typeof buffer.getChannelData === 'function' ? measureLevel(buffer.getChannelData(0), buffer.sampleRate) : { rms: 0, peak: 0 };

export interface SoundEngineOptions {
  volume?: number; // 0.0 -> 1.0 (mặc định 0.7)
  muted?: boolean;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private volume: number = 0.7;
  private muted: boolean = false;
  private initialized: boolean = false;
  private pack: LoadedPack | null = null;
  /** Gói đã giải mã, xếp theo lần dùng gần nhất (LRU) */
  private packCache = new Map<string, LoadedPack>();
  /** Lần tải đang chạy: đổi phím khác thì huỷ ngay */
  private loadController: AbortController | null = null;
  /** Mỗi lần gọi loadPack tăng số này: kết quả của lần gọi cũ về muộn thì bỏ */
  private packRequest = 0;
  private lastVariant: Record<SoundCategory, number> = { alpha: -1, space: -1, up: -1 };
  private voices: Voice[] = [];
  private downGate: PressGate = createPressGate();
  private upGate: PressGate = createPressGate();

  constructor(options?: SoundEngineOptions) {
    if (options?.volume !== undefined) this.volume = Math.max(0, Math.min(1, options.volume));
    if (options?.muted !== undefined) this.muted = options.muted;
  }

  /** Đổi ngưỡng chống dính tiếng (test đặt 0 để phát liên tục) */
  public setPressGate(options: PressGateOptions = DEFAULT_PRESS_GATE): void {
    this.downGate = createPressGate(options);
    this.upGate = createPressGate(options);
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
        // masterGain → limiter → loa
        if (typeof this.ctx.createDynamicsCompressor === 'function') {
          const limiter = this.ctx.createDynamicsCompressor();
          const now = this.ctx.currentTime;
          limiter.threshold.setValueAtTime(LIMITER.threshold, now);
          limiter.knee.setValueAtTime(LIMITER.knee, now);
          limiter.ratio.setValueAtTime(LIMITER.ratio, now);
          limiter.attack.setValueAtTime(LIMITER.attack, now);
          limiter.release.setValueAtTime(LIMITER.release, now);
          this.masterGain.connect(limiter);
          limiter.connect(this.ctx.destination);
          this.limiter = limiter;
        } else {
          this.masterGain.connect(this.ctx.destination);
        }
        this.initialized = true;
      } catch {
        return null;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      // Chưa có thao tác của người dùng thì trình duyệt từ chối resume: lần gõ phím kế tiếp sẽ thử lại
      this.ctx.resume().catch(() => undefined);
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

  /* ------------------------------------------------------------------------ */
  /* Bản thu thật                                                              */
  /* ------------------------------------------------------------------------ */

  /**
   * Chuyển sang gói tiếng `id` (`null` = bỏ gói, dùng tiếng tổng hợp).
   * - Gói cũ bị gỡ NGAY khi gọi: trong lúc chờ gói mới, gõ phím ra tiếng tổng hợp khớp plate/switch
   *   của phím mới (store đã đổi), không bao giờ ra tiếng của phím cũ.
   * - Gói đã nghe rồi nằm trong cache RAM: đổi lại là có tiếng ngay, không tải/giải mã lại.
   * - Lần tải trước còn dở thì huỷ (AbortController), kết quả về muộn bị bỏ qua.
   * Trả về manifest; `null` khi bỏ gói hoặc lần tải đã bị lần gọi sau thay thế.
   */
  public async loadPack(id: string | null): Promise<PackManifest | null> {
    const request = ++this.packRequest;
    this.loadController?.abort();
    this.loadController = null;
    this.pack = null;
    this.lastVariant = { alpha: -1, space: -1, up: -1 };
    if (!id) return null;

    const cached = this.packCache.get(id);
    if (cached) {
      // Đưa lên cuối Map: gói vừa dùng là gói "mới nhất" của LRU
      this.packCache.delete(id);
      this.packCache.set(id, cached);
      this.pack = cached;
      return cached.manifest;
    }

    const ctx = this.initContext();
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ Web Audio');
    const controller = new AbortController();
    this.loadController = controller;

    try {
      const loaded = await this.fetchPack(id, ctx, controller.signal);
      this.remember(loaded);
      if (request !== this.packRequest) return null;
      this.loadController = null;
      this.pack = loaded;
      return loaded.manifest;
    } catch (error) {
      if (isAbort(error) || request !== this.packRequest) return null;
      if (this.loadController === controller) this.loadController = null;
      throw error;
    }
  }

  private async fetchPack(id: string, ctx: AudioContext, signal: AbortSignal): Promise<LoadedPack> {
    const response = await fetch(`${SOUND_ROOT}/${id}/pack.json`, { signal });
    if (!response.ok) throw new Error(`Không tìm thấy gói âm thanh "${id}"`);
    const manifest = packManifestSchema.parse(await response.json());

    const decode = async (file: string): Promise<AudioBuffer> => {
      const clip = await fetch(`${SOUND_ROOT}/${id}/${file}`, { signal });
      if (!clip.ok) throw new Error(`Thiếu file ${file} trong gói "${id}"`);
      const data = await clip.arrayBuffer();
      signal.throwIfAborted();
      return ctx.decodeAudioData(data);
    };
    const [alpha, space, up] = await Promise.all(CATEGORIES.map((category) => Promise.all(manifest.clips[category].map(decode))));
    signal.throwIfAborted();
    const buffers = { alpha, space, up };
    const gains = computeClipGains({
      alpha: alpha.map(levelOf),
      space: space.map(levelOf),
      up: up.map(levelOf),
    });
    return { id, manifest, buffers, gains };
  }

  private remember(pack: LoadedPack): void {
    this.packCache.delete(pack.id);
    this.packCache.set(pack.id, pack);
    while (this.packCache.size > PACK_CACHE_LIMIT) {
      const oldest = this.packCache.keys().next().value;
      if (oldest === undefined || oldest === this.pack?.id) break;
      this.packCache.delete(oldest);
    }
  }

  public getLoadedPackId(): string | null {
    return this.pack?.id ?? null;
  }

  public isPackCached(id: string): boolean {
    return this.packCache.has(id);
  }

  /** Gain cân bằng của gói đang phát (để kiểm tra/hiển thị) */
  public getPackGains(): Record<SoundCategory, number[]> | null {
    return this.pack ? this.pack.gains : null;
  }

  /** Đã lắp limiter (DynamicsCompressor) trước loa chưa */
  public hasLimiter(): boolean {
    return this.limiter !== null;
  }

  public getActiveVoiceCount(): number {
    this.pruneVoices();
    return this.voices.length;
  }

  /* ------------------------------------------------------------------------ */
  /* Giới hạn số tiếng phát cùng lúc                                          */
  /* ------------------------------------------------------------------------ */

  private pruneVoices(): void {
    const now = this.ctx?.currentTime ?? 0;
    this.voices = this.voices.filter((voice) => voice.endsAt > now);
  }

  /** Tạo nút gain cho một tiếng mới; quá MAX_VOICES thì tắt dần tiếng cũ nhất trong 10ms rồi dừng. */
  private openVoice(duration: number, stop: Voice['stop']): GainNode | null {
    if (!this.ctx || !this.masterGain) return null;
    this.pruneVoices();
    const now = this.ctx.currentTime;
    while (this.voices.length >= MAX_VOICES) {
      const oldest = this.voices.shift();
      if (!oldest) break;
      const param = oldest.gain.gain;
      if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(0, now + VOICE_FADE_SECONDS);
      oldest.stop(now + VOICE_FADE_SECONDS + 0.002);
    }
    const gain = this.ctx.createGain();
    gain.connect(this.masterGain);
    this.voices.push({ gain, endsAt: now + duration, stop });
    return gain;
  }

  /** Phát một biến thể của nhóm; false nếu chưa có gói hoặc nhóm rỗng. */
  private playSample(category: SoundCategory, rate: number): boolean {
    const pack = this.pack;
    const list = pack?.buffers[category];
    if (!pack || !list || list.length === 0 || !this.ctx || !this.masterGain) return false;

    const index = pickVariant(list.length, this.lastVariant[category]);
    this.lastVariant[category] = index;

    const source = this.ctx.createBufferSource();
    source.buffer = list[index];
    // Lệch ±1.5% tốc độ và tới −8% âm lượng: hai lần gõ cùng một đoạn vẫn nghe khác nhau chút ít như tay người
    const playbackRate = rate * (0.985 + Math.random() * 0.03);
    source.playbackRate.value = playbackRate;
    const duration = (list[index].duration || 0.4) / playbackRate;
    const amp = this.openVoice(duration, (when) => {
      try {
        source.stop(when);
      } catch {
        // Đã dừng
      }
    });
    if (!amp) return false;
    amp.gain.value = (pack.gains[category][index] ?? 1) * (0.92 + Math.random() * 0.08);
    source.connect(amp);
    source.start();
    return true;
  }

  /** Tiếng nhả phím (chỉ có khi gói có bản thu tiếng nhả). */
  public playKeyUp(code = 'Key'): void {
    if (this.muted || !this.pack) return;
    if (!this.initContext()) return;
    if (!this.upGate(code, performance.now())) return;
    this.playSample('up', 1);
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
    // Chống dính tiếng: cùng phím < 22ms hoặc phím bất kỳ < 12ms (bộ gõ tiếng Việt bắn dồn sự kiện)
    if (!this.downGate(code, performance.now())) return;

    // Có bản thu thật thì phát bản thu. customConfig (trang giới thiệu so sánh plate) vẫn dùng tiếng tổng hợp.
    if (this.pack && !customConfig) {
      const buffers = this.pack.buffers;
      const plan = planForKey(code, { alpha: buffers.alpha.length, space: buffers.space.length, up: buffers.up.length });
      if (this.playSample(plan.category, plan.rate)) return;
    }

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

    // Mọi lớp của một lần gõ đi qua chung một "voice": bị giới hạn số tiếng như bản thu thật
    const nodes: AudioScheduledSourceNode[] = [];
    const voice = this.openVoice(decayTime + 0.04, (when) =>
      nodes.forEach((node) => {
        try {
          node.stop(when);
        } catch {
          // Đã dừng
        }
      })
    );
    if (!voice) return;

    // =========================================================================
    // 2. LAYER 1: SÓNG BOTTOM-OUT IMPACT (Va đập đáy Switch + Plate)
    // =========================================================================
    const osc = ctx.createOscillator();
    nodes.push(osc);
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
    oscGain.connect(voice);

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
      nodes.push(noiseSource);

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(plate === 'aluminum' ? 2200 : 1400, now);

      const noiseGain = ctx.createGain();
      const noiseVol = (plate === 'aluminum' ? 0.18 : 0.1) * gainJitter;
      noiseGain.gain.setValueAtTime(noiseVol, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(voice);

      noiseSource.start(now);
      noiseSource.stop(now + 0.03);
    }

    // =========================================================================
    // 4. LAYER 3: CLICKY / TACTILE SPECIAL IMPULSES
    // =========================================================================
    if (swType === 'clicky') {
      // Tiếng "Click" đặc trưng của lá đồng kim loại (Click Jacket / Click Bar)
      const clickOsc = ctx.createOscillator();
      nodes.push(clickOsc);
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
      clickGain.connect(voice);

      clickOsc.start(now);
      clickOsc.stop(now + 0.02);
    } else if (swType === 'tactile') {
      // Tiếng vượt khấc tactile bump (Một xung tần số thấp nhẹ đi trước 4ms)
      const bumpOsc = ctx.createOscillator();
      nodes.push(bumpOsc);
      const bumpGain = ctx.createGain();

      bumpOsc.type = 'sine';
      bumpOsc.frequency.setValueAtTime(180 * jitter, now);

      bumpGain.gain.setValueAtTime(0.001, now);
      bumpGain.gain.linearRampToValueAtTime(0.2 * gainJitter, now + 0.004);
      bumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

      bumpOsc.connect(bumpGain);
      bumpGain.connect(voice);

      bumpOsc.start(now);
      bumpOsc.stop(now + 0.025);
    }
  }
}

// Singleton Audio Synthesizer Engine
export const soundEngine = new SoundEngine();
