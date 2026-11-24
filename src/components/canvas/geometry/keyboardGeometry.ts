import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PlacedKey } from '@/lib/keyboard/layouts';
import type { KeycapProfile } from '@/types/keyboard';

/** 1u (một phím chữ, 19.05mm) quy ra đơn vị thế giới 3D */
export const KEY_UNIT = 0.38;
/** Khe hở giữa hai keycap cạnh nhau: ~0.9mm như keycap Cherry thật (đáy 18.15mm trên bước 19.05mm) */
export const KEYCAP_GAP = 0.018;
/** Độ vát mỗi bên từ đáy lên đỉnh keycap */
const TAPER_X = 0.042;
const TAPER_Z = 0.046;
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
  /**
   * Phím dài hơn 1u = keycap 1u bị "kéo giãn phần giữa" mỗi bên một đoạn `stretch`
   * (góc bo, mép và lòng chảo ở hai đầu giữ nguyên như keycap thật). 0 với phím 1u.
   */
  stretch: number;
}

/** Đoạn kéo giãn mỗi bên của phím rộng `widthU` so với keycap 1u */
export const keycapStretch = (widthU: number): number => Math.max(0, ((widthU - 1) * KEY_UNIT) / 2);

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
      stretch: keycapStretch(widthU),
    };
  }
  if (profile === 'xda') {
    return {
      bottomWidth,
      bottomDepth,
      topWidth: bottomWidth - 2 * 0.038,
      topDepth: bottomDepth - 2 * 0.038,
      height: 0.17,
      tilt: 0,
      dish: 'spherical',
      cornerBottom: 0.04,
      cornerTop: 0.05,
      stretch: keycapStretch(widthU),
    };
  }
  if (profile === 'sa') {
    const { height, tilt } = KEYCAP_PROFILE[row];
    return {
      bottomWidth,
      bottomDepth,
      topWidth: bottomWidth - 2 * 0.045,
      topDepth: bottomDepth - 2 * 0.045,
      height: height * 1.35,
      tilt: tilt * 0.8,
      dish: 'spherical',
      cornerBottom: 0.035,
      cornerTop: 0.045,
      stretch: keycapStretch(widthU),
    };
  }
  const { height, tilt } = KEYCAP_PROFILE[row];
  // OEM: cùng kiểu điêu khắc theo hàng như Cherry nhưng thân cao hơn và nghiêng rõ hơn
  const oem = profile === 'oem';
  return {
    bottomWidth,
    bottomDepth,
    topWidth: bottomWidth - 2 * TAPER_X,
    topDepth: bottomDepth - 2 * TAPER_Z,
    height: oem ? height * 1.18 : height,
    tilt: oem ? tilt * 1.15 : tilt,
    dish: 'cylindrical',
    cornerBottom: 0.028,
    cornerTop: 0.04,
    stretch: keycapStretch(widthU),
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
 *  - cầu (MOA): phụ thuộc cả x và z.
 * Phím dài: lòng chảo của keycap 1u bị kéo giãn ở giữa (đoạn giữa phẳng, hai đầu cong như 1u) —
 * đúng cách model .glb được kéo giãn, nên chữ in đặt theo công thức này nằm khít mặt phím.
 */
export const dishDepthAt = (
  x: number,
  shape: Pick<KeycapShape, 'topWidth' | 'topDepth' | 'dish'> & { stretch?: number },
  z = 0
): number => {
  const stretch = shape.stretch ?? 0;
  const unitTopWidth = shape.topWidth - 2 * stretch;
  const ux = Math.sign(x) * Math.max(0, Math.abs(x) - stretch);
  if (shape.dish === 'spherical') {
    const r = Math.min(unitTopWidth, shape.topDepth) / 2;
    const span = Math.max(0, Math.abs(ux) - (unitTopWidth / 2 - r));
    const u = span / r;
    const v = z / (shape.topDepth / 2);
    return DISH_DEPTH * Math.max(0, 1 - u * u - v * v);
  }
  const u = ux / (unitTopWidth / 2);
  return DISH_DEPTH * Math.max(0, 1 - u * u);
};

/* -------------------------------------------------------------------------- */
/* Keycap dựng bằng Blender (public/models/keycaps.glb)                       */
/* -------------------------------------------------------------------------- */

/** Độ dày nóc keycap trong model Blender (scripts/models/build_keycaps.py: ROOF = 1.4mm) */
const KEYCAP_ROOF = (1.4 * KEY_UNIT) / 19.05;
/** Đáy trụ chữ thập cao hơn vành đáy keycap một chút */
const KEYCAP_STEM_BOTTOM = (1.2 * KEY_UNIT) / 19.05;

interface KeycapModels {
  /** `keycap_<profile>_r<hàng>` -> keycap 1u */
  bases: Map<string, THREE.BufferGeometry>;
  /** Trụ chữ thập cao 1 đơn vị */
  stem: THREE.BufferGeometry;
}

let keycapModels: KeycapModels | null = null;

/**
 * Nạp model keycap Blender (gọi từ hook useKeycapModels sau khi .glb tải xong). Từ đó
 * createKeycapGeometry dùng model thật thay cho mesh dựng bằng code.
 */
export const registerKeycapModels = (bases: Map<string, THREE.BufferGeometry>, stem: THREE.BufferGeometry): void => {
  if (keycapModels && keycapModels.bases === bases) return;
  keycapModels = { bases, stem };
};

export const hasKeycapModels = (): boolean => keycapModels !== null;

/** Tên model trong keycaps.glb của một keycap 1u */
export const keycapModelName = (profile: KeycapProfile, row: PlacedKey['profileRow']): string =>
  `keycap_${profile}_r${row}`;

/**
 * Kéo giãn keycap 1u thành phím rộng: đỉnh có x > 0 dời sang phải `stretch`, x < 0 dời sang trái,
 * đỉnh đúng trục giữa đứng yên. Góc bo và mép giữ nguyên hình dạng; pháp tuyến không đổi.
 */
export const stretchKeycap = (base: THREE.BufferGeometry, stretch: number): THREE.BufferGeometry => {
  const geometry = base.clone();
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  if (stretch > 0) {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      if (x > 1e-6) pos.setX(i, x + stretch);
      else if (x < -1e-6) pos.setX(i, x - stretch);
    }
    pos.needsUpdate = true;
  }
  return geometry;
};

