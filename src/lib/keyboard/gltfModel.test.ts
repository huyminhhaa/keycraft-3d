import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { STAGE_FLOOR_Y, applyNodePositions, fitToStage, prepareModel } from './gltfModel';
import type { ModelLayer } from './modelParts';

const mesh = (name: string, parent: THREE.Object3D, y = 0): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  m.name = name;
  m.position.y = y;
  parent.add(m);
  return m;
};

const group = (name: string, parent: THREE.Object3D, y = 0): THREE.Group => {
  const g = new THREE.Group();
  g.name = name;
  g.position.y = y;
  parent.add(g);
  return g;
};

/** Mô hình nhỏ giống cấu trúc file .glb xuất từ web */
const buildSample = () => {
  const root = new THREE.Group();
  const top = group('TopCase', root, 0.44);
  const caseMesh = mesh('', top);
  const bottom = group('BottomCase', root);
  const weight = mesh('Weight', bottom);
  const foot = mesh('Detail_Foot', bottom);
  const keycaps = group('Keycaps', root, 0.74);
  const keyA = group('Keycap_KeyA_alpha', keycaps, -0.17);
  const capA = mesh('', keyA);
  const legend = mesh('Legend', keyA);
  const space = group('Keycap_Space_modifier', keycaps, -0.17);
  const capSpace = mesh('', space);
  return { root, top, caseMesh, weight, foot, keycaps, keyA, capA, legend, space, capSpace };
};

const ZERO: Record<ModelLayer, number> = {
  bottomCase: 0,
  pcb: 0,
  foam: 0,
  plate: 0,
  switches: 0,
  keycaps: 0,
  topCase: 0,
};

describe('fitToStage', () => {
  it('file tính bằng mm được thu nhỏ đúng bề ngang, canh giữa và đặt đáy lên mặt bệ', () => {
    const box = new THREE.Box3(new THREE.Vector3(100, 10, -50), new THREE.Vector3(460, 40, 90));
    const fit = fitToStage(box, 7.2);
    expect(fit.scale).toBeCloseTo(0.02, 6);
    expect(fit.position[0]).toBeCloseTo(-280 * 0.02, 6);
    expect(fit.position[1]).toBeCloseTo(STAGE_FLOOR_Y - 10 * 0.02, 6);
    expect(fit.position[2]).toBeCloseTo(-20 * 0.02, 6);
  });

  it('hộp rỗng không chia cho 0', () => {
    expect(fitToStage(new THREE.Box3(), 7)).toEqual({ scale: 1, position: [0, STAGE_FLOOR_Y, 0] });
  });
});

describe('prepareModel', () => {
  it('tìm gốc lớp, keycap theo mã phím, và mesh cần đổi màu', () => {
    const s = buildSample();
    const { nodes, recolor } = prepareModel(s.root);

    const byObject = new Map(nodes.map((n) => [n.object, n]));
    expect(byObject.get(s.top)?.layer).toBe('topCase');
    expect(byObject.get(s.keycaps)?.layer).toBe('keycaps');
    expect(byObject.get(s.keyA)).toMatchObject({ keyCode: 'KeyA', layer: undefined, restY: -0.17 });
    expect(byObject.has(s.capA)).toBe(false);

    expect(recolor.case).toEqual([s.caseMesh]);
    expect(recolor.keycaps.alpha).toEqual([s.capA]);
    expect(recolor.keycaps.modifier).toEqual([s.capSpace]);
    // Tạ đồng, chân cao su và ký tự trên phím giữ vật liệu trong file
    [s.weight, s.foot, s.legend].forEach((m) => {
      expect(recolor.case).not.toContain(m);
      expect(recolor.keycaps.alpha).not.toContain(m);
    });
  });
});

describe('applyNodePositions', () => {
  it('tách lớp và nhấn phím, quy đổi theo tỉ lệ của file', () => {
    const s = buildSample();
    const { nodes } = prepareModel(s.root);
    applyNodePositions(nodes, { ...ZERO, topCase: 1, keycaps: 0.5 }, (code) => (code === 'KeyA' ? 0.07 : 0), 0.5);

    expect(s.top.position.y).toBeCloseTo(0.44 + 1 / 0.5, 6);
    expect(s.keycaps.position.y).toBeCloseTo(0.74 + 0.5 / 0.5, 6);
    expect(s.keyA.position.y).toBeCloseTo(-0.17 - 0.07 / 0.5, 6);
    expect(s.space.position.y).toBeCloseTo(-0.17, 6);
  });

  it('về 0 thì mọi bộ phận trở lại vị trí gốc trong file', () => {
    const s = buildSample();
    const { nodes } = prepareModel(s.root);
    applyNodePositions(nodes, { ...ZERO, topCase: 2 }, () => 0.07, 1);
    applyNodePositions(nodes, ZERO, () => 0, 1);
    expect(s.top.position.y).toBeCloseTo(0.44, 6);
    expect(s.keyA.position.y).toBeCloseTo(-0.17, 6);
  });
});
