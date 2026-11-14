import { describe, it, expect } from 'vitest';
import {
  BASE_TARGET_Y,
  TARGET_FILL,
  ZOOM_RANGE,
  computeFitZoom,
  explodedTargetY,
  explodedZoomFactor,
  visibleWidthAtReference,
} from './CameraFraming';
import { getModelWidth } from './KeyboardModel';

describe('CameraFraming (tự canh khung)', () => {
  it('ở zoom tính được, bàn phím chiếm đúng TARGET_FILL bề ngang sân khấu', () => {
    const size = { width: 1080, height: 900 };
    const modelWidth = getModelWidth('TKL');
    const zoom = computeFitZoom(size, modelWidth);
    const visible = visibleWidthAtReference(size.width / size.height) / zoom;
    expect(modelWidth / visible).toBeCloseTo(TARGET_FILL, 2);
  });

  it('sân khấu hẹp (mobile) cho zoom nhỏ hơn sân khấu rộng', () => {
    const modelWidth = getModelWidth('TKL');
    expect(computeFitZoom({ width: 390, height: 420 }, modelWidth)).toBeLessThan(
      computeFitZoom({ width: 1080, height: 900 }, modelWidth)
    );
  });

  it('layout nhỏ (65%) được phóng to hơn TKL trên cùng sân khấu', () => {
    const size = { width: 1080, height: 900 };
    expect(computeFitZoom(size, getModelWidth('65%'))).toBeGreaterThan(computeFitZoom(size, getModelWidth('TKL')));
  });

  it('tách lớp thu zoom và nâng tâm nhìn; ghép lại trả về giá trị gốc', () => {
    expect(explodedZoomFactor(false, 2)).toBe(1);
    expect(explodedZoomFactor(true, 1.5)).toBeLessThan(0.7);
    expect(explodedZoomFactor(true, 3)).toBeLessThan(explodedZoomFactor(true, 1.5));
    expect(explodedTargetY(false, 3)).toBe(BASE_TARGET_Y);
    expect(explodedTargetY(true, 1.5)).toBeGreaterThan(BASE_TARGET_Y + 1);
  });

  it('zoom luôn nằm trong giới hạn và kích thước 0 trả về 1', () => {
    expect(computeFitZoom({ width: 5000, height: 300 }, 1)).toBe(ZOOM_RANGE.max);
    expect(computeFitZoom({ width: 100, height: 2000 }, 20)).toBe(ZOOM_RANGE.min);
    expect(computeFitZoom({ width: 0, height: 0 }, 7)).toBe(1);
  });
});
