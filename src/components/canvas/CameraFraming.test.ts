import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  DESKTOP_PANEL_SPACE,
  MOBILE_SHEET_RATIO,
  applyFraming,
  computeFraming,
  computeViewOffset,
  resetFraming,
} from './CameraFraming';

/** Vị trí (px, toạ độ viewport) của trục camera sau khi cắt sub-window. */
const axisOnScreen = (size: { width: number; height: number }) => {
  const view = computeViewOffset(size, computeFraming(size));
  return {
    x: view.fullWidth / 2 - view.x,
    y: view.fullHeight / 2 - view.y,
  };
};

describe('CameraFraming (lens shift)', () => {
  it('desktop: tâm mô hình rơi vào giữa vùng trống bên trái panel', () => {
    const size = { width: 1440, height: 900 };
    const axis = axisOnScreen(size);
    expect(axis.x).toBe((size.width - DESKTOP_PANEL_SPACE) / 2);
    expect(axis.y).toBeGreaterThan(size.height / 2);
  });

  it('mobile: tâm mô hình nằm giữa vùng phía trên bottom sheet', () => {
    const size = { width: 390, height: 844 };
    const axis = axisOnScreen(size);
    expect(axis.x).toBe(size.width / 2);
    expect(axis.y).toBeCloseTo((size.height * (1 - MOBILE_SHEET_RATIO)) / 2, 0);
  });

  it('aspect theo khung đầy đủ và camera.zoom bù đúng độ phóng do cắt', () => {
    const size = { width: 390, height: 844 };
    const framing = computeFraming(size);
    const view = computeViewOffset(size, framing);
    expect(view.aspect).toBeCloseTo(view.fullWidth / view.fullHeight, 6);
    // Độ phóng thực tế = cameraZoom × fullHeight / height phải bằng framing.zoom
    expect(view.cameraZoom * (view.fullHeight / size.height)).toBeCloseTo(framing.zoom, 6);
  });

  it('zoom được kẹp trong [0.35, 1.05] và co lại trên màn hình hẹp', () => {
    const wide = computeFraming({ width: 2560, height: 1080 });
    const laptop = computeFraming({ width: 1440, height: 900 });
    const phone = computeFraming({ width: 390, height: 844 });
    expect(wide.zoom).toBeLessThanOrEqual(1.05);
    expect(phone.zoom).toBeGreaterThanOrEqual(0.35);
    expect(laptop.zoom).toBeLessThan(1);
    expect(phone.zoom).toBeLessThan(laptop.zoom);
  });

  it('cờ isDesktop tường minh thắng bề rộng canvas (canvas hụt vài px do thanh cuộn)', () => {
    const framing = computeFraming({ width: 1009, height: 768 }, true);
    expect(framing.offsetX).toBe(DESKTOP_PANEL_SPACE / 2);
    expect(framing.offsetY).toBeGreaterThan(0);
  });

  it('kích thước 0 trả về framing trung tính', () => {
    expect(computeFraming({ width: 0, height: 0 })).toEqual({ offsetX: 0, offsetY: 0, zoom: 1 });
  });

  it('applyFraming / resetFraming bật và gỡ view offset trên PerspectiveCamera thật', () => {
    const camera = new THREE.PerspectiveCamera(42, 1440 / 900, 0.1, 100);
    const size = { width: 1440, height: 900 };

    const view = applyFraming(camera, size);
    expect(camera.view?.enabled).toBe(true);
    expect(camera.view?.offsetX).toBe(view.x);
    expect(camera.aspect).toBeCloseTo(view.aspect, 6);
    expect(camera.zoom).toBeCloseTo(view.cameraZoom, 6);

    resetFraming(camera, size);
    expect(camera.view === null || camera.view.enabled === false).toBe(true);
    expect(camera.zoom).toBe(1);
    expect(camera.aspect).toBeCloseTo(1440 / 900, 6);
  });
});
