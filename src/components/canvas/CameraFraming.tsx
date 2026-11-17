'use client';

import type React from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { getModelWidth } from './KeyboardModel';

/**
 * Tự canh khung:
 *  - Chọn camera.zoom để bàn phím chiếm một tỉ lệ cố định bề ngang sân khấu, dù sân khấu rộng
 *    (desktop) hay hẹp (mobile), dù layout là 65% hay TKL.
 *  - Khi tách lớp, lùi zoom và nâng tâm nhìn theo chiều cao khối linh kiện để cả 7 lớp nằm trong khung.
 * Zoom tính theo khoảng cách camera tham chiếu, nên cuộn chuột phóng to/thu nhỏ vẫn hoạt động bình thường.
 */

/** Khoảng cách camera tới tâm ở góc phối cảnh mặc định */
export const REFERENCE_DISTANCE = 9.2;
export const CAMERA_FOV = 38;
/** Bàn phím chiếm 80% bề ngang sân khấu */
export const TARGET_FILL = 0.8;
export const ZOOM_RANGE = { min: 0.4, max: 1.35 } as const;
/** Tâm nhìn khi các lớp đang ghép */
export const BASE_TARGET_Y = 0.2;

export interface StageSize {
  width: number;
  height: number;
}

/** Bề ngang thế giới nhìn thấy ở khoảng cách tham chiếu khi zoom = 1. */
export const visibleWidthAtReference = (aspect: number, fov = CAMERA_FOV, distance = REFERENCE_DISTANCE): number =>
  2 * distance * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect;

export const computeFitZoom = (size: StageSize, modelWidth: number): number => {
  if (size.width <= 0 || size.height <= 0 || modelWidth <= 0) return 1;
  const zoom = (visibleWidthAtReference(size.width / size.height) * TARGET_FILL) / modelWidth;
  return Number(Math.min(ZOOM_RANGE.max, Math.max(ZOOM_RANGE.min, zoom)).toFixed(3));
};

/** Hệ số thu zoom khi tách lớp: lớp trên cùng bay cao 2.15 × offset nên khung lùi tương ứng. */
export const explodedZoomFactor = (isExploded: boolean, offset: number): number =>
  isExploded ? Number((1 / (1 + 0.38 * offset)).toFixed(3)) : 1;

/** Tâm nhìn khi tách lớp: dời lên khoảng nửa chiều cao khối linh kiện. */
export const explodedTargetY = (isExploded: boolean, offset: number): number =>
  isExploded ? Number((BASE_TARGET_Y + offset * 1.05).toFixed(3)) : BASE_TARGET_Y;

interface OrbitLike {
  target: THREE.Vector3;
  update: () => void;
}

export const CameraFraming: React.FC = () => {
  const size = useThree((s) => s.size);
  const layout = useKeyboardStore((s) => s.layout);
  const isExploded = useKeyboardStore((s) => s.isExploded);
  const offset = useKeyboardStore((s) => s.explosionOffset);
  const bezel = useKeyboardStore((s) => s.caseShape?.bezel);

  // Nội suy mỗi khung hình để chuyển cảnh tách/ghép lớp mượt, không giật
  useFrame((state, delta) => {
    const camera = state.camera;
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const step = Math.min(1, delta * 6);

    const goalZoom = computeFitZoom(size, getModelWidth(layout, bezel)) * explodedZoomFactor(isExploded, offset);
    if (Math.abs(camera.zoom - goalZoom) > 1e-4) {
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, goalZoom, step);
      camera.updateProjectionMatrix();
    }

    const controls = state.controls as unknown as OrbitLike | null;
    if (!controls?.target) return;
    const dy = (explodedTargetY(isExploded, offset) - controls.target.y) * step;
    if (Math.abs(dy) > 1e-5) {
      controls.target.y += dy;
      camera.position.y += dy;
      controls.update();
    }
  });

  return null;
};
