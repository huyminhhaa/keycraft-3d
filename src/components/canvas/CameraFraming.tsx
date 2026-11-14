'use client';

import type React from 'react';
import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Lens shift điện ảnh: dời tâm khung hình (không dời camera) để mô hình nằm giữa
 * vùng trống còn lại sau khi trừ panel điều khiển (desktop) hoặc bottom sheet (mobile),
 * đồng thời co mô hình cho vừa vùng đó. OrbitControls vẫn xoay quanh tâm mô hình.
 */

export const LG_BREAKPOINT = 1024;
/** Bề rộng panel điều khiển bên phải + lề (px) */
export const DESKTOP_PANEL_SPACE = 384;
/** Tỉ lệ chiều cao màn hình bị bottom sheet chiếm trên mobile */
export const MOBILE_SHEET_RATIO = 0.46;
/** Ước lượng: ở zoom 1, bề ngang mô hình ≈ 1.0 × chiều cao viewport (fov 42°, layout 75%) */
const MODEL_WIDTH_PER_VIEWPORT_HEIGHT = 1.0;
/** Mô hình chiếm ~72% bề ngang vùng trống */
const TARGET_FILL = 0.72;

export interface ViewportSize {
  width: number;
  height: number;
}

export interface Framing {
  /** Dương = nội dung dời sang TRÁI (px) */
  offsetX: number;
  /** Dương = nội dung dời XUỐNG (px) */
  offsetY: number;
  /** Hệ số phóng của mô hình so với khung mặc định */
  zoom: number;
}

export interface ViewOffset {
  fullWidth: number;
  fullHeight: number;
  x: number;
  y: number;
  aspect: number;
  /** camera.zoom đã bù độ phóng do cắt sub-window */
  cameraZoom: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * @param isDesktop Có đang ở layout desktop (panel bên phải) không. Mặc định suy từ bề rộng canvas,
 * nhưng component truyền kết quả `matchMedia` để khớp tuyệt đối với breakpoint `lg` của CSS
 * (bề rộng canvas có thể hụt vài px do thanh cuộn).
 */
export const computeFraming = (
  { width, height }: ViewportSize,
  isDesktop: boolean = width >= LG_BREAKPOINT
): Framing => {
  if (width <= 0 || height <= 0) return { offsetX: 0, offsetY: 0, zoom: 1 };

  const availableWidth = isDesktop ? width - DESKTOP_PANEL_SPACE : width;
  const zoom = clamp((availableWidth * TARGET_FILL) / (height * MODEL_WIDTH_PER_VIEWPORT_HEIGHT), 0.35, 1.05);

  return {
    offsetX: isDesktop ? DESKTOP_PANEL_SPACE / 2 : 0,
    // Desktop: hạ nhẹ mô hình để nhường góc trên trái cho hero.
    // Mobile: nâng mô hình lên giữa vùng phía trên bottom sheet.
    offsetY: isDesktop ? Math.round(height * 0.065) : -Math.round((height * MOBILE_SHEET_RATIO) / 2),
    zoom: Number(zoom.toFixed(3)),
  };
};

/**
 * Quy đổi framing thành tham số `setViewOffset`.
 * Khung "đầy đủ" rộng hơn viewport 2×|offset|; cắt một sub-window lệch đi 2×offset
 * thì trục camera (tâm khung đầy đủ) rơi vào đúng vị trí mong muốn.
 */
export const computeViewOffset = (size: ViewportSize, framing: Framing): ViewOffset => {
  const dx = Math.abs(framing.offsetX);
  const dy = Math.abs(framing.offsetY);
  const fullWidth = size.width + 2 * dx;
  const fullHeight = size.height + 2 * dy;

  return {
    fullWidth,
    fullHeight,
    x: framing.offsetX >= 0 ? 2 * dx : 0,
    y: framing.offsetY >= 0 ? 0 : 2 * dy,
    // Aspect theo khung đầy đủ để không méo hình
    aspect: fullWidth / fullHeight,
    // Sub-window chỉ lấy height/fullHeight của fov → tự phóng to; nhân ngược lại để giữ tỉ lệ
    cameraZoom: framing.zoom * (size.height / fullHeight),
  };
};

/** Áp lens shift lên camera phối cảnh (thao tác imperative trên đối tượng Three.js). */
export const applyFraming = (
  camera: THREE.PerspectiveCamera,
  size: ViewportSize,
  isDesktop: boolean = size.width >= LG_BREAKPOINT
): ViewOffset => {
  const view = computeViewOffset(size, computeFraming(size, isDesktop));
  camera.aspect = view.aspect;
  camera.zoom = view.cameraZoom;
  camera.setViewOffset(view.fullWidth, view.fullHeight, view.x, view.y, size.width, size.height);
  camera.updateProjectionMatrix();
  return view;
};

/** Trả camera về khung chuẩn (không lens shift). */
export const resetFraming = (camera: THREE.PerspectiveCamera, size: ViewportSize): void => {
  camera.clearViewOffset();
  camera.zoom = 1;
  camera.aspect = size.height > 0 ? size.width / size.height : 1;
  camera.updateProjectionMatrix();
};

export const CameraFraming: React.FC = () => {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    // Dùng cùng media query với Tailwind `lg:` để framing và layout panel luôn đồng bộ
    const query = typeof window.matchMedia === 'function' ? window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`) : null;
    const apply = () => applyFraming(camera, size, query ? query.matches : size.width >= LG_BREAKPOINT);

    apply();
    query?.addEventListener('change', apply);
    return () => {
      query?.removeEventListener('change', apply);
      resetFraming(camera, size);
    };
  }, [camera, size]);

  return null;
};
