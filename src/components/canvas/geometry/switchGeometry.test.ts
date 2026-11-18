import { KEYBOARD_LAYOUTS } from '@/types/keyboard';
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

  it('vá» trÃªn ngá»“i trÃªn plate, cao 4.5mm, Ä‘á»‰nh háº¹p hÆ¡n Ä‘Ã¡y', () => {
    const box = bounds(sw.topHousing);
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeCloseTo(TOP_HOUSING_HEIGHT, 6);
    const tapered = taperedBox(1, 1, 0.5, 0.5, 1);
    const pos = tapered.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0.5) expect(Math.abs(pos.getX(i))).toBeCloseTo(0.25, 6);
    }
  });

  it('vá» dÆ°á»›i lá»t qua lá»— 14mm, Ä‘Ã¡y cháº¡m PCB; trá»¥ giá»¯a vÃ  chÃ¢n cáº¯m xuyÃªn PCB', () => {
    const housing = bounds(sw.bottomHousing);
    expect(housing.max.x - housing.min.x).toBeCloseTo(14 * MM, 6);
    expect(housing.max.y).toBeCloseTo(0, 6);
    expect(housing.min.y).toBeLessThan(-PLATE_TO_PCB);
    expect(bounds(sw.pins).max.y).toBeLessThanOrEqual(-PLATE_TO_PCB + 1e-6);
  });

  it('stem chá»¯ tháº­p nhÃ´ khá»i vá» trÃªn tá»›i Ä‘á»‰nh 8.4mm', () => {
    const stem = bounds(sw.stem);
    expect(stem.max.y).toBeCloseTo(STEM_TOP, 6);
    expect(stem.max.x - stem.min.x).toBeCloseTo(5.6 * MM, 6);
  });

  it('thanh thÃ©p stabilizer dÃ i Ä‘Ãºng 1 Ä‘Æ¡n vá»‹ theo trá»¥c X (co giÃ£n theo tá»«ng phÃ­m)', () => {
    const wire = bounds(createStabilizerGeometries().wire);
    expect(wire.max.x - wire.min.x).toBeCloseTo(1, 6);
  });
});

describe('stabilizerMatrices', () => {
  it.each(KEYBOARD_LAYOUTS)('%s: 2 vá» + 1 thanh thÃ©p cho má»—i phÃ­m â‰¥ 2u', (id) => {
    const layout = getLayout(id);
    const long = layout.keys.filter((k) => k.w >= 2).length;
    const { housings, wires } = stabilizerMatrices(layout.keys, layout.width, layout.depth, -0.1);
    expect(housings).toHaveLength(long * 2);
    expect(wires).toHaveLength(long);
  });

  it('thanh thÃ©p phÃ­m cÃ¡ch dÃ i báº±ng khoáº£ng cÃ¡ch 2 vá» (100mm)', () => {
    const layout = getLayout('TKL');
    const space = layout.keys.filter((k) => k.code === 'Space');
    const { wires } = stabilizerMatrices(space, layout.width, layout.depth, 0);
    const scale = new THREE.Vector3();
    wires[0].decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    expect(scale.x / MM).toBeCloseTo(100, 3);
  });
});

describe('keycap lÃµm (dish) vÃ  kÃ½ tá»± in', () => {
  it('giá»¯a máº·t phÃ­m tháº¥p hÆ¡n mÃ©p trÃ¡i/pháº£i Ä‘Ãºng Ä‘á»™ sÃ¢u lÃ²ng cháº£o', () => {
    const shape = getKeycapShape(1, 3);
    expect(keycapSurfaceY(shape, shape.topWidth / 2, 0) - keycapSurfaceY(shape, 0, 0)).toBeCloseTo(DISH_DEPTH, 6);
  });

  it('Ä‘iá»ƒm tháº¥p nháº¥t cá»§a máº·t trÃªn lÃ  á»Ÿ giá»¯a, khÃ´ng tháº¥p hÆ¡n lÃ²ng cháº£o', () => {
    const shape = getKeycapShape(1, 3);
    const geometry = createKeycapGeometry(1, 3);
    const pos = geometry.attributes.position;
    let centerY = Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i)) < 1e-6 && Math.abs(pos.getZ(i)) < 1e-6 && pos.getY(i) > 0.05) centerY = pos.getY(i);
    }
    expect(centerY).toBeCloseTo(shape.height - DISH_DEPTH, 6);
  });

  it('máº·t trÃªn quay lÃªn, thÃ nh keycap quay ra ngoÃ i', () => {
    const geometry = createKeycapGeometry(1, 3);
    const pos = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i)) < 1e-6 && Math.abs(pos.getZ(i)) < 1e-6 && pos.getY(i) > 0.05) {
        expect(normal.getY(i)).toBeGreaterThan(0.9);
      }
    }
    // Trung bÃ¬nh phÃ¡p tuyáº¿n cÃ¡c Ä‘á»‰nh á»Ÿ mÃ©p pháº£i (giá»¯a chiá»u cao) hÆ°á»›ng +x
    let sumX = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getX(i) > 0.15 && pos.getY(i) > 0.02 && pos.getY(i) < 0.12) sumX += normal.getX(i);
    }
    expect(sumX).toBeGreaterThan(0);
  });

  it('kÃ½ tá»± in luÃ´n náº±m trÃªn máº·t phÃ­m (khÃ´ng chÃ¬m á»Ÿ mÃ©p, khÃ´ng lÆ¡ lá»­ng á»Ÿ giá»¯a)', () => {
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
