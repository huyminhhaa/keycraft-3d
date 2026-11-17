export type KeyboardLayout = '65%' | '75%' | 'TKL' | '96%';

export const KEYBOARD_LAYOUTS: readonly KeyboardLayout[] = ['65%', '75%', 'TKL', '96%'];

/** Dáng vỏ theo từng mẫu phím thật (đơn vị thế giới 3D, 1u phím = 0.38) */
export interface CaseShape {
  /** Viền vỏ quanh vùng phím */
  bezel: number;
  /** Bán kính bo góc vỏ */
  cornerRadius: number;
  /** Núm xoay thay chỗ phím cuối hàng trên cùng (AULA F75, Hi75C Pro, X85…) */
  knob: boolean;
}

export type PlateMaterial = 'aluminum' | 'polycarbonate' | 'pom' | 'fr4';

export type CaseMaterial = 'aluminum' | 'plastic' | 'polycarbonate' | 'wood' | 'acrylic';

export type SwitchType = 'linear' | 'tactile' | 'clicky' | 'silent_linear';

export type CameraPreset = 'perspective' | 'top' | 'front' | 'side' | 'isometric';

export interface SoundProfile {
  pitchMultiplier: number;
  damping: number;
  resonance: number;
  label: string;
}

export const DEFAULT_CASE_SHAPE: CaseShape = { bezel: 0.22, cornerRadius: 0.16, knob: false };

export interface KeyboardState {
  /** Mẫu bàn phím đang xem (id trong src/lib/keyboard/models.ts) */
  modelId: string;
  /**
   * Build phím thật đang áp dụng (id trong src/lib/keyboard/builds.ts), null = tự phối.
   * Tuỳ chọn để bản build đã lưu trước khi có trường này vẫn đọc được.
   */
  buildId?: string | null;
  /** Dáng vỏ; thiếu thì dùng DEFAULT_CASE_SHAPE */
  caseShape?: CaseShape;

  // Bố cục & Hình học (Layout & Geometry)
  layout: KeyboardLayout;
  isExploded: boolean;
  explosionOffset: number;

  // Chất liệu phần cứng (Materials)
  plateMaterial: PlateMaterial;
  caseMaterial: CaseMaterial;
  switchType: SwitchType;

  // Màu sắc & Thẩm mỹ (Aesthetics & RGB)
  keycapColor: string;
  /** Màu phím chức năng (Tab, Shift, Ctrl, cụm điều hướng, phím mũi tên…) */
  keycapModifierColor: string;
  keycapAccentColor: string;
  caseColor: string;
  underglowColor: string;
  underglowBrightness: number;
  underglowEnabled: boolean;

  // Không gian & Camera (3D Viewport)
  cameraPreset: CameraPreset;

  // Đặc tính âm thanh tương ứng (Acoustic Profile)
  soundProfile: SoundProfile;
}

export interface KeyboardActions {
  /** Đổi mẫu bàn phím; mẫu .glb có layout cố định nên layout đổi theo */
  setModel: (modelId: string) => void;
  /** Áp dụng một build phím thật: layout, màu, chất liệu, dáng vỏ (tiếng do useSoundStore lo) */
  applyBuild: (buildId: string) => void;
  setLayout: (layout: KeyboardLayout) => void;
  toggleExploded: () => void;
  setExploded: (isExploded: boolean) => void;
  setExplosionOffset: (offset: number) => void;
  setPlateMaterial: (material: PlateMaterial) => void;
  setCaseMaterial: (material: CaseMaterial) => void;
  setSwitchType: (switchType: SwitchType) => void;
  setKeycapColor: (color: string) => void;
  setKeycapModifierColor: (color: string) => void;
  setKeycapAccentColor: (color: string) => void;
  setCaseColor: (color: string) => void;
  setUnderglowColor: (color: string) => void;
  setUnderglowBrightness: (brightness: number) => void;
  setUnderglowEnabled: (enabled: boolean) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  resetConfig: () => void;
  applyAIConfig: (partial: Partial<KeyboardState>) => void;
}

export type KeyboardStore = KeyboardState & KeyboardActions;
