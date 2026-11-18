import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getLayout } from '@/lib/keyboard/layouts';
import { MM } from './plateGeometry';
import {
  PLATE_TO_PCB,
  STEM_TOP,
  TOP_HOUSING_HEIGHT,
  createStabilizerGeometries,
  createSwitchGeometries,
  taperedBox,
} from './switchGeometry';
import { stabilizerMatrices } from '../parts/SwitchLayer';
import {
  DISH_DEPTH,
  createKeycapGeometry,
  createLegendGeometry,
  getKeycapShape,
  keycapSurfaceY,
} from './keyboardGeometry';

const bounds = (geometry: THREE.BufferGeometry): THREE.Box3 => {
  geometry.computeBoundingBox();
  return geometry.boundingBox as THREE.Box3;
};

describe('switch MX 5-pin', () => {
  const sw = createSwitchGeometries();

  it('vỏ trên ngồi trên plate, cao 4.5mm, đỉnh hẹp hơn đáy', () => {
    const box = bounds(sw.topHousing);
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeCloseTo(TOP_HOUSING_HEIGHT, 6);
    const tapered = taperedBox(1, 1, 0.5, 0.5, 1);
    const pos = tapered.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0.5) expect(Math.abs(pos.getX(i))).toBeCloseTo(0.25, 6);
    }
  });

  it('vỏ dưới lọt qua lỗ 14mm, đáy chạm PCB; trụ giữa và chân cắm xuyên PCB', () => {
    const housing = bounds(sw.bottomHousing);
    expect(housing.max.x - housing.min.x).toBeCloseTo(14 * MM, 6);
    expect(housing.max.y).toBeCloseTo(0, 6);
    expect(housing.min.y).toBeLessThan(-PLATE_TO_PCB);
    expect(bounds(sw.pins).max.y).toBeLessThanOrEqual(-PLATE_TO_PCB + 1e-6);
  });

  it('stem chữ thập nhô khỏi vỏ trên tới đỉnh 8.4mm', () => {
    const stem = bounds(sw.stem);
    expect(stem.max.y).toBeCloseTo(STEM_TOP, 6);
    expect(stem.max.x - stem.min.x).toBeCloseTo(5.6 * MM, 6);
  });

  it('thanh thép stabilizer dài đúng 1 đơn vị theo trục X (co giãn theo từng phím)', () => {
    const wire = bounds(createStabilizerGeometries().wire);
    expect(wire.max.x - wire.min.x).toBeCloseTo(1, 6);
  });
});

describe('stabilizerMatrices', () => {
  it.each(['65%', '75%', 'TKL', '96%'] as const)('%s: 2 vỏ + 1 thanh thép cho mỗi phím ≥ 2u', (id) => {
    const layout = getLayout(id);
    const long = layout.keys.filter((k) => k.w >= 2).length;
    const { housings, wires } = stabilizerMatrices(layout.keys, layout.width, layout.depth, -0.1);
    expect(housings).toHaveLength(long * 2);
    expect(wires).toHaveLength(long);
  });

  it('thanh thép phím cách dài bằng khoảng cách 2 vỏ (100mm)', () => {
    const layout = getLayout('TKL');
    const space = layout.keys.filter((k) => k.code === 'Space');
    const { wires } = stabilizerMatrices(space, layout.width, layout.depth, 0);
    const scale = new THREE.Vector3();
    wires[0].decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    expect(scale.x / MM).toBeCloseTo(100, 3);
  });
});

describe('keycap lõm (dish) và ký tự in', () => {
  it('giữa mặt phím thấp hơn mép trái/phải đúng độ sâu lòng chảo', () => {
    const shape = getKeycapShape(1, 3);
    expect(keycapSurfaceY(shape, shape.topWidth / 2, 0) - keycapSurfaceY(shape, 0, 0)).toBeCloseTo(DISH_DEPTH, 6);
  });

  it('điểm thấp nhất của mặt trên là ở giữa, không thấp hơn lòng chảo', () => {
    const shape = getKeycapShape(1, 3);
    const geometry = createKeycapGeometry(1, 3);
    const pos = geometry.attributes.position;
    let centerY = Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i)) < 1e-6 && Math.abs(pos.getZ(i)) < 1e-6 && pos.getY(i) > 0.05) centerY = pos.getY(i);
    }
    expect(centerY).toBeCloseTo(shape.height - DISH_DEPTH, 6);
  });

  it('mặt trên quay lên, thành keycap quay ra ngoài', () => {
    const geometry = createKeycapGeometry(1, 3);
    const pos = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i)) < 1e-6 && Math.abs(pos.getZ(i)) < 1e-6 && pos.getY(i) > 0.05) {
        expect(normal.getY(i)).toBeGreaterThan(0.9);
      }
    }
    // Trung bình pháp tuyến các đỉnh ở mép phải (giữa chiều cao) hướng +x
    let sumX = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getX(i) > 0.15 && pos.getY(i) > 0.02 && pos.getY(i) < 0.12) sumX += normal.getX(i);
    }
    expect(sumX).toBeGreaterThan(0);
  });

  it('ký tự in luôn nằm trên mặt phím (không chìm ở mép, không lơ lửng ở giữa)', () => {
    const shape = getKeycapShape(2.25, 2);
    const legend = createLegendGeometry(2.25, 2, shape.topWidth - 0.03, shape.topDepth - 0.03);
    const pos = legend.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const gap = pos.getY(i) - keycapSurfaceY(shape, pos.getX(i), pos.getZ(i));
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(0.002);
    }
  });
});
