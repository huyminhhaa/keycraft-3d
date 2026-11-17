import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import type { PlacedKey } from '@/lib/keyboard/layouts';

/** 1u (một phím chữ, 19.05mm) quy ra đơn vị thế giới 3D */
export const KEY_UNIT = 0.38;
/** Khe hở giữa hai keycap cạnh nhau (đơn vị thế giới) */
export const KEYCAP_GAP = 0.028;
/** Độ vát mỗi bên từ đáy lên đỉnh keycap */
const TAPER_X = 0.024;
const TAPER_Z = 0.03;
/** Viền vỏ bao quanh vùng phím */
export const CASE_BEZEL = 0.22;

/**
 * Profile Cherry rút gọn: hàng trên cao hơn và mặt nghiêng về phía người gõ,
 * hàng dưới cùng nghiêng ra xa. `tilt` > 0 nghĩa là mép sau cao hơn mép trước.
 */
export const KEYCAP_PROFILE: Record<PlacedKey['profileRow'], { height: number; tilt: number }> = {
  1: { height: 0.19, tilt: 0.14 },
  2: { height: 0.168, tilt: 0.07 },
  3: { height: 0.158, tilt: 0 },
  4: { height: 0.165, tilt: -0.1 },
};

export interface KeycapShape {
  /** Bề rộng / sâu ở đáy */
  bottomWidth: number;
  bottomDepth: number;
  /** Bề rộng / sâu mặt trên (đã trừ độ vát) */
  topWidth: number;
  topDepth: number;
  height: number;
  tilt: number;
}

export const getKeycapShape = (widthU: number, row: PlacedKey['profileRow']): KeycapShape => {
  const { height, tilt } = KEYCAP_PROFILE[row];
  const bottomWidth = widthU * KEY_UNIT - KEYCAP_GAP;
  const bottomDepth = KEY_UNIT - KEYCAP_GAP;
  return {
    bottomWidth,
    bottomDepth,
    topWidth: bottomWidth - 2 * TAPER_X,
    topDepth: bottomDepth - 2 * TAPER_Z,
    height,
    tilt,
  };
};

const keycapCache = new Map<string, THREE.BufferGeometry>();

/**
 * Keycap: hộp bo góc rồi biến dạng từng đỉnh — thu hẹp dần lên đỉnh (taper) và nghiêng mặt trên
 * theo hàng. Đáy nằm ở y = 0. Hình học được cache theo (bề rộng, hàng) nên 87 phím chỉ dùng ~25 geometry.
 */
export const createKeycapGeometry = (widthU: number, row: PlacedKey['profileRow']): THREE.BufferGeometry => {
  const cacheKey = `${widthU}-${row}`;
  const cached = keycapCache.get(cacheKey);
  if (cached) return cached;

  const shape = getKeycapShape(widthU, row);
  const geometry = new RoundedBoxGeometry(shape.bottomWidth, shape.height, shape.bottomDepth, 3, 0.03);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const slope = Math.tan(shape.tilt);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = (y + shape.height / 2) / shape.height; // 0 ở đáy → 1 ở đỉnh
    const scaleX = 1 - (t * 2 * TAPER_X) / shape.bottomWidth;
    const scaleZ = 1 - (t * 2 * TAPER_Z) / shape.bottomDepth;
    const nz = z * scaleZ;
    position.setXYZ(i, x * scaleX, y + shape.height / 2 - nz * slope * t, nz);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  keycapCache.set(cacheKey, geometry);
  return geometry;
};

/** Hình chữ nhật bo góc (dùng cho vỏ, lỗ khung và tạ đồng). Tâm tại gốc. */
const roundedRectPath = <T extends THREE.Path>(path: T, width: number, depth: number, radius: number): T => {
  const w = width / 2;
  const d = depth / 2;
  const r = Math.min(radius, w, d);
  path.moveTo(-w + r, -d);
  path.lineTo(w - r, -d);
  path.quadraticCurveTo(w, -d, w, -d + r);
  path.lineTo(w, d - r);
  path.quadraticCurveTo(w, d, w - r, d);
  path.lineTo(-w + r, d);
  path.quadraticCurveTo(-w, d, -w, d - r);
  path.lineTo(-w, -d + r);
  path.quadraticCurveTo(-w, -d, -w + r, -d);
  return path;
};

export interface CaseDimensions {
  /** Vùng phím */
  keysWidth: number;
  keysDepth: number;
  /** Kích thước ngoài của vỏ (chưa tính bevel) */
  outerWidth: number;
  outerDepth: number;
}

export const getCaseDimensions = (layoutWidthU: number, layoutDepthU: number, bezel = CASE_BEZEL): CaseDimensions => {
  const keysWidth = layoutWidthU * KEY_UNIT;
  const keysDepth = layoutDepthU * KEY_UNIT;
  return {
    keysWidth,
    keysDepth,
    outerWidth: keysWidth + 2 * bezel,
    outerDepth: keysDepth + 2 * bezel,
  };
};

const CASE_BEVEL = 0.025;
/** Bo góc mặc định của vỏ */
export const CASE_CORNER_RADIUS = 0.16;

/**
 * Khối vỏ ép đùn từ hình chữ nhật bo góc, cạnh vát như nhôm CNC.
 * `holeWidth/holeDepth` > 0 tạo khung rỗng (top case). Đáy tại y = yBottom, cao `height`.
 */
export const createCaseGeometry = (
  width: number,
  depth: number,
  height: number,
  yBottom: number,
  hole?: { width: number; depth: number },
  cornerRadius = CASE_CORNER_RADIUS
): THREE.ExtrudeGeometry => {
  const shape = roundedRectPath(new THREE.Shape(), width, depth, cornerRadius);
  if (hole) shape.holes.push(roundedRectPath(new THREE.Path(), hole.width, hole.depth, 0.05));

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height - 2 * CASE_BEVEL,
    bevelEnabled: true,
    bevelThickness: CASE_BEVEL,
    bevelSize: CASE_BEVEL,
    bevelSegments: 3,
    curveSegments: 12,
  });
  // Ép đùn theo +z → xoay để chiều cao hướng lên +y, rồi đặt đáy tại yBottom
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, yBottom + CASE_BEVEL, 0);
  return geometry;
};

/** Toạ độ tâm (x, z) của một phím khi vùng phím được canh giữa tại gốc. */
export const keyCenter = (key: PlacedKey, layoutWidthU: number, layoutDepthU: number): [number, number] => [
  (key.x + key.w / 2 - layoutWidthU / 2) * KEY_UNIT,
  (key.y + 0.5 - layoutDepthU / 2) * KEY_UNIT,
];
