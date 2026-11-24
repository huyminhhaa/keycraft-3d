// @vitest-environment node
// (jsdom có ArrayBuffer khác "realm" với Buffer của Node -> GLTFLoader không nhận ra file .glb nhị phân)
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CASE_TEMPLATE, fitCaseTemplate, getCaseTemplate, registerCaseModel, type CaseFit } from './caseModel';
import { CASE_BEVEL, createCaseGeometry } from './keyboardGeometry';
import {
  PLATE_TO_PCB,
  STEM_TOP,
  TOP_HOUSING_HEIGHT,
  createSwitchGeometries,
  hasSwitchModels,
  registerSwitchModels,
} from './switchGeometry';

/** Vỏ mẫu (case.glb) và switch (switch.glb) dựng bằng Blender khớp với code web. */

const loadGlb = (file: string): Promise<Map<string, THREE.BufferGeometry>> =>
  new Promise((resolve, reject) => {
    const data = readFileSync(join(process.cwd(), 'public', 'models', file));
    new GLTFLoader().parse(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      '',
      (gltf) => {
        const meshes = new Map<string, THREE.BufferGeometry>();
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) meshes.set(o.name, o.geometry as THREE.BufferGeometry);
        });
        resolve(meshes);
      },
      reject
    );
  });

const bounds = (g: THREE.BufferGeometry): THREE.Box3 => {
  g.computeBoundingBox();
  return g.boundingBox as THREE.Box3;
};

let caseMeshes: Map<string, THREE.BufferGeometry>;
let switchMeshes: Map<string, THREE.BufferGeometry>;

beforeAll(async () => {
  [caseMeshes, switchMeshes] = await Promise.all([loadGlb('case.glb'), loadGlb('switch.glb')]);
});

describe('Vỏ mẫu Blender (case.glb)', () => {
  const fit: CaseFit = {
    width: 6.2,
    depth: 2.4,
    height: 0.44,
    yBottom: -0.32,
    hole: { width: 5.8, depth: 1.98 },
    cornerRadius: 0.12,
    bevel: CASE_BEVEL,
  };

  it('vỏ mẫu đúng kích thước ghi trong CASE_TEMPLATE', () => {
    const template = caseMeshes.get('case_template') as THREE.BufferGeometry;
    const box = bounds(template);
    expect(box.max.x).toBeCloseTo(CASE_TEMPLATE.outerHalf, 3);
    expect(box.max.y).toBeCloseTo(CASE_TEMPLATE.height, 3);
    expect(box.min.y).toBeCloseTo(0, 4);
  });

  it('nắn đúng kích thước ngoài, chiều cao và vị trí đáy', () => {
    const template = caseMeshes.get('case_template') as THREE.BufferGeometry;
    const box = bounds(fitCaseTemplate(template, fit));
    expect(box.max.x - box.min.x).toBeCloseTo(fit.width + 2 * CASE_BEVEL, 3);
    expect(box.max.z - box.min.z).toBeCloseTo(fit.depth + 2 * CASE_BEVEL, 3);
    expect(box.min.y).toBeCloseTo(fit.yBottom, 4);
    expect(box.max.y).toBeCloseTo(fit.yBottom + fit.height, 4);
  });

  it('mép vát kim cương và miệng lỗ khoang giữ đúng kích thước thật sau khi nắn', () => {
    const template = caseMeshes.get('case_template') as THREE.BufferGeometry;
    const geometry = fitCaseTemplate(template, fit);
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const top = fit.yBottom + fit.height;
    let outerTop = 0;
    let innerTop = Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - top) > 1e-5 || Math.abs(pos.getZ(i)) > 1e-5) continue;
      outerTop = Math.max(outerTop, Math.abs(pos.getX(i)));
      innerTop = Math.min(innerTop, Math.abs(pos.getX(i)));
    }
    expect(outerTop).toBeCloseTo(fit.width / 2 + CASE_BEVEL - CASE_TEMPLATE.topChamfer, 5);
    expect(innerTop).toBeCloseTo(fit.hole.width / 2 + CASE_TEMPLATE.holeChamfer, 5);
  });

  it('góc bo ngoài đổi đúng bán kính của mẫu bàn phím', () => {
    const template = caseMeshes.get('case_template') as THREE.BufferGeometry;
    const geometry = fitCaseTemplate(template, fit);
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const radius = fit.cornerRadius + CASE_BEVEL;
    const cx = fit.width / 2 + CASE_BEVEL - radius;
    const cz = fit.depth / 2 + CASE_BEVEL - radius;
    // Vòng đỉnh thành ngoài (ngay dưới mép vát)
    const wallTopY = fit.yBottom + fit.height - CASE_TEMPLATE.topChamfer;
    let checked = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Điểm thành ngoài nằm trong góc trước-phải
      if (x <= cx + 1e-6 || z <= cz + 1e-6 || Math.abs(pos.getY(i) - wallTopY) > 1e-5) continue;
      expect(Math.hypot(x - cx, z - cz)).toBeCloseTo(radius, 4);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('có UV để vật liệu phun cát / vân gỗ hiển thị, vỏ mẫu gốc không bị sửa', () => {
    const template = caseMeshes.get('case_template') as THREE.BufferGeometry;
    const before = bounds(template).max.x;
    const geometry = fitCaseTemplate(template, fit);
    expect(geometry.attributes.uv).toBeDefined();
    expect(bounds(template).max.x).toBe(before);
  });

  it('createCaseGeometry dùng vỏ mẫu sau khi đăng ký (khung có lỗ); không có lỗ thì vẫn dựng bằng code', () => {
    expect(getCaseTemplate()).toBeNull();
    registerCaseModel(caseMeshes.get('case_template') as THREE.BufferGeometry);
    const framed = createCaseGeometry(4, 2, 0.4, -0.2, { width: 3.6, depth: 1.6 }, 0.1);
    expect(framed).not.toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(createCaseGeometry(4, 2, 0.4, -0.2)).toBeInstanceOf(THREE.ExtrudeGeometry);
  });
});

