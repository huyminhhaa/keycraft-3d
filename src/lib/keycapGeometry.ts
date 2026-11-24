import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import type { PlacedKey } from '@/lib/keyboard/layouts';
import type { KeycapProfile } from '@/types/keyboard';

/**
 * Bộ sinh hình học 3D Keycap Photorealistic (KeyCapy Standard)
 *
 * Hỗ trợ chuẩn 5 Profile phím cơ thịnh hành nhất thế giới:
 *  - Cherry: Điêu khắc theo hàng R1–R4, lõm hình trụ theo trục X, thấp gọn chuẩn công thái học.
 *  - OEM: Tương tự Cherry nhưng cao hơn 18% và độ dốc lớn hơn.
 *  - XDA: Chiều cao đồng đều, mặt phím rộng, bo nhẹ, lõm nhẹ.
 *  - MOA: Chiều cao đồng đều, 4 góc bo tròn cực mềm (radius = 0.09) như viên kẹo, lõm tròn giữa.
 *  - SA: Cao vút (+35% chiều cao), bo tròn cổ điển, lõm sâu hình cầu (dishDepth = 0.055).
 *
 * Kỹ thuật: Khởi tạo base mesh bằng RoundedBoxGeometry đa phân giải (subdivisions = 6),
 * chia lưới mịn mặt trên (subdivided top grid) để lòng chảo uốn cong mượt mà:
 *  1. Taper (thu nhỏ mặt trên theo topScale).
 *  2. Concave Dish (khoét lòng chảo trụ hoặc cầu).
 *  3. Tilt (độ nghiêng dốc theo từng hàng profile).
 *  4. Dịch chuyển gốc toạ độ để đáy keycap luôn nằm chính xác ở y = 0.
 */

/** 1u chuẩn quy đổi sang toạ độ thế giới 3D (19.05mm) */
export const KEY_UNIT = 0.38;
/** Khe hở giữa 2 keycap liền kề */
export const KEYCAP_GAP = 0.028;

export interface ProfileSpec {
  name: string;
  height: number;
  tilt: number;
  radius: number;
  topScale: number;
  dishDepth: number;
  dishType: 'cylindrical' | 'spherical';
}

/** Thông số chiều cao và độ nghiêng theo hàng của Cherry R1-R4 */
const CHERRY_ROWS: Record<PlacedKey['profileRow'], { height: number; tilt: number }> = {
  1: { height: 0.19, tilt: 0.14 },
  2: { height: 0.168, tilt: 0.07 },
  3: { height: 0.158, tilt: 0 },
  4: { height: 0.165, tilt: -0.1 },
};

/** Lấy thông số cấu hình hình học chi tiết theo profile và hàng phím */
export const getKeycapProfileSpecs = (
  profile: KeycapProfile = 'cherry',
  row: PlacedKey['profileRow'] = 3
): ProfileSpec => {
  const cherryRow = CHERRY_ROWS[row] ?? CHERRY_ROWS[3];

  switch (profile) {
    case 'oem':
      return {
        name: 'OEM',
        height: cherryRow.height * 1.18,
        tilt: cherryRow.tilt * 1.15,
        radius: 0.028,
        topScale: 0.78,
        dishDepth: 0.035,
        dishType: 'cylindrical',
      };
    case 'xda':
      return {
        name: 'XDA',
        height: 0.17,
        tilt: 0,
        radius: 0.04,
        topScale: 0.86,
        dishDepth: 0.025,
        dishType: 'spherical',
      };
    case 'moa':
      return {
        name: 'MOA',
        height: 0.205,
        tilt: 0,
        radius: 0.09,
        topScale: 0.86,
        dishDepth: 0.045,
        dishType: 'spherical',
      };
    case 'sa':
      return {
        name: 'SA',
        height: cherryRow.height * 1.35,
        tilt: row === 1 ? 0.12 : row === 2 ? 0.06 : row === 3 ? 0 : -0.08,
        radius: 0.035,
        topScale: 0.72,
        dishDepth: 0.055,
        dishType: 'spherical',
      };
    case 'cherry':
    default:
      return {
        name: 'Cherry',
        height: cherryRow.height,
        tilt: cherryRow.tilt,
        radius: 0.025,
        topScale: 0.78,
        dishDepth: 0.035,
        dishType: 'cylindrical',
      };
  }
};

