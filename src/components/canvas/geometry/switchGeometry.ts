import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three-stdlib';
import { MX_FOOTPRINT } from './proceduralTextures';
import { MM } from './plateGeometry';

/**
 * Hình học switch MX 5-pin và stabilizer PCB-mount (đơn vị thế giới, quy đổi từ mm).
 * Gốc toạ độ: tâm switch, y = 0 tại MẶT TRÊN plate.
 *   - Vỏ trên (top housing) ngồi trên plate, cao 4.5mm, vát thu nhỏ dần lên đỉnh.
 *   - Vỏ dưới (bottom housing) lọt qua lỗ plate, đáy chạm mặt PCB (6.25mm dưới mặt plate).
 *   - Chân đồng + trụ giữa + 2 chân nhựa cắm xuyên PCB.
 *   - Stem chữ thập "+" nhô 3.6mm khỏi vỏ trên, chui vào lòng keycap.
 */

/** Khoảng cách từ mặt plate xuống mặt PCB */
export const PLATE_TO_PCB = 6.25 * MM;
export const TOP_HOUSING_HEIGHT = 4.5 * MM;
export const STEM_TOP = 8.4 * MM;

const mm = (v: number) => v * MM;

const boxAt = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry =>
  new THREE.BoxGeometry(mm(w), mm(h), mm(d)).translate(mm(x), mm(y), mm(z));

const cylinderAt = (r: number, h: number, x: number, y: number, z: number, segments = 16): THREE.BufferGeometry =>
  new THREE.CylinderGeometry(mm(r), mm(r), mm(h), segments).translate(mm(x), mm(y), mm(z));

/** Hộp vát: đáy bw × bd, đỉnh tw × td, cao h, đáy ở y = 0 (vỏ trên switch hình thang 4 mặt). */
export const taperedBox = (bw: number, bd: number, tw: number, td: number, h: number): THREE.BufferGeometry => {
  const geometry = new THREE.BoxGeometry(bw, h, bd);
  geometry.translate(0, h / 2, 0);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > h / 2) pos.setXYZ(i, (pos.getX(i) * tw) / bw, pos.getY(i), (pos.getZ(i) * td) / bd);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
};

const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  // RoundedBoxGeometry không có index còn Box/Cylinder có: đưa hết về dạng không index rồi mới gộp
  const flat = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const merged = mergeGeometries(flat, false);
  parts.forEach((part) => part.dispose());
  flat.forEach((part) => part.dispose());
  if (!merged) throw new Error('Không gộp được hình học switch');
  return merged;
};

export interface SwitchGeometries {
  /** Vỏ trên trong mờ + 4 ngàm kẹp */
  topHousing: THREE.BufferGeometry;
  /** Cửa sổ LED / thấu kính khuếch tán phía nam */
  lens: THREE.BufferGeometry;
  /** Vỏ dưới + trụ định vị giữa + 2 chân nhựa (5-pin) */
  bottomHousing: THREE.BufferGeometry;
  /** 2 chân tiếp xúc đồng mạ vàng */
  pins: THREE.BufferGeometry;
  /** Stem chữ thập MX + vách chống bụi */
  stem: THREE.BufferGeometry;
  /** Lò xo xoắn (chỉ có khi đã nạp model Blender) */
  spring?: THREE.BufferGeometry;
}

/** Switch dựng bằng Blender (public/models/switch.glb): vỏ trên rỗng, vỏ dưới, stem, lò xo */
export interface SwitchModels {
  top: THREE.BufferGeometry;
  bottom: THREE.BufferGeometry;
  stem: THREE.BufferGeometry;
  spring: THREE.BufferGeometry;
}

let switchModels: SwitchModels | null = null;

export const registerSwitchModels = (models: SwitchModels): void => {
  switchModels = models;
};

export const hasSwitchModels = (): boolean => switchModels !== null;

