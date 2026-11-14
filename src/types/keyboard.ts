export type KeyboardLayout = '65%' | '75%' | 'TKL';

export type PlateMaterial = 'aluminum' | 'polycarbonate' | 'pom' | 'fr4';

export type CaseMaterial = 'aluminum' | 'polycarbonate' | 'wood' | 'acrylic';

export type SwitchType = 'linear' | 'tactile' | 'clicky' | 'silent_linear';

export type CameraPreset = 'perspective' | 'top' | 'front' | 'side' | 'isometric';

export interface SoundProfile {
  pitchMultiplier: number;
  damping: number;
  resonance: number;
  label: string;
}

export interface KeyboardState {
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
