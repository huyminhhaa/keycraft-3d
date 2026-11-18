import * as THREE from 'three';
import type { PlacedKey } from '@/lib/keyboard/layouts';
import type { KeycapProfile } from '@/types/keyboard';

/** 1u (một phím chữ, 19.05mm) quy ra đơn vị thế giới 3D */
export const KEY_UNIT = 0.38;
/** Khe hở giữa hai keycap cạnh nhau (đơn vị thế giới) */
export const KEYCAP_GAP = 0.028;
/** Độ vát mỗi bên từ đáy lên đỉnh keycap */
const TAPER_X = 0.03;
const TAPER_Z = 0.036;
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
  /** Lòng chảo: trụ (Cherry, lõm theo chiều ngang) hoặc cầu (MOA, lõm cả hai chiều) */
  dish: 'cylindrical' | 'spherical';
  /** Bo góc viền đáy / viền mặt trên */
  cornerBottom: number;
  cornerTop: number;
}

/** MOA: mọi hàng cao như nhau, không nghiêng, thân bầu và bo tròn hơn Cherry */
const MOA = { height: 0.205, taperX: 0.048, taperZ: 0.052, cornerBottom: 0.05, cornerTop: 0.075 } as const;

export const getKeycapShape = (
  widthU: number,
  row: PlacedKey['profileRow'],
  profile: KeycapProfile = 'cherry'
): KeycapShape => {
  const bottomWidth = widthU * KEY_UNIT - KEYCAP_GAP;
  const bottomDepth = KEY_UNIT - KEYCAP_GAP;
  if (profile === 'moa') {
    return {
      bottomWidth,
      bottomDepth,
      topWidth: bottomWidth - 2 * MOA.taperX,
      topDepth: bottomDepth - 2 * MOA.taperZ,
      height: MOA.height,
      tilt: 0,
      dish: 'spherical',
      cornerBottom: MOA.cornerBottom,
      cornerTop: MOA.cornerTop,
    };
  }
  const { height, tilt } = KEYCAP_PROFILE[row];
  return {
    bottomWidth,
    bottomDepth,
    topWidth: bottomWidth - 2 * TAPER_X,
    topDepth: bottomDepth - 2 * TAPER_Z,
    height,
    tilt,
    dish: 'cylindrical',
    cornerBottom: 0.028,
    cornerTop: 0.04,
  };
};

const keycapCache = new Map<string, THREE.BufferGeometry>();
const legendCache = new Map<string, THREE.BufferGeometry>();

/** Độ sâu lòng chảo (dish) ở giữa mặt phím: ≈ 0.55mm như profile Cherry */
export const DISH_DEPTH = 0.011;
const CORNER_SEGMENTS = 5;

/**
 * Độ sâu lòng chảo tại (x, z), sâu nhất ở tâm:
 *  - trụ (Cherry): chỉ phụ thuộc x, bằng 0 ở mép trái/phải, mép trước/sau cong xuống theo lòng chảo;
 *  - cầu (MOA): phụ thuộc cả x và z (phím dài dùng bán kính theo chiều sâu để lòng chảo tròn đều).
 */
export const dishDepthAt = (x: number, shape: Pick<KeycapShape, 'topWidth' | 'topDepth' | 'dish'>, z = 0): number => {
  if (shape.dish === 'spherical') {
    const r = Math.min(shape.topWidth, shape.topDepth) / 2;
    const span = Math.max(0, Math.abs(x) - (shape.topWidth / 2 - r));
    const u = span / r;
    const v = z / (shape.topDepth / 2);
    return DISH_DEPTH * Math.max(0, 1 - u * u - v * v);
  }
  const u = x / (shape.topWidth / 2);
  return DISH_DEPTH * Math.max(0, 1 - u * u);
};

/** Độ cao mặt phím tại (x, z): nghiêng theo hàng profile, trừ lòng chảo. */
export const keycapSurfaceY = (shape: KeycapShape, x: number, z: number): number =>
  shape.height - z * Math.tan(shape.tilt) - dishDepthAt(x, shape, z);

/** Đường viền chữ nhật bo góc (x, z), đi theo chiều kim đồng hồ khi nhìn từ trên xuống. */
const roundedOutline = (width: number, depth: number, radius: number): [number, number][] => {
  const r = Math.min(radius, width / 2, depth / 2);
  const corners: [number, number, number][] = [
    [width / 2 - r, -depth / 2 + r, -Math.PI / 2],
    [width / 2 - r, depth / 2 - r, 0],
    [-width / 2 + r, depth / 2 - r, Math.PI / 2],
    [-width / 2 + r, -depth / 2 + r, Math.PI],
  ];
  return corners.flatMap(([cx, cz, start]) =>
    Array.from({ length: CORNER_SEGMENTS + 1 }, (_, s): [number, number] => {
      const a = start + (s / CORNER_SEGMENTS) * (Math.PI / 2);
      return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
    })
  );
};

