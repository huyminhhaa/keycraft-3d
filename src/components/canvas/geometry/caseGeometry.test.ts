import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  CASE_BOTTOM_Y,
  FOOT,
  TYPING_ANGLE,
  createKnurledKnobGeometry,
  createWedgeCaseGeometry,
  createWeightGeometry,
  standoffPositions,
  wedgeBottomY,
} from './caseGeometry';
import { calculateLayerPositions } from '../KeyboardModel';
import { STAGE_FLOOR_Y } from '@/lib/keyboard/gltfModel';

const bounds = (geometry: THREE.BufferGeometry): THREE.Box3 => {
  geometry.computeBoundingBox();
  return geometry.boundingBox as THREE.Box3;
};

describe('vỏ nêm góc gõ 6.5°', () => {
  it('góc gõ đúng 6.5°', () => {
    expect(THREE.MathUtils.radToDeg(TYPING_ANGLE)).toBeCloseTo(6.5, 6);
  });

  it('mép sau thấp hơn mép trước (vỏ dày dần về phía sau)', () => {
    expect(wedgeBottomY(-1)).toBeLessThan(wedgeBottomY(1));
    expect(wedgeBottomY(1) - wedgeBottomY(-1)).toBeCloseTo(2 * Math.tan(TYPING_ANGLE), 6);
  });

  it('sau khi nghiêng cả bàn phím, mặt đáy nằm phẳng và chân cao su chạm mặt bệ', () => {
    // Điểm đáy (0, wedgeBottomY(z), z) xoay quanh X một góc TYPING_ANGLE: y thế giới phải như nhau với mọi z
    const worldY = (z: number) => new THREE.Vector3(0, wedgeBottomY(z), z).applyAxisAngle(new THREE.Vector3(1, 0, 0), TYPING_ANGLE).y;
    expect(worldY(-1.4)).toBeCloseTo(worldY(1.4), 6);
    expect(worldY(0) - FOOT.height).toBeCloseTo(STAGE_FLOOR_Y, 2);
  });

  it('thân vỏ: đỉnh ở mép ghép, đáy theo mặt nêm, có khoang rỗng', () => {
    const geometry = createWedgeCaseGeometry({
      width: 4,
      depth: 2,
      top: 0.12,
      cavity: { width: 3.4, depth: 1.4 },
      cornerRadius: 0.16,
    });
    const box = bounds(geometry);
    expect(box.max.y).toBeCloseTo(0.12, 4);
    expect(box.min.y).toBeCloseTo(wedgeBottomY(-1 - 0.03), 2);
    // Khoang rỗng: giữa vỏ không có đỉnh nào ở độ cao mép ghép
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i)) < 1 && Math.abs(pos.getZ(i)) < 0.5) expect(pos.getY(i)).toBeLessThan(0.12 - 0.05);
    }
  });

  it('trụ bắt ốc nằm trong vùng phím, đáy PCB cao hơn sàn ở mọi vị trí', () => {
    const pcbBottom = calculateLayerPositions(0).pcb - 0.015;
    standoffPositions(6, 2).forEach(([x, z]) => {
      expect(Math.abs(x)).toBeLessThan(3);
      expect(pcbBottom).toBeGreaterThan(wedgeBottomY(z) + 0.03);
    });
    expect(CASE_BOTTOM_Y).toBeLessThan(0);
  });
});

describe('tạ đồng và núm xoay', () => {
  it('tạ đồng dày đúng, đáy ở y = 0', () => {
    const box = bounds(createWeightGeometry(2, 1, 0.032));
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeCloseTo(0.032, 6);
  });

  it('núm xoay có rãnh khía: bán kính thân dao động, đỉnh vát nhỏ hơn thân', () => {
    const geometry = createKnurledKnobGeometry({ radius: 0.15, height: 0.36, ridges: 36, depth: 0.05 });
    const pos = geometry.attributes.position;
    let minR = Infinity;
    let maxR = 0;
    let topR = 0;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      if (pos.getY(i) < 0.2 && r > 0.1) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
      }
      if (pos.getY(i) > 0.359) topR = Math.max(topR, r);
    }
    expect(maxR).toBeCloseTo(0.15, 4);
    expect(minR).toBeCloseTo(0.15 * 0.95, 3);
    expect(topR).toBeLessThan(0.15 * 0.9);
  });
});
