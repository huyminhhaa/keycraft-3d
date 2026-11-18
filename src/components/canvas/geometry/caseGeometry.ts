import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createCaseGeometry } from './keyboardGeometry';

/**
 * Vỏ CNC dạng nêm (wedge), tạ đồng vát cạnh và núm xoay khía.
 *
 * Cả bàn phím nghiêng TYPING_ANGLE quanh trục X (mép sau cao hơn). Để đáy vỏ nằm phẳng trên bàn
 * trong khi mọi lớp bên trong vẫn song song với plate, mặt đáy của vỏ dưới được cắt nghiêng ngược lại:
 * trong toạ độ của bàn phím, đáy ở độ cao y = CASE_BOTTOM_Y + z · tan(góc).
 * Mép sau (z âm) thấp hơn nên vỏ dày dần về phía sau — đúng dáng vỏ nêm của bàn phím custom.
 */

/** Góc gõ 6.5° (đa số bàn phím custom 6–8°) */
export const TYPING_ANGLE = THREE.MathUtils.degToRad(6.5);
/** Độ cao mặt đáy vỏ tại tâm (z = 0) trong toạ độ bàn phím; chân cao su nhô thêm FOOT.height */
export const CASE_BOTTOM_Y = -0.161;
export const CASE_FLOOR_THICKNESS = 0.03;
export const FOOT = { radius: 0.13, height: 0.03, recessRadius: 0.165 } as const;

/** Độ cao mặt đáy vỏ tại z */
export const wedgeBottomY = (z: number, bottomCenterY = CASE_BOTTOM_Y, angle = TYPING_ANGLE): number =>
  bottomCenterY + z * Math.tan(angle);

/**
 * Kéo phần đáy của một khối ép đùn xuống mặt nêm: đỉnh giữ nguyên ở `top`,
 * mỗi đỉnh giữ đúng tỉ lệ chiều cao giữa đáy nêm và đỉnh (cạnh vát vẫn giữ dáng).
 */
const wedgeVertices = (geometry: THREE.BufferGeometry, yMin: number, top: number, bottomAt: (z: number) => number): void => {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const f = (pos.getY(i) - yMin) / (top - yMin);
    const bottom = bottomAt(pos.getZ(i));
    pos.setY(i, bottom + f * (top - bottom));
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
};

export interface WedgeCaseOptions {
  width: number;
  depth: number;
  /** Mép trên của vỏ dưới (đường ghép với vỏ trên) */
  top: number;
  /** Kích thước khoang rỗng bên trong */
  cavity: { width: number; depth: number };
  cornerRadius: number;
  bottomCenterY?: number;
  angle?: number;
}

/** Vỏ dưới dạng nêm: thành vỏ vát chamfer + sàn mỏng, chừa khoang rỗng cộng hưởng ở giữa. */
export const createWedgeCaseGeometry = ({
  width,
  depth,
  top,
  cavity,
  cornerRadius,
  bottomCenterY = CASE_BOTTOM_Y,
  angle = TYPING_ANGLE,
}: WedgeCaseOptions): THREE.BufferGeometry => {
  const bottomAt = (z: number) => wedgeBottomY(Math.max(-depth / 2, Math.min(depth / 2, z)), bottomCenterY, angle);
  const yMin = bottomAt(-depth / 2);

  const walls = createCaseGeometry(width, depth, top - yMin, yMin, cavity, cornerRadius);
  wedgeVertices(walls, yMin, top, bottomAt);

  // Sàn: tấm mỏng phủ kín khoang, bám theo mặt nêm
  const floorShape = new THREE.Shape();
  const w = cavity.width / 2 + 0.01;
  const d = cavity.depth / 2 + 0.01;
  floorShape.moveTo(-w, -d);
  floorShape.lineTo(w, -d);
  floorShape.lineTo(w, d);
  floorShape.lineTo(-w, d);
  floorShape.lineTo(-w, -d);
  const floor = new THREE.ExtrudeGeometry(floorShape, { depth: CASE_FLOOR_THICKNESS, bevelEnabled: false });
  floor.rotateX(-Math.PI / 2);
  const pos = floor.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, bottomAt(pos.getZ(i)) + pos.getY(i));
  pos.needsUpdate = true;
  floor.computeVertexNormals();

  const merged = mergeGeometries([walls.index ? walls.toNonIndexed() : walls, floor.index ? floor.toNonIndexed() : floor]);
  walls.dispose();
  floor.dispose();
  if (!merged) throw new Error('Không gộp được vỏ dưới');
  return merged;
};

/** 4 chân cao su: cách mép vỏ một khoảng như bàn phím thật */
export const caseFeetPositions = (width: number, depth: number): [number, number][] =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sz]): [number, number] => [sx * (width / 2 - 0.35), sz * (depth / 2 - 0.3)]);

/** 4 trụ bắt ốc đỡ PCB, ở bốn góc vùng phím */
export const standoffPositions = (keysWidth: number, keysDepth: number): [number, number][] =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sz]): [number, number] => [sx * (keysWidth / 2 - 0.5), sz * (keysDepth / 2 - 0.35)]);

/** Tạ đồng: tấm bo góc, cạnh vát chamfer 45°, đáy ở y = 0 */
export const createWeightGeometry = (width: number, depth: number, thickness: number): THREE.BufferGeometry => {
  const chamfer = thickness * 0.35;
  const shape = new THREE.Shape();
  const w = width / 2 - chamfer;
  const d = depth / 2 - chamfer;
  const r = 0.05;
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2 * chamfer,
    bevelEnabled: true,
    bevelThickness: chamfer,
    bevelSize: chamfer,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, chamfer, 0);
  return geometry;
};

export interface KnobOptions {
  radius: number;
  height: number;
  /** Số rãnh khía quanh thân */
  ridges?: number;
  /** Độ sâu rãnh so với bán kính */
  depth?: number;
}

/**
 * Núm xoay nhôm CNC: thân trụ có rãnh khía thẳng (straight knurl), đỉnh vát chamfer, đáy ở y = 0.
 * Tiện từ một biên dạng (LatheGeometry) rồi đẩy bán kính các đỉnh thân theo sóng tam giác để tạo rãnh.
 */
export const createKnurledKnobGeometry = ({ radius, height, ridges = 36, depth = 0.05 }: KnobOptions): THREE.BufferGeometry => {
  const chamfer = radius * 0.16;
  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(radius, 0),
    new THREE.Vector2(radius, height - chamfer),
    new THREE.Vector2(radius - chamfer, height),
    new THREE.Vector2(0, height),
  ];
  const geometry = new THREE.LatheGeometry(profile, ridges * 4);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    // Chỉ khía phần thân trụ (bán kính đầy đủ), không đụng mặt đỉnh vát
    if (r < radius * 0.999 || pos.getY(i) > height - chamfer + 1e-6) continue;
    const turn = (Math.atan2(z, x) / (Math.PI * 2) + 1) % 1;
    const phase = (turn * ridges) % 1;
    const wave = 1 - 2 * Math.abs(phase - 0.5); // 0 ở đáy rãnh, 1 ở đỉnh gờ
    const scale = 1 - depth * (1 - wave);
    pos.setX(i, x * scale);
    pos.setZ(i, z * scale);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
};