/** UV theo toạ độ thế giới: hạt nhựa PBT có cùng kích thước trên phím 1u lẫn phím cách */
const setWorldUv = (geometry: THREE.BufferGeometry): void => {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / KEY_UNIT + 0.5;
    uv[i * 2 + 1] = pos.getZ(i) / KEY_UNIT + 0.5;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
};

const buildModelKeycap = (models: KeycapModels, base: THREE.BufferGeometry, shape: KeycapShape): THREE.BufferGeometry => {
  const cap = stretchKeycap(base, shape.stretch);
  // Trụ chữ thập: từ gần đáy lên tới nóc trong (nóc dày ROOF dưới mặt lõm ở tâm phím)
  const stem = models.stem.clone();
  const stemTop = keycapSurfaceY(shape, 0, 0) - KEYCAP_ROOF;
  stem.scale(1, Math.max(0.01, stemTop - KEYCAP_STEM_BOTTOM), 1);
  stem.translate(0, KEYCAP_STEM_BOTTOM, 0);

  for (const part of [cap, stem]) {
    setWorldUv(part);
    // Model có thể mang thêm thuộc tính (màu đỉnh, tangent): chỉ giữ đúng 3 thuộc tính dùng chung
    Object.keys(part.attributes).forEach((name) => {
      if (!['position', 'normal', 'uv'].includes(name)) part.deleteAttribute(name);
    });
  }
  const merged = mergeGeometries([cap.index ? cap : cap.toNonIndexed(), stem.index ? stem : stem.toNonIndexed()]) ?? cap;
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  cap.dispose();
  stem.dispose();
  return merged;
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
  const base = keycapModels?.bases.get(keycapModelName(profile, row));
  const cacheKey = `${base ? 'model' : 'code'}-${profile}-${widthU}-${row}`;
  const cached = keycapCache.get(cacheKey);
  if (cached) return cached;

  const shape = getKeycapShape(widthU, row, profile);
  // Có model Blender: dùng keycap thật (bo mép, ruột rỗng, trụ chữ thập), kéo giãn cho phím dài
  if (base && keycapModels && widthU >= 1) {
    const geometry = buildModelKeycap(keycapModels, base, shape);
    keycapCache.set(cacheKey, geometry);
    return geometry;
  }

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
