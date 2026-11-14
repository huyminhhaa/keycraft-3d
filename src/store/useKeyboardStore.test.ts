import { describe, it, expect, beforeEach } from 'vitest';
import {
  useKeyboardStore,
  calculateSoundProfile,
  INITIAL_KEYBOARD_STATE,
} from './useKeyboardStore';

describe('useKeyboardStore', () => {
  beforeEach(() => {
    useKeyboardStore.getState().resetConfig();
  });

  it('khởi tạo với cấu hình mặc định chính xác', () => {
    const state = useKeyboardStore.getState();
    expect(state.layout).toBe('75%');
    expect(state.isExploded).toBe(false);
    expect(state.explosionOffset).toBe(1.5);
    expect(state.plateMaterial).toBe('aluminum');
    expect(state.caseMaterial).toBe('aluminum');
    expect(state.switchType).toBe('linear');
    expect(state.underglowEnabled).toBe(true);
    expect(state.underglowBrightness).toBe(0.8);
    expect(state.cameraPreset).toBe('perspective');
    expect(state.soundProfile.pitchMultiplier).toBeGreaterThan(1.0);
  });

  it('đổi layout sang 65% và TKL thành công', () => {
    const store = useKeyboardStore.getState();
    store.setLayout('65%');
    expect(useKeyboardStore.getState().layout).toBe('65%');

    store.setLayout('TKL');
    expect(useKeyboardStore.getState().layout).toBe('TKL');
  });

  it('toggleExploded và setExploded hoạt động chính xác', () => {
    const store = useKeyboardStore.getState();
    expect(store.isExploded).toBe(false);

    store.toggleExploded();
    expect(useKeyboardStore.getState().isExploded).toBe(true);

    store.toggleExploded();
    expect(useKeyboardStore.getState().isExploded).toBe(false);

    store.setExploded(true);
    expect(useKeyboardStore.getState().isExploded).toBe(true);
  });

  it('setExplosionOffset giới hạn khoảng cách trong ngưỡng [0.5, 3.0]', () => {
    const store = useKeyboardStore.getState();

    store.setExplosionOffset(2.2);
    expect(useKeyboardStore.getState().explosionOffset).toBe(2.2);

    // Dưới ngưỡng tối thiểu -> clamp về 0.5
    store.setExplosionOffset(0.1);
    expect(useKeyboardStore.getState().explosionOffset).toBe(0.5);

    // Vượt ngưỡng tối đa -> clamp về 3.0
    store.setExplosionOffset(5.0);
    expect(useKeyboardStore.getState().explosionOffset).toBe(3.0);
  });

  it('setPlateMaterial cập nhật chất liệu và tự động tính lại soundProfile', () => {
    const store = useKeyboardStore.getState();

    // Chuyển sang POM (âm trầm hơn aluminum)
    store.setPlateMaterial('pom');
    const pomState = useKeyboardStore.getState();
    expect(pomState.plateMaterial).toBe('pom');
    expect(pomState.soundProfile.pitchMultiplier).toBeLessThan(1.0);
    expect(pomState.soundProfile.label).toContain('Thock');

    // Chuyển sang FR4
    store.setPlateMaterial('fr4');
    expect(useKeyboardStore.getState().plateMaterial).toBe('fr4');
  });

  it('setSwitchType cập nhật switch và tự động tính lại soundProfile', () => {
    const store = useKeyboardStore.getState();

    store.setSwitchType('clicky');
    const clickyState = useKeyboardStore.getState();
    expect(clickyState.switchType).toBe('clicky');
    expect(clickyState.soundProfile.label).toContain('Clicky');

    store.setSwitchType('silent_linear');
    const silentState = useKeyboardStore.getState();
    expect(silentState.switchType).toBe('silent_linear');
    expect(silentState.soundProfile.damping).toBeLessThan(0.5);
  });

  it('setCaseMaterial cập nhật chất liệu case', () => {
    const store = useKeyboardStore.getState();
    store.setCaseMaterial('polycarbonate');
    expect(useKeyboardStore.getState().caseMaterial).toBe('polycarbonate');

    store.setCaseMaterial('wood');
    expect(useKeyboardStore.getState().caseMaterial).toBe('wood');
  });

  it('cập nhật màu sắc keycap, case và underglow RGB', () => {
    const store = useKeyboardStore.getState();

    store.setKeycapColor('#ffffff');
    store.setKeycapAccentColor('#ff0055');
    store.setCaseColor('#111827');
    store.setUnderglowColor('#a855f7');

    const updated = useKeyboardStore.getState();
    expect(updated.keycapColor).toBe('#ffffff');
    expect(updated.keycapAccentColor).toBe('#ff0055');
    expect(updated.caseColor).toBe('#111827');
    expect(updated.underglowColor).toBe('#a855f7');
  });

  it('setUnderglowBrightness giới hạn độ sáng từ 0 đến 1', () => {
    const store = useKeyboardStore.getState();

    store.setUnderglowBrightness(0.5);
    expect(useKeyboardStore.getState().underglowBrightness).toBe(0.5);

    store.setUnderglowBrightness(-0.2);
    expect(useKeyboardStore.getState().underglowBrightness).toBe(0);

    store.setUnderglowBrightness(1.5);
    expect(useKeyboardStore.getState().underglowBrightness).toBe(1);
  });

  it('setUnderglowEnabled bật/tắt đèn gầm', () => {
    const store = useKeyboardStore.getState();
    store.setUnderglowEnabled(false);
    expect(useKeyboardStore.getState().underglowEnabled).toBe(false);

    store.setUnderglowEnabled(true);
    expect(useKeyboardStore.getState().underglowEnabled).toBe(true);
  });

  it('setCameraPreset chuyển đổi góc nhìn 3D', () => {
    const store = useKeyboardStore.getState();
    store.setCameraPreset('top');
    expect(useKeyboardStore.getState().cameraPreset).toBe('top');

    store.setCameraPreset('isometric');
    expect(useKeyboardStore.getState().cameraPreset).toBe('isometric');
  });

  it('resetConfig đưa toàn bộ trạng thái về ban đầu', () => {
    const store = useKeyboardStore.getState();
    store.setLayout('TKL');
    store.setExploded(true);
    store.setPlateMaterial('pom');
    store.setKeycapColor('#ff0000');

    store.resetConfig();
    expect(useKeyboardStore.getState()).toMatchObject(INITIAL_KEYBOARD_STATE);
  });

  it('applyAIConfig cho phép cập nhật đồng thời nhiều thuộc tính từ AI Tool Call', () => {
    const store = useKeyboardStore.getState();

    store.applyAIConfig({
      plateMaterial: 'polycarbonate',
      switchType: 'tactile',
      keycapColor: '#000000',
      caseColor: '#1e1b4b',
      isExploded: true,
      underglowBrightness: 0.9,
    });

    const state = useKeyboardStore.getState();
    expect(state.plateMaterial).toBe('polycarbonate');
    expect(state.switchType).toBe('tactile');
    expect(state.keycapColor).toBe('#000000');
    expect(state.caseColor).toBe('#1e1b4b');
    expect(state.isExploded).toBe(true);
    expect(state.underglowBrightness).toBe(0.9);
    expect(state.soundProfile.label).toContain('Thock');
  });
});

describe('calculateSoundProfile helper', () => {
  it('tạo hồ sơ âm thanh đanh giòn cho plate nhôm + switch linear', () => {
    const profile = calculateSoundProfile('aluminum', 'linear');
    expect(profile.pitchMultiplier).toBe(1.25);
    expect(profile.resonance).toBe(1.15);
    expect(profile.damping).toBe(0.85);
    expect(profile.label).toContain('Clack');
  });

  it('tạo hồ sơ âm trầm thocky cho plate PC + switch linear', () => {
    const profile = calculateSoundProfile('polycarbonate', 'linear');
    expect(profile.pitchMultiplier).toBe(0.8);
    expect(profile.label).toContain('Thock');
  });
});
