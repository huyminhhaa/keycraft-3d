import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  INTRO,
  MAX_FRAME_DELTA,
  TURNTABLE_SPEED,
  easeOutCubic,
  introPose,
  orbitAroundY,
  posedPosition,
  prefersReducedMotion,
  stepColorToward,
  turntableStep,
} from './cinematic';
import { useStageStore } from '@/store/useStageStore';

describe('Chuyển động điện ảnh', () => {
  it('easeOutCubic đi từ 0 tới 1, kẹp biên và không vượt đích', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('cảnh mở đầu bắt đầu lệch góc và xa hơn, kết thúc đúng vị trí đích', () => {
    const start = introPose(0);
    expect(start.azimuth).toBe(INTRO.azimuth);
    expect(start.distanceScale).toBeCloseTo(INTRO.distance, 6);
    const end = introPose(INTRO.duration);
    expect(end.azimuth).toBeCloseTo(0, 10);
    expect(end.distanceScale).toBe(1);
  });

  it('posedPosition giữ nguyên vị trí khi không lệch và kéo xa đúng tỉ lệ', () => {
    const goal = new THREE.Vector3(0, 6, 6);
    const target = new THREE.Vector3(0, 0.2, 0);
    expect(posedPosition(goal, target, { azimuth: 0, distanceScale: 1 }).distanceTo(goal)).toBeCloseTo(0, 6);
    const far = posedPosition(goal, target, { azimuth: 0.5, distanceScale: 2 });
    expect(far.distanceTo(target)).toBeCloseTo(goal.distanceTo(target) * 2, 6);
  });

  it('bàn xoay tính theo thời gian: 60Hz và 120Hz xoay cùng một góc mỗi giây', () => {
    const at60 = Array.from({ length: 60 }, () => turntableStep(1 / 60)).reduce((a, b) => a + b, 0);
    const at120 = Array.from({ length: 120 }, () => turntableStep(1 / 120)).reduce((a, b) => a + b, 0);
    expect(at60).toBeCloseTo(TURNTABLE_SPEED, 6);
    expect(at120).toBeCloseTo(at60, 6);
  });

  it('khung hình trễ lâu (tab ẩn) không làm mô hình giật góc lớn', () => {
    expect(turntableStep(10)).toBeCloseTo(TURNTABLE_SPEED * MAX_FRAME_DELTA, 6);
    expect(turntableStep(-1)).toBe(0);
  });

  it('orbitAroundY giữ nguyên khoảng cách và độ cao so với tâm nhìn', () => {
    const target = new THREE.Vector3(0, 0.2, 0);
    const position = new THREE.Vector3(0, 6, 6);
    const before = position.distanceTo(target);
    orbitAroundY(position, target, Math.PI / 2);
    expect(position.distanceTo(target)).toBeCloseTo(before, 6);
    expect(position.y).toBeCloseTo(6, 6);
    expect(position.x).toBeCloseTo(6, 6);
  });

  it('stepColorToward tiến dần và chốt đúng màu đích', () => {
    const current = new THREE.Color('#000000');
    const target = new THREE.Color('#ffffff');
    expect(stepColorToward(current, target, 0.5)).toBe(false);
    expect(current.r).toBeCloseTo(0.5, 5);
    expect(stepColorToward(current, target, 1)).toBe(true);
    expect(current.equals(target)).toBe(true);
  });

  it('prefersReducedMotion trả về false khi môi trường không có matchMedia', () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('useStageStore', () => {
  beforeEach(() => useStageStore.setState({ autoRotate: true, introDone: false, highQuality: true }));

  it('chất lượng cao bật mặc định và hạ được khi máy yếu', () => {
    expect(useStageStore.getState().highQuality).toBe(true);
    useStageStore.getState().setHighQuality(false);
    expect(useStageStore.getState().highQuality).toBe(false);
  });

  it('bàn xoay bật mặc định, bật/tắt được', () => {
    expect(useStageStore.getState().autoRotate).toBe(true);
    useStageStore.getState().toggleAutoRotate();
    expect(useStageStore.getState().autoRotate).toBe(false);
    useStageStore.getState().setAutoRotate(true);
    expect(useStageStore.getState().autoRotate).toBe(true);
  });

  it('đánh dấu cảnh mở đầu đã xong', () => {
    useStageStore.getState().setIntroDone(true);
    expect(useStageStore.getState().introDone).toBe(true);
  });
});
