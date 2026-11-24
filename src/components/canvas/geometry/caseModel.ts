import * as THREE from 'three';

/**
 * Vỏ dựng bằng Blender (public/models/case.glb): MỘT vỏ mẫu (khung có lỗ khoang) với mép trên vát
 * kim cương, đáy bo tròn, mép trong lỗ khoang vát. Web "nắn" vỏ mẫu theo kích thước từng bàn phím:
 *   - kéo giãn phần giữa theo x, z (thành ngoài và thành lỗ khoang dời độc lập) và theo y (chiều cao),
 *   - cung góc ngoài dời theo hướng bán kính để đổi bán kính bo góc mà mép vát quanh góc vẫn đều.
 * Mép vát / bo góc vì thế luôn đúng kích thước thật dù vỏ to nhỏ thế nào.
 *
 * File này được scripts/models/export-specs.ts xuất sang JSON cho Blender: Blender và web dùng
 * CHUNG một bộ số (đổi ở đây thì chạy lại `npm run models`).
 */
export const CASE_TEMPLATE = {
  /** Nửa bề rộng = nửa bề sâu của mặt thành ngoài (vỏ mẫu vuông, viền rất dày để vùng góc tách bạch) */
  outerHalf: 2,
  /** Nửa bề rộng / sâu của thành lỗ khoang */
  holeHalf: 1,
  /** Chiều cao vỏ mẫu (đáy y = 0) */
  height: 1,
  /** Bán kính bo góc ngoài của vỏ mẫu (đo ở mặt thành) */
  outerRadius: 0.19,
  /** Bán kính bo góc lỗ khoang (giữ nguyên khi nắn) */
  holeRadius: 0.05,
  /** Mép vát kim cương 45° quanh mép trên ngoài: 0.8mm */
  topChamfer: 0.016,
  /** Mép vát quanh miệng lỗ khoang: 0.6mm */
  holeChamfer: 0.012,
  /** Bo tròn mép đáy ngoài: 0.4mm */
  bottomFillet: 0.008,
} as const;

export interface CaseFit {
  /** Kích thước mặt trên của vỏ (giống tham số của createCaseGeometry) */
  width: number;
  depth: number;
  height: number;
  yBottom: number;
  hole: { width: number; depth: number };
  cornerRadius: number;
  /** Phần thành vỏ nhô ra ngoài mặt trên (= CASE_BEVEL của vỏ dựng bằng code) */
  bevel: number;
}

/** UV theo toạ độ thế giới chiếu theo mặt (hạt phun cát / vân gỗ không bị kéo dài trên thành vỏ) */
export const setCaseUv = (geometry: THREE.BufferGeometry): void => {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const normal = geometry.attributes.normal as THREE.BufferAttribute | undefined;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = normal ? Math.abs(normal.getX(i)) : 0;
    const ny = normal ? Math.abs(normal.getY(i)) : 1;
    const nz = normal ? Math.abs(normal.getZ(i)) : 0;
    const [u, v] =
      ny > 0.6 ? [pos.getX(i), pos.getZ(i)] : nx > nz ? [pos.getZ(i), pos.getY(i)] : [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
};

/** Nắn vỏ mẫu (đáy y = 0) thành vỏ có kích thước `fit`. Vỏ mẫu không bị sửa. */
export const fitCaseTemplate = (template: THREE.BufferGeometry, fit: CaseFit): THREE.BufferGeometry => {
  const t = CASE_TEMPLATE;
  const geometry = template.clone();
  const pos = geometry.attributes.position as THREE.BufferAttribute;

  const ox = fit.width / 2 + fit.bevel;
  const oz = fit.depth / 2 + fit.bevel;
  const hx = fit.hole.width / 2;
  const hz = fit.hole.depth / 2;
  // Bán kính ngoài mới, đo ở mặt thành (vỏ code: bo góc mặt trên + phần nhô bevel)
  const radius = Math.min(Math.max(fit.cornerRadius + fit.bevel, t.topChamfer + 0.004), ox - 1e-3, oz - 1e-3);
  const mid = (t.outerHalf + t.holeHalf) / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const sx = Math.abs(x) < 1e-6 ? 0 : Math.sign(x);
    const sz = Math.abs(z) < 1e-6 ? 0 : Math.sign(z);
    const outerX = Math.abs(x) > mid;
    const outerZ = Math.abs(z) > mid;

    let nx: number;
    let nz: number;
    if (outerX && outerZ) {
      // Cung góc ngoài: giữ khoảng cách tới đường bo (mép vát, bo đáy), đổi bán kính bo góc
      const cx = sx * (t.outerHalf - t.outerRadius);
      const cz = sz * (t.outerHalf - t.outerRadius);
      const vx = x - cx;
      const vz = z - cz;
      const d = Math.hypot(vx, vz) || 1;
      const next = d - t.outerRadius + radius;
      nx = sx * (ox - radius) + (vx / d) * next;
      nz = sz * (oz - radius) + (vz / d) * next;
    } else {
      nx = outerX ? x + sx * (ox - t.outerHalf) : x + sx * (hx - t.holeHalf);
      nz = outerZ ? z + sz * (oz - t.outerHalf) : z + sz * (hz - t.holeHalf);
    }
    // Chiều cao: nửa trên dời theo mép trên (mép vát giữ nguyên), nửa dưới giữ mép đáy
    const ny = (y > t.height / 2 ? y + (fit.height - t.height) : y) + fit.yBottom;
    pos.setXYZ(i, nx, ny, nz);
  }
  pos.needsUpdate = true;
  setCaseUv(geometry);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

/* -------------------------------------------------------------------------- */
/* Kho model vỏ                                                               */
/* -------------------------------------------------------------------------- */
let caseTemplate: THREE.BufferGeometry | null = null;

export const registerCaseModel = (template: THREE.BufferGeometry): void => {
  caseTemplate = template;
};

export const getCaseTemplate = (): THREE.BufferGeometry | null => caseTemplate;