describe('Switch Blender (switch.glb)', () => {
  it('đủ 4 bộ phận: vỏ trên, vỏ dưới, stem, lò xo', () => {
    for (const name of ['switch_top', 'switch_bottom', 'switch_stem', 'switch_spring']) {
      expect(switchMeshes.has(name)).toBe(true);
    }
  });

  it('kích thước MX: vỏ trên ngồi trên plate cao 4.5mm, stem nhô tới 8.4mm, vỏ dưới xuyên tới PCB', () => {
    const top = bounds(switchMeshes.get('switch_top') as THREE.BufferGeometry);
    expect(top.min.y).toBeCloseTo(0, 3);
    expect(top.max.y).toBeCloseTo(TOP_HOUSING_HEIGHT, 3);
    expect(bounds(switchMeshes.get('switch_stem') as THREE.BufferGeometry).max.y).toBeCloseTo(STEM_TOP, 3);
    expect(bounds(switchMeshes.get('switch_bottom') as THREE.BufferGeometry).min.y).toBeLessThan(-PLATE_TO_PCB);
  });

  it('createSwitchGeometries dùng model (có lò xo) sau khi đăng ký', () => {
    expect(hasSwitchModels()).toBe(false);
    expect(createSwitchGeometries().spring).toBeUndefined();
    const get = (n: string) => switchMeshes.get(n) as THREE.BufferGeometry;
    registerSwitchModels({ top: get('switch_top'), bottom: get('switch_bottom'), stem: get('switch_stem'), spring: get('switch_spring') });
    const geometries = createSwitchGeometries();
    expect(geometries.topHousing).toBe(get('switch_top'));
    expect(geometries.spring).toBe(get('switch_spring'));
    // Cửa sổ LED và chân đồng vẫn dựng bằng code
    expect(geometries.lens).toBeDefined();
    expect(geometries.pins).toBeDefined();
  });
});
