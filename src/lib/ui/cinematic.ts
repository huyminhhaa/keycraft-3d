import * as THREE from 'three';

/**
 * Toán chuyển động điện ảnh dùng chung cho sân khấu 3D.
 */

/** Chậm dần về cuối, không vượt đích (không nảy). */
export const easeOutCubic = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
};

/** Cảnh mở đầu: camera lướt vòng từ bên trái, từ xa vào. */
export const INTRO = {
  duration: 1.8,
  /** Góc lệch ban đầu quanh trục Y (rad) */
  azimuth: -0.9,
  /** Khoảng cách ban đầu so với khoảng cách cuối */
  distance: 1.35,
} as const;

export interface IntroPose {
  azimuth: number;
  distanceScale: number;
}

/** Tư thế camera tại thời điểm `elapsed` (giây) của cảnh mở đầu. */
export const introPose = (elapsed: number): IntroPose => {
  const k = 1 - easeOutCubic(elapsed / INTRO.duration);
  return { azimuth: INTRO.azimuth * k, distanceScale: 1 + (INTRO.distance - 1) * k };
};

/**
 * Đặt vị trí camera: lấy vị trí đích, xoay quanh trục Y của tâm nhìn một góc `azimuth`
 * rồi kéo xa theo `distanceScale`.
 */
export const posedPosition = (
  goal: THREE.Vector3,
  target: THREE.Vector3,
  pose: IntroPose,
  out = new THREE.Vector3()
): THREE.Vector3 =>
  out
    .copy(goal)
    .sub(target)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), pose.azimuth)
    .multiplyScalar(pose.distanceScale)
    .add(target);

/** Bàn xoay 360°: tốc độ góc (rad/giây) — khoảng 52 giây một vòng, đều trên mọi tần số màn hình */
export const TURNTABLE_SPEED = 0.12;
/** Khung hình bị trễ lâu (tab ẩn rồi quay lại) không làm mô hình giật một góc lớn */
export const MAX_FRAME_DELTA = 0.25;

/** Góc xoay của bàn xoay trong một khung hình, tính theo thời gian chứ không theo số khung hình. */
export const turntableStep = (delta: number, speed = TURNTABLE_SPEED): number =>
  speed * Math.min(Math.max(0, delta), MAX_FRAME_DELTA);

/** Xoay vị trí camera quanh trục Y đi qua tâm nhìn (giữ nguyên độ cao và khoảng cách). */
export const orbitAroundY = (position: THREE.Vector3, target: THREE.Vector3, angle: number): THREE.Vector3 =>
  position.sub(target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(target);

/**
 * Chuyển màu vật liệu dần về màu đích. Trả về true khi đã tới đích.
 * `step` là tỉ lệ 0–1 của quãng còn lại đi được trong khung hình này.
 */
export const stepColorToward = (current: THREE.Color, target: THREE.Color, step: number): boolean => {
  const k = Math.min(1, Math.max(0, step));
  current.lerp(target, k);
  const done =
    Math.abs(current.r - target.r) < 1e-3 && Math.abs(current.g - target.g) < 1e-3 && Math.abs(current.b - target.b) < 1e-3;
  if (done) current.copy(target);
  return done;
};

/** Người dùng có bật "giảm chuyển động" trong hệ điều hành không. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