/**
 * Keycap dựng từ các vòng viền bo góc (loft):
 *  - thành keycap thu nhỏ dần lên trên (taper) và nghiêng theo hàng profile Cherry,
 *  - mặt trên lõm kiểu trụ (dish) — mép trước/sau cong xuống theo lòng chảo như keycap thật,
 *  - mặt trên tách đỉnh riêng để cạnh viền sắc gọn, thành keycap đổ bóng mượt.
 * Đáy nằm ở y = 0. Cache theo (bề rộng, hàng) nên 87 phím chỉ dùng ~25 geometry.
 */
export const createKeycapGeometry = (
  widthU: number,
  row: PlacedKey['profileRow'],
  profile: KeycapProfile = 'cherry'
): THREE.BufferGeometry => {
  const cacheKey = `${profile}-${widthU}-${row}`;
  const cached = keycapCache.get(cacheKey);
  if (cached) return cached;

  const shape = getKeycapShape(widthU, row, profile);
  const slope = Math.tan(shape.tilt);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const addVertex = (x: number, y: number, z: number): number => {
    positions.push(x, y, z);
    // UV theo toạ độ thế giới: hạt nhựa PBT có cùng kích thước trên phím 1u lẫn phím cách
    uvs.push(x / KEY_UNIT + 0.5, z / KEY_UNIT + 0.5);
    return positions.length / 3 - 1;
  };
  const ring = (points: [number, number][], y: (x: number, z: number) => number): number[] =>
    points.map(([x, z]) => addVertex(x, y(x, z), z));
  /** Nối hai vòng (ngoài/dưới → trong/trên) bằng các tam giác quay ra ngoài/lên trên */
  const stitch = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      indices.push(a[i], b[i], a[j], a[j], b[i], b[j]);
    }
  };

  // Thành keycap: các vòng từ đáy lên đỉnh
  const wallSteps = [0, 0.45, 0.85, 1];
  const wallRings = wallSteps.map((t) => {
    const w = shape.bottomWidth + (shape.topWidth - shape.bottomWidth) * t;
    const d = shape.bottomDepth + (shape.topDepth - shape.bottomDepth) * t;
    const r = shape.cornerBottom + (shape.cornerTop - shape.cornerBottom) * t;
    return ring(roundedOutline(w, d, r), (x, z) =>
      t === 1 ? keycapSurfaceY(shape, x, z) : shape.height * t - z * slope * t
    );
  });
  for (let k = 0; k < wallRings.length - 1; k++) stitch(wallRings[k], wallRings[k + 1]);

  // Mặt trên lõm: các vòng thu nhỏ dần về tâm (đỉnh tách riêng để viền sắc)
  const topOutline = roundedOutline(shape.topWidth, shape.topDepth, shape.cornerTop);
  const topRings = [1, 0.8, 0.58, 0.36, 0.16].map((s) =>
    ring(
      topOutline.map(([x, z]): [number, number] => [x * s, z * s]),
      (x, z) => keycapSurfaceY(shape, x, z)
    )
  );
  for (let k = 0; k < topRings.length - 1; k++) stitch(topRings[k], topRings[k + 1]);
  const topCenter = addVertex(0, keycapSurfaceY(shape, 0, 0), 0);
  const innermost = topRings[topRings.length - 1];
  innermost.forEach((v, i) => indices.push(v, topCenter, innermost[(i + 1) % innermost.length]));

  // Đáy kín (nhìn từ dưới khi tách lớp)
  const bottomRing = ring(roundedOutline(shape.bottomWidth, shape.bottomDepth, shape.cornerBottom), () => 0);
  const bottomCenter = addVertex(0, 0, 0);
  bottomRing.forEach((v, i) => indices.push(v, bottomRing[(i + 1) % bottomRing.length], bottomCenter));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  keycapCache.set(cacheKey, geometry);
  return geometry;
};

/**
 * Mặt phẳng in ký tự uốn theo lòng chảo của keycap (nằm cao hơn mặt phím 0.06mm),
 * để ký tự không lơ lửng ở giữa hay chìm ở mép.
 */
export const createLegendGeometry = (
  widthU: number,
  row: PlacedKey['profileRow'],
  legendWidth: number,
  legendDepth: number,
  profile: KeycapProfile = 'cherry'
): THREE.BufferGeometry => {
  const cacheKey = `${profile}-${widthU}-${row}-${legendWidth.toFixed(4)}x${legendDepth.toFixed(4)}`;
  const cached = legendCache.get(cacheKey);
  if (cached) return cached;
  const shape = getKeycapShape(widthU, row, profile);
  const geometry = new THREE.PlaneGeometry(legendWidth, legendDepth, 12, 2);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, keycapSurfaceY(shape, pos.getX(i), pos.getZ(i)) + 0.0012);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  legendCache.set(cacheKey, geometry);
  return geometry;
};

/** Gờ định vị (homing bar) nổi trên phím F và J, gần mép trước */
export const HOMING_BAR = { width: 0.085, height: 0.0055, depth: 0.014, z: 0.068 } as const;
export const HOMING_KEYS = new Set(['KeyF', 'KeyJ']);

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

/** Cạnh vát chamfer 45° (rộng = sâu, 1 mặt vát) quanh mép ngoài và mép lỗ khung vỏ, bắt sáng như nhôm CNC */
export const CASE_BEVEL = 0.03;
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
    bevelSegments: 1,
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
