import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getLayout } from '@/lib/keyboard/layouts';
import { KEY_UNIT } from './keyboardGeometry';
import {
  MM,
  STAB_CUTOUT,
  SWITCH_CUTOUT,
  createCutoutSlab,
  flexCuts,
  stabilizerCutouts,
  stabilizerSpacing,
  switchCutouts,
  type Cutout,
} from './plateGeometry';
import { gasketTabPositions } from '../parts/InternalLayers';

const overlaps = (a: Cutout, b: Cutout): boolean =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;

describe('kích thước chuẩn MX', () => {
  it('lỗ switch 14mm, 1u = 19.05mm', () => {
    expect(SWITCH_CUTOUT / KEY_UNIT).toBeCloseTo(14 / 19.05, 6);
    expect(MM * 19.05).toBeCloseTo(KEY_UNIT, 9);
  });

  it('khoảng cách stabilizer theo bảng Cherry; phím dưới 2u không có', () => {
    expect(stabilizerSpacing(1.75)).toBeNull();
    expect(stabilizerSpacing(2)! / MM).toBeCloseTo(11.938, 3);
    expect(stabilizerSpacing(2.75)! / MM).toBeCloseTo(11.938, 3);
    expect(stabilizerSpacing(6.25)! / MM).toBeCloseTo(50, 3);
    expect(stabilizerSpacing(7)! / MM).toBeCloseTo(57.15, 3);
  });
});

describe.each(['65%', '75%', 'TKL', '96%'] as const)('lỗ khoét plate layout %s', (id) => {
  const layout = getLayout(id);
  const switches = switchCutouts(layout.keys, layout.width, layout.depth);
  const stabs = stabilizerCutouts(layout.keys, layout.width, layout.depth);
  const flex = flexCuts(layout.keys, layout.width, layout.depth);
  const all = [...switches, ...stabs, ...flex];

  it('mỗi phím một lỗ, mỗi phím ≥ 2u hai lỗ stabilizer', () => {
    expect(switches).toHaveLength(layout.keys.length);
    expect(stabs).toHaveLength(layout.keys.filter((k) => k.w >= 2).length * 2);
  });

  it('không lỗ nào chồng lên lỗ nào (plate vẫn liền khối)', () => {
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) expect(overlaps(all[i], all[j])).toBe(false);
    }
  });

  it('mọi lỗ nằm trọn trong plate', () => {
    const halfW = (layout.width * KEY_UNIT) / 2;
    const halfD = (layout.depth * KEY_UNIT) / 2;
    all.forEach((cut) => {
      expect(Math.abs(cut.x) + cut.width / 2).toBeLessThan(halfW);
      expect(Math.abs(cut.z) + cut.depth / 2).toBeLessThan(halfD);
    });
  });
});

describe('createCutoutSlab', () => {
  it('dày đúng, nằm giữa y = ±thickness/2, có cache', () => {
    const cut: Cutout = { x: 0, z: 0.1, width: SWITCH_CUTOUT, depth: SWITCH_CUTOUT };
    const geometry = createCutoutSlab('test-slab', 1, 1, 0.04, [cut]);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox as THREE.Box3;
    expect(box.min.y).toBeCloseTo(-0.02, 6);
    expect(box.max.y).toBeCloseTo(0.02, 6);
    expect(createCutoutSlab('test-slab', 1, 1, 0.04, [cut])).toBe(geometry);
  });

  it('lỗ nằm đúng z thế giới (không bị lật dấu khi xoay shape)', () => {
    const cut: Cutout = { x: 0, z: 0.3, width: 0.2, depth: 0.2 };
    const geometry = createCutoutSlab('test-hole-z', 1, 1, 0.04, [cut]);
    const pos = geometry.attributes.position;
    // Không có đỉnh nào ở mặt trên nằm bên trong lỗ
    for (let i = 0; i < pos.count; i++) {
      const inside = Math.abs(pos.getX(i)) < 0.09 && Math.abs(pos.getZ(i) - 0.3) < 0.09;
      expect(inside).toBe(false);
    }
  });
});

describe('gasketTabPositions', () => {
  it('chia đều hai cạnh dài, tối thiểu 3 tai mỗi cạnh, nằm ngoài mép plate', () => {
    const tabs = gasketTabPositions(2, 1);
    expect(tabs).toHaveLength(6);
    tabs.forEach(([, z]) => expect(Math.abs(z)).toBeGreaterThan(0.5));
  });
});

it('lỗ stabilizer lệch về phía người gõ', () => {
  expect(STAB_CUTOUT.offsetZ).toBeGreaterThan(0);
});
