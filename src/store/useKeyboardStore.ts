import { create } from 'zustand';
import {
  KeyboardStore,
  KeyboardState,
  PlateMaterial,
  SwitchType,
  SoundProfile,
} from '@/types/keyboard';
import { DEFAULT_MODEL_ID, getModelEntry } from '@/lib/keyboard/models';

export const calculateSoundProfile = (
  plate: PlateMaterial,
  switchType: SwitchType
): SoundProfile => {
  // Hệ số tần số âm sắc dựa trên độ cứng của Plate
  let platePitch = 1.0;
  let plateResonance = 1.0;
  let plateDamping = 0.7;

  switch (plate) {
    case 'aluminum':
      platePitch = 1.25;
      plateResonance = 1.15;
      plateDamping = 0.85;
      break;
    case 'fr4':
      platePitch = 1.0;
      plateResonance = 1.2;
      plateDamping = 0.7;
      break;
    case 'pom':
      platePitch = 0.85;
      plateResonance = 1.35;
      plateDamping = 0.55;
      break;
    case 'polycarbonate':
      platePitch = 0.8;
      plateResonance = 1.4;
      plateDamping = 0.5;
      break;
  }

  // Điều chỉnh theo đặc tính Switch
  let switchPitchMod = 1.0;
  let labelTag = 'Balanced';

  switch (switchType) {
    case 'linear':
      switchPitchMod = 1.0;
      labelTag = platePitch < 1.0 ? 'Deep Thock Linear' : 'Crisp Clack Linear';
      break;
    case 'tactile':
      switchPitchMod = 1.08;
      labelTag = 'Bumpy Thock Tactile';
      break;
    case 'clicky':
      switchPitchMod = 1.4;
      plateResonance *= 1.2;
      labelTag = 'Sharp High-Pitched Clicky';
      break;
    case 'silent_linear':
      switchPitchMod = 0.75;
      plateDamping = 0.2;
      labelTag = 'Muted Whisper Silent';
      break;
  }

  return {
    pitchMultiplier: Number((platePitch * switchPitchMod).toFixed(2)),
    damping: Number(plateDamping.toFixed(2)),
    resonance: Number(plateResonance.toFixed(2)),
    label: labelTag,
  };
};

// Cấu hình mặc định: TKL vỏ nhôm đỏ, plate FR4, keycap đỏ hai tông, đèn hông màu hổ phách
export const INITIAL_KEYBOARD_STATE: KeyboardState = {
  modelId: DEFAULT_MODEL_ID,
  layout: 'TKL',
  isExploded: false,
  explosionOffset: 1.5,
  plateMaterial: 'fr4',
  caseMaterial: 'aluminum',
  switchType: 'linear',
  keycapColor: '#7c1521',
  keycapModifierColor: '#c41f2d',
  keycapAccentColor: '#efebe3',
  caseColor: '#b3141f',
  underglowColor: '#ff9a3c',
  underglowBrightness: 0.7,
  underglowEnabled: true,
  cameraPreset: 'perspective',
  soundProfile: calculateSoundProfile('fr4', 'linear'),
};

export const useKeyboardStore = create<KeyboardStore>((set) => ({
  ...INITIAL_KEYBOARD_STATE,

  setModel: (modelId) => {
    const entry = getModelEntry(modelId);
    set(entry.source === 'glb' ? { modelId: entry.id, layout: entry.layout } : { modelId: entry.id });
  },

  // Mẫu .glb có layout cố định: chỉ mẫu dựng bằng code mới đổi được layout
  setLayout: (layout) => set((state) => (getModelEntry(state.modelId).source === 'glb' ? {} : { layout })),

  toggleExploded: () =>
    set((state) => ({
      isExploded: !state.isExploded,
    })),

  setExploded: (isExploded) => set({ isExploded }),

  setExplosionOffset: (offset) =>
    set({
      explosionOffset: Math.max(0.5, Math.min(3.0, offset)),
    }),

  setPlateMaterial: (material) =>
    set((state) => ({
      plateMaterial: material,
      soundProfile: calculateSoundProfile(material, state.switchType),
    })),

  setCaseMaterial: (material) => set({ caseMaterial: material }),

  setSwitchType: (switchType) =>
    set((state) => ({
      switchType,
      soundProfile: calculateSoundProfile(state.plateMaterial, switchType),
    })),

  setKeycapColor: (color) => set({ keycapColor: color }),

  setKeycapModifierColor: (color) => set({ keycapModifierColor: color }),

  setKeycapAccentColor: (color) => set({ keycapAccentColor: color }),

  setCaseColor: (color) => set({ caseColor: color }),

  setUnderglowColor: (color) => set({ underglowColor: color }),

  setUnderglowBrightness: (brightness) =>
    set({
      underglowBrightness: Math.max(0, Math.min(1, brightness)),
    }),

  setUnderglowEnabled: (enabled) => set({ underglowEnabled: enabled }),

  setCameraPreset: (preset) => set({ cameraPreset: preset }),

  resetConfig: () => set(INITIAL_KEYBOARD_STATE),

  applyAIConfig: (partial) =>
    set((state) => {
      const nextPlate = partial.plateMaterial ?? state.plateMaterial;
      const nextSwitch = partial.switchType ?? state.switchType;
      const nextBrightness =
        partial.underglowBrightness !== undefined
          ? Math.max(0, Math.min(1, partial.underglowBrightness))
          : state.underglowBrightness;
      const nextOffset =
        partial.explosionOffset !== undefined
          ? Math.max(0.5, Math.min(3.0, partial.explosionOffset))
          : state.explosionOffset;

      const needsSoundUpdate =
        partial.plateMaterial !== undefined || partial.switchType !== undefined;

      return {
        ...partial,
        // Mẫu .glb giữ layout của file dù AI đề xuất layout khác
        layout: getModelEntry(partial.modelId ?? state.modelId).source === 'glb' ? state.layout : (partial.layout ?? state.layout),
        underglowBrightness: nextBrightness,
        explosionOffset: nextOffset,
        soundProfile: needsSoundUpdate
          ? calculateSoundProfile(nextPlate, nextSwitch)
          : (partial.soundProfile ?? state.soundProfile),
      };
    }),
}));