/**
 * Hình học switch: dùng model Blender nếu đã nạp (vỏ trên rỗng bo mép, lẫy bám plate, stem vát đầu,
 * lò xo), không thì dựng bằng code. Cửa sổ LED và chân đồng luôn dựng bằng code.
 */
export const createSwitchGeometries = (): SwitchGeometries => {
  const procedural = createProceduralSwitchGeometries();
  if (!switchModels) return procedural;
  [procedural.topHousing, procedural.bottomHousing, procedural.stem].forEach((g) => g.dispose());
  return {
    ...procedural,
    topHousing: switchModels.top,
    bottomHousing: switchModels.bottom,
    stem: switchModels.stem,
    spring: switchModels.spring,
  };
};

const createProceduralSwitchGeometries = (): SwitchGeometries => ({
  topHousing: merge([
    taperedBox(mm(15.6), mm(15.6), mm(11.2), mm(11.6), TOP_HOUSING_HEIGHT),
    // Ngàm kẹp hai bên (2 mỗi bên) giữ vỏ trên vào vỏ dưới
    ...[-1, 1].flatMap((side) => [-3.6, 3.6].map((z) => boxAt(1.0, 1.8, 3.2, side * 7.9, 1.1, z))),
  ]),
  lens: boxAt(4.2, 0.4, 2.4, MX_FOOTPRINT.led[0], 4.5 + 0.2, MX_FOOTPRINT.led[1]),
  bottomHousing: merge([
    new RoundedBoxGeometry(mm(14), PLATE_TO_PCB, mm(14), 2, mm(0.6)).translate(0, -PLATE_TO_PCB / 2, 0),
    cylinderAt(1.95, 3.0, 0, -6.25 - 1.5, 0, 20),
    ...MX_FOOTPRINT.pegs.map(([x, z]) => cylinderAt(0.85, 3.0, x, -6.25 - 1.5, z, 12)),
  ]),
  pins: merge(MX_FOOTPRINT.pins.map(([x, z]) => boxAt(1.4, 3.6, 0.4, x, -6.25 - 1.8, z))),
  stem: merge([
    // Vách chống bụi (dustproof box) ôm quanh chân stem, ló 0.3mm khỏi vỏ trên
    boxAt(5.6, 1.2, 5.6, 0, 4.2, 0),
    // Chữ thập MX: 4.0 × 1.17mm, cao tới đỉnh stem
    boxAt(4.0, STEM_TOP / MM - 4.8, 1.17, 0, (4.8 + STEM_TOP / MM) / 2, 0),
    boxAt(1.17, STEM_TOP / MM - 4.8, 4.0, 0, (4.8 + STEM_TOP / MM) / 2, 0),
  ]),
});

export interface StabilizerGeometries {
  /** Vỏ stabilizer PCB-mount (ốc vặn) + insert */
  housing: THREE.BufferGeometry;
  /** Thanh thép: hình trụ dài 1 đơn vị theo trục X, co giãn theo khoảng cách hai housing */
  wire: THREE.BufferGeometry;
}

/** Thanh thép stabilizer nằm dưới plate, lệch về phía người gõ */
export const STAB_WIRE = { y: -5.2 * MM, z: 5.6 * MM, radius: 0.6 * MM } as const;

export const createStabilizerGeometries = (): StabilizerGeometries => ({
  housing: merge([
    // Thân từ mặt PCB lên ngang vỏ trên switch
    boxAt(6.6, 9.75, 11.5, 0, -6.25 + 9.75 / 2, 0),
    // Insert (con trượt) nhô lên ở giữa
    boxAt(3.2, 2.4, 4.4, 0, 3.5 + 1.2, -1.0),
    // Ốc vặn xuyên PCB
    cylinderAt(1.0, 2.0, 0, -6.25 - 1.0, 3.5, 10),
  ]),
  wire: new THREE.CylinderGeometry(STAB_WIRE.radius, STAB_WIRE.radius, 1, 8).rotateZ(Math.PI / 2),
});
