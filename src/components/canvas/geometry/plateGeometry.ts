import * as THREE from 'three';
import type { PlacedKey } from '@/lib/keyboard/layouts';
import { KEY_UNIT, keyCenter } from './keyboardGeometry';

/**
 * Plate và foam có lỗ khoét thật: lỗ switch MX 14×14mm, lỗ stabilizer, rãnh flex-cut giữa các hàng.
 * Kích thước theo chuẩn Cherry MX, quy đổi 1u = 19.05mm = KEY_UNIT.
 */

/** 1mm theo đơn vị thế giới */
export const MM = KEY_UNIT / 19.05;
/** Lỗ khoét switch MX tiêu chuẩn */
export const SWITCH_CUTOUT = 14 * MM;
/** Lỗ stabilizer (Cherry): rộng 6.75mm, cao 12.3mm, lệch về phía người gõ 1.1mm */
export const STAB_CUTOUT = { width: 6.75 * MM, depth: 12.3 * MM, offsetZ: 1.1 * MM } as const;
/** Rãnh flex-cut: rộng 1mm, mỗi đoạn dài 2.5u, cầu nối giữa các đoạn 0.6u */
export const FLEX_CUT = { width: 1 * MM, segment: 2.5 * KEY_UNIT, bridge: 0.6 * KEY_UNIT } as const;

export interface Cutout {
  /** Tâm lỗ (x, z) và kích thước, đơn vị thế giới */
  x: number;
  z: number;
  width: number;
  depth: number;
}

/**
 * Khoảng cách từ tâm phím tới mỗi housing stabilizer (mm), theo bảng chuẩn Cherry:
 * 2–2.75u: 11.938mm · 3u: 19.05mm · 6.25u: 50mm · 7u: 57.15mm. Phím dưới 2u không có stabilizer.
 */
export const stabilizerSpacing = (widthU: number): number | null => {
  if (widthU >= 7) return 57.15 * MM;
  if (widthU >= 6) return 50 * MM;
  if (widthU >= 3) return 19.05 * MM;
  if (widthU >= 2) return 11.938 * MM;
  return null;
};

/** Vị trí 2 housing stabilizer của một phím (toạ độ thế giới), rỗng nếu phím không cần. */
export const stabilizerPositions = (key: PlacedKey, layoutWidth: number, layoutDepth: number): [number, number][] => {
  const spacing = stabilizerSpacing(key.w);
  if (spacing === null) return [];
  const [x, z] = keyCenter(key, layoutWidth, layoutDepth);
  return [
    [x - spacing, z + STAB_CUTOUT.offsetZ],
    [x + spacing, z + STAB_CUTOUT.offsetZ],
  ];
};

export const switchCutouts = (keys: PlacedKey[], layoutWidth: number, layoutDepth: number, size = SWITCH_CUTOUT): Cutout[] =>
  keys.map((key) => {
    const [x, z] = keyCenter(key, layoutWidth, layoutDepth);
    return { x, z, width: size, depth: size };
  });

export const stabilizerCutouts = (keys: PlacedKey[], layoutWidth: number, layoutDepth: number): Cutout[] =>
  keys.flatMap((key) =>
    stabilizerPositions(key, layoutWidth, layoutDepth).map(([x, z]) => ({
      x,
      z,
      width: STAB_CUTOUT.width,
      depth: STAB_CUTOUT.depth,
    }))
  );

/**
 * Rãnh flex-cut nằm giữa khe hở của hai hàng phím liền nhau (khe 19.05 − 14 = 5.05mm, rãnh 1mm ở giữa),
 * chia thành các đoạn có cầu nối để plate vẫn liền một khối nhưng nhún được khi gõ.
 */
export const flexCuts = (keys: PlacedKey[], layoutWidth: number, layoutDepth: number): Cutout[] => {
  const rows = [...new Set(keys.map((key) => key.y))].sort((a, b) => a - b);
  const cuts: Cutout[] = [];
  const usable = layoutWidth * KEY_UNIT - 1 * KEY_UNIT;
  const step = FLEX_CUT.segment + FLEX_CUT.bridge;
  for (let r = 0; r < rows.length - 1; r++) {
    // Giữa mép dưới hàng trên (y + 1) và mép trên hàng dưới
    const midU = (rows[r] + 1 + rows[r + 1]) / 2;
    const z = (midU - layoutDepth / 2) * KEY_UNIT;
    for (let start = -usable / 2; start < usable / 2 - FLEX_CUT.bridge; start += step) {
      const end = Math.min(start + FLEX_CUT.segment, usable / 2);
      cuts.push({ x: (start + end) / 2, z, width: end - start, depth: FLEX_CUT.width });
    }
  }
  return cuts;
};

/** Hình chữ nhật bo góc cho THREE.Shape/Path. Trục y của shape = −z thế giới (do xoay −90° quanh X). */
const roundedRect = <T extends THREE.Path>(path: T, cx: number, cy: number, width: number, depth: number, radius: number): T => {
  const w = width / 2;
  const d = depth / 2;
  const r = Math.max(0, Math.min(radius, w, d));
  path.moveTo(cx - w + r, cy - d);
  path.lineTo(cx + w - r, cy - d);
  if (r > 0) path.quadraticCurveTo(cx + w, cy - d, cx + w, cy - d + r);
  path.lineTo(cx + w, cy + d - r);
  if (r > 0) path.quadraticCurveTo(cx + w, cy + d, cx + w - r, cy + d);
  path.lineTo(cx - w + r, cy + d);
  if (r > 0) path.quadraticCurveTo(cx - w, cy + d, cx - w, cy + d - r);
  path.lineTo(cx - w, cy - d + r);
  if (r > 0) path.quadraticCurveTo(cx - w, cy - d, cx - w + r, cy - d);
  return path;
};

const geometryCache = new Map<string, THREE.ExtrudeGeometry>();

/**
 * Tấm phẳng có lỗ khoét, ép đùn theo chiều cao: mặt dưới ở y = −thickness/2, mặt trên ở +thickness/2.
 * UV theo toạ độ thế giới nên texture hạt/vân giữ đúng tỉ lệ trên mọi layout.
 */
export const createCutoutSlab = (
  cacheKey: string,
  width: number,
  depth: number,
  thickness: number,
  cutouts: Cutout[],
  cornerRadius = 0.04
): THREE.ExtrudeGeometry => {
  const cached = geometryCache.get(cacheKey);
  if (cached) return cached;

  const shape = roundedRect(new THREE.Shape(), 0, 0, width, depth, cornerRadius);
  cutouts.forEach((cut) => {
    // Bo góc 0.5mm như lỗ cắt laser thật; z thế giới → y của shape đổi dấu
    shape.holes.push(roundedRect(new THREE.Path(), cut.x, -cut.z, cut.width, cut.depth, 0.5 * MM));
  });

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 2 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -thickness / 2, 0);
  geometry.computeVertexNormals();
  geometryCache.set(cacheKey, geometry);
  return geometry;
};
