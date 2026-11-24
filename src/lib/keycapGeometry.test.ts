import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  KEY_UNIT,
  KEYCAP_GAP,
  getKeycapProfileSpecs,
  getKeycapShape,
  dishDepthAt,
  keycapSurfaceY,
  createKeycapGeometry,
  disposeKeycapGeometries,
} from './keycapGeometry';

const bounds = (geometry: THREE.BufferGeometry): THREE.Box3 => {
  geometry.computeBoundingBox();
  return geometry.boundingBox as THREE.Box3;
};

/** Đo bề rộng x của các đỉnh nằm trong dải độ cao [yMin, yMax] */
const widthAtBand = (geometry: THREE.BufferGeometry, yMin: number, yMax: number): number => {
  const pos = geometry.attributes.position;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < yMin || y > yMax) continue;
    min = Math.min(min, pos.getX(i));
    max = Math.max(max, pos.getX(i));
  }
  return max - min;
};

describe('Bộ sinh hình học 3D Keycap Chuẩn 5 Profile (keycapGeometry.ts)', () => {
  beforeEach(() => {
    disposeKeycapGeometries();
  });

  describe('Cấu hình thông số 5 Profile (getKeycapProfileSpecs)', () => {
    it('Cherry: điêu khắc theo hàng R1-R4, lòng chảo trụ, radius 0.025, topScale 0.78', () => {
      const specR1 = getKeycapProfileSpecs('cherry', 1);
      const specR3 = getKeycapProfileSpecs('cherry', 3);
      expect(specR1.name).toBe('Cherry');
      expect(specR1.height).toBe(0.19);
      expect(specR1.tilt).toBe(0.14);
      expect(specR3.height).toBe(0.158);
      expect(specR3.tilt).toBe(0);
      expect(specR3.radius).toBe(0.025);
      expect(specR3.topScale).toBe(0.78);
      expect(specR3.dishType).toBe('cylindrical');
      expect(specR3.dishDepth).toBe(0.035);
    });

    it('OEM: cao hơn Cherry 18% và độ dốc lớn hơn 15%', () => {
      const cherryR1 = getKeycapProfileSpecs('cherry', 1);
      const oemR1 = getKeycapProfileSpecs('oem', 1);
      expect(oemR1.name).toBe('OEM');
      expect(oemR1.height).toBeCloseTo(cherryR1.height * 1.18, 4);
      expect(oemR1.tilt).toBeCloseTo(cherryR1.tilt * 1.15, 4);
      expect(oemR1.dishType).toBe('cylindrical');
    });

    it('XDA: chiều cao đồng đều 0.17, không nghiêng, mặt phím rộng (topScale 0.86), lòng chảo cầu', () => {
      const xdaR1 = getKeycapProfileSpecs('xda', 1);
      const xdaR4 = getKeycapProfileSpecs('xda', 4);
      expect(xdaR1.height).toBe(0.17);
      expect(xdaR4.height).toBe(0.17);
      expect(xdaR1.tilt).toBe(0);
      expect(xdaR1.topScale).toBe(0.86);
      expect(xdaR1.radius).toBe(0.04);
      expect(xdaR1.dishDepth).toBe(0.025);
      expect(xdaR1.dishType).toBe('spherical');
    });

    it('MOA: chiều cao 0.205, bo tròn 4 góc cực mềm (radius 0.09) như viên kẹo, lõm tròn sâu 0.045', () => {
      const moa = getKeycapProfileSpecs('moa', 3);
      expect(moa.name).toBe('MOA');
      expect(moa.height).toBe(0.205);
      expect(moa.tilt).toBe(0);
      expect(moa.radius).toBe(0.09);
      expect(moa.topScale).toBe(0.86);
      expect(moa.dishDepth).toBe(0.045);
      expect(moa.dishType).toBe('spherical');
    });

    it('SA: cao vút (+35% chiều cao Cherry), bo tròn cổ điển, lòng chảo cầu sâu 0.055', () => {
      const cherryR3 = getKeycapProfileSpecs('cherry', 3);
      const saR3 = getKeycapProfileSpecs('sa', 3);
      expect(saR3.name).toBe('SA');
      expect(saR3.height).toBeCloseTo(cherryR3.height * 1.35, 4);
      expect(saR3.radius).toBe(0.035);
      expect(saR3.topScale).toBe(0.72);
      expect(saR3.dishDepth).toBe(0.055);
      expect(saR3.dishType).toBe('spherical');
    });
  });

  describe('Kích thước hình học bao (getKeycapShape)', () => {
    it('đáy phím chuẩn = w * KEY_UNIT - KEYCAP_GAP', () => {
      const shape1u = getKeycapShape(1, 3, 'cherry');
      expect(shape1u.bottomWidth).toBeCloseTo(1 * KEY_UNIT - KEYCAP_GAP, 5);
      expect(shape1u.bottomDepth).toBeCloseTo(KEY_UNIT - KEYCAP_GAP, 5);

      const shape225u = getKeycapShape(2.25, 3, 'cherry');
      expect(shape225u.bottomWidth).toBeCloseTo(2.25 * KEY_UNIT - KEYCAP_GAP, 5);
    });

    it('mặt trên hẹp hơn mặt đáy theo tỷ lệ topScale', () => {
      const shape = getKeycapShape(1, 3, 'cherry');
      expect(shape.topWidth).toBeCloseTo(shape.bottomWidth * 0.78, 4);
      expect(shape.topDepth).toBeCloseTo(shape.bottomDepth * 0.78, 4);
    });
  });

  describe('Độ sâu lòng chảo và bề mặt (dishDepthAt & keycapSurfaceY)', () => {
    it('dishDepthAt đạt cực đại ở tâm (x=0, z=0) và bằng 0 ở rìa mép', () => {
      const shape = getKeycapShape(1, 3, 'cherry');
      const depthCenter = dishDepthAt(0, shape, 0);
      const depthEdge = dishDepthAt(shape.topWidth / 2, shape, 0);
      expect(depthCenter).toBeCloseTo(shape.dishDepth, 4);
      expect(depthEdge).toBeCloseTo(0, 4);
    });

    it('keycapSurfaceY tính chuẩn độ cao bề mặt trừ đi lòng chảo và độ nghiêng tilt', () => {
      const shape = getKeycapShape(1, 1, 'cherry');
      const yCenter = keycapSurfaceY(shape, 0, 0);
      expect(yCenter).toBeCloseTo(shape.height - shape.dishDepth, 4);
    });
  });

  describe('Biến dạng Vertex Mesh 3D (createKeycapGeometry)', () => {
    it('đáy keycap luôn nằm chính xác ở y = 0', () => {
      const profiles = ['cherry', 'oem', 'xda', 'moa', 'sa'] as const;
      profiles.forEach((profile) => {
        const geom = createKeycapGeometry(1, 3, profile);
        const box = bounds(geom);
        expect(box.min.y).toBeCloseTo(0, 4);
      });
    });

    it('mặt trên luôn hẹp hơn mặt đáy (Taper thu nhỏ x và z về đỉnh)', () => {
      const profiles = ['cherry', 'oem', 'xda', 'moa', 'sa'] as const;
      profiles.forEach((profile) => {
        const geom = createKeycapGeometry(1, 3, profile);
        const shape = getKeycapShape(1, 3, profile);
        const topWidth = widthAtBand(geom, shape.height - 0.015, shape.height + 0.015);
        const bottomWidth = widthAtBand(geom, 0, 0.015);
        expect(topWidth).toBeLessThan(bottomWidth);
      });
    });

    it('hàng 1 có mép sau cao hơn mép trước do độ dốc tilt', () => {
      const geom = createKeycapGeometry(1, 1, 'cherry');
      const pos = geom.attributes.position;
      let backTop = -Infinity;
      let frontTop = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getZ(i) < -0.1) backTop = Math.max(backTop, pos.getY(i));
        if (pos.getZ(i) > 0.1) frontTop = Math.max(frontTop, pos.getY(i));
      }
      expect(backTop).toBeGreaterThan(frontTop);
    });

    it('lòng chảo khoét lõm: đỉnh ở tâm mặt trên thấp hơn đỉnh ở viền cạnh', () => {
      const geom = createKeycapGeometry(1, 3, 'moa');
      const pos = geom.attributes.position;
      let centerTopY = Infinity;
      let edgeTopY = -Infinity;

      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const x = pos.getX(i);
        const z = pos.getZ(i);
        if (y > 0.15) {
          const distFromCenter = Math.sqrt(x * x + z * z);
          if (distFromCenter < 0.02) {
            centerTopY = Math.min(centerTopY, y);
          } else if (distFromCenter > 0.08 && distFromCenter < 0.13) {
            edgeTopY = Math.max(edgeTopY, y);
          }
        }
      }
      expect(centerTopY).toBeLessThan(edgeTopY);
    });

    it('tái sử dụng geometry từ cache khi cùng (profile, widthU, row)', () => {
      const g1 = createKeycapGeometry(2.25, 3, 'cherry');
      const g2 = createKeycapGeometry(2.25, 3, 'cherry');
      expect(g1).toBe(g2);

      const gMoa = createKeycapGeometry(2.25, 3, 'moa');
      expect(gMoa).not.toBe(g1);

      const gSa = createKeycapGeometry(2.25, 3, 'sa');
      expect(gSa).not.toBe(g1);
    });

    it('phím cách 6.25u có chiều rộng chuẩn xác theo quy đổi CAD', () => {
      const geom = createKeycapGeometry(6.25, 4, 'cherry');
      const box = bounds(geom);
      const expected = 6.25 * KEY_UNIT - KEYCAP_GAP;
      expect(box.max.x - box.min.x).toBeLessThanOrEqual(expected + 1e-4);
      expect(box.max.x - box.min.x).toBeGreaterThan(expected - 0.02);
    });

    it('disposeKeycapGeometries dọn dẹp cache không gây lỗi', () => {
      createKeycapGeometry(1, 3, 'cherry');
      createKeycapGeometry(1, 3, 'moa');
      expect(() => disposeKeycapGeometries()).not.toThrow();
    });
  });
});
