import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getLayout } from '@/lib/keyboard/layouts';
import {
  CASE_BEZEL,
  KEYCAP_GAP,
  KEY_UNIT,
  createCaseGeometry,
  createKeycapGeometry,
  getCaseDimensions,
  getKeycapShape,
  keyCenter,
} from './keyboardGeometry';
import { getLegendLayout } from './legendTexture';

const bounds = (geometry: THREE.BufferGeometry) => {
  geometry.computeBoundingBox();
  return geometry.boundingBox as THREE.Box3;
};

/** Bề rộng (x) của các đỉnh nằm trong dải y cho trước. */
const widthAtBand = (geometry: THREE.BufferGeometry, yMin: number, yMax: number) => {
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

describe('Hình học keycap', () => {
  it('đáy nằm ở y = 0 và mặt trên hẹp hơn đáy (vát kiểu Cherry)', () => {
    const geometry = createKeycapGeometry(1, 3);
    const box = bounds(geometry);
    const shape = getKeycapShape(1, 3);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(widthAtBand(geometry, shape.height - 0.01, shape.height + 0.01)).toBeLessThan(
      widthAtBand(geometry, -0.001, 0.01)
    );
  });

  it('hàng 1 nghiêng về phía người gõ: mép sau cao hơn mép trước', () => {
    const geometry = createKeycapGeometry(1, 1);
    const pos = geometry.attributes.position;
    let backTop = -Infinity;
    let frontTop = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) < -0.1) backTop = Math.max(backTop, pos.getY(i));
      if (pos.getZ(i) > 0.1) frontTop = Math.max(frontTop, pos.getY(i));
    }
    expect(backTop).toBeGreaterThan(frontTop);
  });

  it('cache trả về cùng một geometry cho cùng (bề rộng, hàng)', () => {
    expect(createKeycapGeometry(2.25, 3)).toBe(createKeycapGeometry(2.25, 3));
    expect(createKeycapGeometry(2.25, 3)).not.toBe(createKeycapGeometry(2.25, 4));
  });

  it('phím 6.25u rộng xấp xỉ 6.25 × KEY_UNIT trừ khe hở (góc bo làm hụt dưới 2cm quy đổi)', () => {
    const box = bounds(createKeycapGeometry(6.25, 4));
    const expected = 6.25 * KEY_UNIT - KEYCAP_GAP;
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(expected + 1e-6);
    expect(box.max.x - box.min.x).toBeGreaterThan(expected - 0.02);
  });
});

describe('Hình học vỏ', () => {
  it('kích thước ngoài = vùng phím + viền hai bên', () => {
    const dims = getCaseDimensions(18.25, 6.25);
    expect(dims.outerWidth).toBeCloseTo(18.25 * KEY_UNIT + 2 * CASE_BEZEL, 6);
    expect(dims.outerDepth).toBeCloseTo(6.25 * KEY_UNIT + 2 * CASE_BEZEL, 6);
  });

  it('khối vỏ đứng trong khoảng [yBottom, yBottom + height]', () => {
    const box = bounds(createCaseGeometry(4, 2, 0.4, -0.2));
    expect(box.min.y).toBeCloseTo(-0.2, 4);
    expect(box.max.y).toBeCloseTo(0.2, 4);
  });

  it('tâm phím: Esc của TKL nằm ở góc trước-trái, mũi tên phải ở góc sau-phải', () => {
    const tkl = getLayout('TKL');
    const esc = tkl.keys.find((key) => key.code === 'Escape');
    const right = tkl.keys.find((key) => key.code === 'ArrowRight');
    if (!esc || !right) throw new Error('missing key');
    const [escX, escZ] = keyCenter(esc, tkl.width, tkl.depth);
    const [rightX, rightZ] = keyCenter(right, tkl.width, tkl.depth);
    expect(escX).toBeLessThan(0);
    expect(escZ).toBeLessThan(0);
    expect(rightX).toBeGreaterThan(0);
    expect(rightZ).toBeGreaterThan(0);
  });
});

describe('Kiểu sắp ký tự', () => {
  it('chọn đúng kiểu cho chữ cái, ký tự hai dòng, từ dài và mũi tên', () => {
    expect(getLegendLayout('Q')).toBe('single-large');
    expect(getLegendLayout(['!', '1'])).toBe('two-line');
    expect(getLegendLayout('Shift')).toBe('word');
    expect(getLegendLayout('←')).toBe('center');
  });
});