export interface KeycapShape {
  bottomWidth: number;
  bottomDepth: number;
  topWidth: number;
  topDepth: number;
  height: number;
  tilt: number;
  dish: 'cylindrical' | 'spherical';
  dishDepth: number;
  cornerBottom: number;
  cornerTop: number;
}

/** Tính kích thước hình học bao của keycap (tương thích ngược với hệ thống canvas cũ) */
export const getKeycapShape = (
  widthU: number,
  row: PlacedKey['profileRow'] = 3,
  profile: KeycapProfile = 'cherry'
): KeycapShape => {
  const spec = getKeycapProfileSpecs(profile, row);
  const bottomWidth = widthU * KEY_UNIT - KEYCAP_GAP;
  const bottomDepth = KEY_UNIT - KEYCAP_GAP;
  const topWidth = bottomWidth * spec.topScale;
  const topDepth = bottomDepth * spec.topScale;

  return {
    bottomWidth,
    bottomDepth,
    topWidth,
    topDepth,
    height: spec.height,
    tilt: spec.tilt,
    dish: spec.dishType,
    dishDepth: spec.dishDepth,
    cornerBottom: spec.radius,
    cornerTop: spec.radius * 1.25,
  };
};

/** Tính độ sâu lòng chảo tại toạ độ (x, z) */
export const dishDepthAt = (
  x: number,
  shape: Pick<KeycapShape, 'topWidth' | 'topDepth' | 'dish' | 'dishDepth'>,
  z = 0
): number => {
  if (shape.dish === 'spherical') {
    const halfW = shape.topWidth / 2;
    const halfD = shape.topDepth / 2;
    const u = x / Math.max(0.001, halfW);
    const v = z / Math.max(0.001, halfD);
    const rSq = u * u + v * v;
    return shape.dishDepth * Math.max(0, 1 - rSq);
  }
  // cylindrical: rãnh hình trụ theo trục X (ngón tay đặt theo chiều trước-sau)
  const halfW = shape.topWidth / 2;
  const u = Math.abs(x) / Math.max(0.001, halfW);
  return shape.dishDepth * Math.max(0, 1 - u * u);
};

/** Tính độ cao mặt phím tại toạ độ (x, z) */
export const keycapSurfaceY = (shape: KeycapShape, x: number, z: number): number =>
  shape.height - z * Math.tan(shape.tilt) - dishDepthAt(x, shape, z);

/** Cache geometries để tái sử dụng tối đa giữa các phím cùng kích cỡ */
const keycapCache = new Map<string, THREE.BufferGeometry>();

/** Xoá sạch bộ nhớ cache geometry */
export const disposeKeycapGeometries = (): void => {
  keycapCache.forEach((geom) => geom.dispose());
  keycapCache.clear();
};

/**
 * Sinh hình học 3D Keycap photorealistic:
 * Dùng RoundedBoxGeometry kết hợp lưới chia nhỏ mặt trên để biến dạng vertex
 * tạo độ vát, lòng chảo lõm mượt, và độ nghiêng profile chuẩn CAD.
 */
