import * as THREE from 'three';

/**
 * Mặt nạ tròn mờ dần cho sàn phản chiếu: giữa đặc (trắng), ra mép trong suốt (đen).
 * alphaMap của Three.js đọc kênh xanh lá, nên vẽ thang xám là đủ.
 * Nhờ vậy sàn tan vào phông nền như ảnh chụp sản phẩm, không bao giờ lộ mép.
 */

/** Các điểm dừng của dải mờ: [vị trí 0–1 theo bán kính, độ đặc 0–1] */
export const FLOOR_FADE_STOPS: [number, number][] = [
  [0, 1],
  [0.35, 0.85],
  [0.7, 0.25],
  [1, 0],
];

export const createRadialFadeTexture = (size = 256): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;

  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  FLOOR_FADE_STOPS.forEach(([offset, alpha]) => {
    const v = Math.round(alpha * 255);
    gradient.addColorStop(offset, `rgb(${v},${v},${v})`);
  });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
};
