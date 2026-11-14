import { create } from 'zustand';
import {
  KeyboardStore,
  KeyboardState,
  PlateMaterial,
  SwitchType,
  SoundProfile,
} from '@/types/keyboard';

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

export const INITIAL_KEYBOARD_STATE: KeyboardState = {
  layout: '75%',
  isExploded: false,
  explosionOffset: 1.5,
  plateMaterial: 'aluminum',
  caseMaterial: 'aluminum',
  switchType: 'linear',
  keycapColor: '#1e293b',
  keycapAccentColor: '#3b82f6',
  caseColor: '#0f172a',
  underglowColor: '#00f0ff',
  underglowBrightness: 0.8,
  underglowEnabled: true,
  cameraPreset: 'perspective',
  soundProfile: calculateSoundProfile('aluminum', 'linear'),
};

export const useKeyboardStore = create<KeyboardStore>((set) => ({
  ...INITIAL_KEYBOARD_STATE,

  setLayout: (layout) => set({ layout }),

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
        underglowBrightness: nextBrightness,
        explosionOffset: nextOffset,
        soundProfile: needsSoundUpdate
          ? calculateSoundProfile(nextPlate, nextSwitch)
          : (partial.soundProfile ?? state.soundProfile),
      };
    }),
}));