export const createKeycapGeometry = (
  widthU: number,
  row: PlacedKey['profileRow'] = 3,
  profile: KeycapProfile = 'cherry'
): THREE.BufferGeometry => {
  const cacheKey = `${profile}-${widthU}-${row}`;
  const existing = keycapCache.get(cacheKey);
  if (existing) return existing;

  const spec = getKeycapProfileSpecs(profile, row);
  const bottomWidth = widthU * KEY_UNIT - KEYCAP_GAP;
  const bottomDepth = KEY_UNIT - KEYCAP_GAP;
  const height = spec.height;
  const halfH = height / 2;

  // Đảm bảo bán kính không vượt quá nửa kích thước
  const radius = Math.min(spec.radius, bottomWidth / 2 - 0.01, bottomDepth / 2 - 0.01);

  // 1. Khởi tạo Base Rounded Box với 6 segments
  const baseGeom = new RoundedBoxGeometry(bottomWidth, height, bottomDepth, 6, radius);
  const basePos = baseGeom.attributes.position as THREE.BufferAttribute;
  const baseNorm = baseGeom.attributes.normal as THREE.BufferAttribute;

  const positions: number[] = [];

  // Giữ lại các mặt và viền bo góc bo cong của RoundedBox, lọc bỏ 2 tam giác phẳng thô trên đỉnh
  for (let i = 0; i < basePos.count; i += 3) {
    const isFlatTop =
      baseNorm.getY(i) > 0.99 &&
      baseNorm.getY(i + 1) > 0.99 &&
      baseNorm.getY(i + 2) > 0.99 &&
      basePos.getY(i) > halfH - 0.001;

    if (isFlatTop) continue;

    for (let k = 0; k < 3; k++) {
      positions.push(basePos.getX(i + k), basePos.getY(i + k), basePos.getZ(i + k));
    }
  }

  // 2. Chia lưới mặt trên thành 12x12 quads để lòng chảo khoét sâu mượt mà ở tâm
  const nx = 12;
  const nz = 12;
  const flatW = bottomWidth - 2 * radius;
  const flatD = bottomDepth - 2 * radius;

  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const x0 = -flatW / 2 + (ix / nx) * flatW;
      const x1 = -flatW / 2 + ((ix + 1) / nx) * flatW;
      const z0 = -flatD / 2 + (iz / nz) * flatD;
      const z1 = -flatD / 2 + ((iz + 1) / nz) * flatD;

      positions.push(x0, halfH, z0, x0, halfH, z1, x1, halfH, z0);
      positions.push(x1, halfH, z0, x0, halfH, z1, x1, halfH, z1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const pos = geometry.attributes.position as THREE.BufferAttribute;

  const halfTopW = (bottomWidth * spec.topScale) / 2;
  const halfTopD = (bottomDepth * spec.topScale) / 2;
  const slope = Math.tan(spec.tilt);

  // 3. Vertex deformation trên nửa trên (y > 0)
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    if (y > 0) {
      // Tỷ lệ độ cao từ thắt lưng (y=0) lên đỉnh (y=halfH)
      const t = Math.min(1, y / halfH);

      // A. Taper: thu nhỏ x và z dần về đỉnh
      const scale = 1 - (1 - spec.topScale) * t;
      x *= scale;
      z *= scale;

      // B. Concave Dish & Tilt: tác động dần lên các đỉnh bề mặt trên (t > 0.4)
      if (t > 0.4) {
        const dishWeight = (t - 0.4) / 0.6;
        let dish = 0;

        if (spec.dishType === 'cylindrical') {
          const u = Math.abs(x) / Math.max(0.001, halfTopW);
          const r = Math.min(1, u);
          dish = spec.dishDepth * Math.max(0, 1 - r * r);
        } else {
          const u = x / Math.max(0.001, halfTopW);
          const v = z / Math.max(0.001, halfTopD);
          const rSq = Math.min(1, u * u + v * v);
          dish = spec.dishDepth * Math.max(0, 1 - rSq);
        }

        // Áp dụng khoét lõm mặt phím và độ nghiêng hàng
        y -= (dish + z * slope) * dishWeight;
      }
    }

    pos.setXYZ(i, x, y, z);
  }

  // 4. Sinh toạ độ UV theo chuẩn world-space UV
  const uvs: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    uvs.push(pos.getX(i) / KEY_UNIT + 0.5, pos.getZ(i) / KEY_UNIT + 0.5);
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  // 5. Dịch chuyển để đáy keycap luôn nằm chính xác ở y = 0
  geometry.translate(0, halfH, 0);

  // Khử sai số số thực cực nhỏ ở đáy
  const p = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 0 && p.getY(i) > -1e-5) {
      p.setY(i, 0);
    }
  }
  p.needsUpdate = true;

  // 6. Tính toán lại pháp tuyến đỉnh (normals) và bounding box
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  keycapCache.set(cacheKey, geometry);
  return geometry;
};
