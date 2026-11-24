// @vitest-environment node
// (jsdom có ArrayBuffer khác "realm" với Buffer của Node -> GLTFLoader không nhận ra file .glb nhị phân)
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KEYCAP_PROFILES } from '@/types/keyboard';
import {
  KEY_UNIT,
  createKeycapGeometry,
  createLegendGeometry,
  dishDepthAt,
  getKeycapShape,
  hasKeycapModels,
  keycapModelName,
  keycapStretch,
  keycapSurfaceY,
  registerKeycapModels,
  stretchKeycap,
} from './keyboardGeometry';

/**
 * Kiểm tra keycap dựng bằng Blender (public/models/keycaps.glb) khớp với code web:
 * đủ model, đúng kích thước, mặt phím đúng công thức (chữ in nằm khít), kéo giãn phím dài đúng.
 */

const ROOT = process.cwd();
const ROWS = [1, 2, 3, 4] as const;

const loadKeycapGlb = (): Promise<Map<string, THREE.BufferGeometry>> =>
  new Promise((resolve, reject) => {
    const file = readFileSync(join(ROOT, 'public', 'models', 'keycaps.glb'));
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    new GLTFLoader().parse(
      buffer,
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

const bounds = (geometry: THREE.BufferGeometry): THREE.Box3 => {
  geometry.computeBoundingBox();
  return geometry.boundingBox as THREE.Box3;
};

/** Độ cao đỉnh cao nhất của lưới gần điểm (x, z) trên mặt phím */
const topYNear = (geometry: THREE.BufferGeometry, x: number, z: number, radius = 0.004): number => {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  let best = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (Math.hypot(pos.getX(i) - x, pos.getZ(i) - z) <= radius) best = Math.max(best, pos.getY(i));
  }
  return best;
};

let meshes: Map<string, THREE.BufferGeometry>;

beforeAll(async () => {
  meshes = await loadKeycapGlb();
});

describe('keycaps.glb (dựng bằng Blender)', () => {
  it('có đủ 1 keycap 1u cho mọi profile × hàng, và trụ chữ thập', () => {
    for (const profile of KEYCAP_PROFILES) {
      for (const row of ROWS) expect(meshes.has(keycapModelName(profile, row))).toBe(true);
    }
    expect(meshes.has('keycap_stem')).toBe(true);
  });

  it('đáy keycap 1u đúng kích thước của web, đáy nằm ở y = 0', () => {
    const shape = getKeycapShape(1, 3, 'cherry');
    const box = bounds(meshes.get('keycap_cherry_r3') as THREE.BufferGeometry);
    expect(box.max.x - box.min.x).toBeCloseTo(shape.bottomWidth, 2);
    expect(box.max.z - box.min.z).toBeCloseTo(shape.bottomDepth, 2);
    expect(box.min.y).toBeCloseTo(0, 4);
  });

  it('tâm mặt phím đúng công thức keycapSurfaceY (chữ in trên web không chìm / lơ lửng)', () => {
    for (const profile of KEYCAP_PROFILES) {
      for (const row of ROWS) {
        const shape = getKeycapShape(1, row, profile);
        const geometry = meshes.get(keycapModelName(profile, row)) as THREE.BufferGeometry;
        expect(topYNear(geometry, 0, 0)).toBeCloseTo(keycapSurfaceY(shape, 0, 0), 3);
      }
    }
  });

  it('thông số đã xuất cho Blender khớp code web (quên chạy `npm run models:keycaps` sau khi đổi kích thước là đỏ)', () => {
    const specs = JSON.parse(readFileSync(join(ROOT, 'scripts', 'models', 'keycap-specs.json'), 'utf8')) as {
      keycaps: Array<{ name: string; bottomWidth: number; topWidth: number; height: number; tilt: number }>;
    };
    for (const profile of KEYCAP_PROFILES) {
      for (const row of ROWS) {
        const shape = getKeycapShape(1, row, profile);
        const spec = specs.keycaps.find((s) => s.name === keycapModelName(profile, row));
        expect(spec).toBeDefined();
        expect(spec?.bottomWidth).toBeCloseTo(shape.bottomWidth, 6);
        expect(spec?.topWidth).toBeCloseTo(shape.topWidth, 6);
        expect(spec?.height).toBeCloseTo(shape.height, 6);
        expect(spec?.tilt).toBeCloseTo(shape.tilt, 6);
      }
    }
  });
});

describe('Kéo giãn keycap 1u thành phím dài', () => {
  it('keycapStretch: 1u không kéo, 6.25u kéo mỗi bên (6.25 - 1) × 1u / 2', () => {
    expect(keycapStretch(1)).toBe(0);
    expect(keycapStretch(6.25)).toBeCloseTo((5.25 * KEY_UNIT) / 2, 9);
  });

  it('bề rộng sau khi kéo = w × 1u − khe hở, đỉnh đúng trục giữa đứng yên', () => {
    const base = meshes.get('keycap_cherry_r4') as THREE.BufferGeometry;
    const shape = getKeycapShape(6.25, 4, 'cherry');
    const stretched = stretchKeycap(base, shape.stretch);
    const box = bounds(stretched);
    expect(box.max.x - box.min.x).toBeCloseTo(shape.bottomWidth, 2);
    // Bản gốc không bị sửa
    expect(bounds(base).max.x).toBeLessThan(KEY_UNIT);
  });

  it('lòng chảo phím dài: đoạn giữa phẳng bằng tâm 1u, hai đầu cong như mép 1u', () => {
    const unit = getKeycapShape(1, 3, 'cherry');
    const wide = getKeycapShape(2.25, 3, 'cherry');
    expect(dishDepthAt(0, wide)).toBeCloseTo(dishDepthAt(0, unit), 9);
    expect(dishDepthAt(wide.stretch * 0.9, wide)).toBeCloseTo(dishDepthAt(0, unit), 9);
    expect(dishDepthAt(wide.stretch + 0.05, wide)).toBeCloseTo(dishDepthAt(0.05, unit), 9);
  });
});

describe('createKeycapGeometry dùng model Blender sau khi đăng ký', () => {
  it('trước khi đăng ký: dùng keycap dựng bằng code', () => {
    expect(hasKeycapModels()).toBe(false);
  });

  it('sau khi đăng ký: keycap rỗng ruột có trụ chữ thập, chữ in vẫn khít mặt phím', () => {
    const bases = new Map([...meshes].filter(([name]) => name !== 'keycap_stem'));
    registerKeycapModels(bases, meshes.get('keycap_stem') as THREE.BufferGeometry);
    expect(hasKeycapModels()).toBe(true);

    const shape = getKeycapShape(2.25, 2, 'cherry');
    const geometry = createKeycapGeometry(2.25, 2, 'cherry');
    // Model có nhiều đỉnh hơn hẳn keycap dựng bằng code, và có UV + pháp tuyến cho vật liệu PBT
    expect(geometry.attributes.position.count).toBeGreaterThan(1500);
    expect(geometry.attributes.uv).toBeDefined();
    expect(geometry.attributes.normal).toBeDefined();
    expect(bounds(geometry).max.x - bounds(geometry).min.x).toBeCloseTo(shape.bottomWidth, 2);

    // Mặt phím của lưới khớp công thức tại nhiều điểm (kể cả vùng bị kéo giãn: chỉ có tam giác dài,
    // không có đỉnh -> bắn tia từ trên xuống để đo đúng mặt lưới)
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const raycaster = new THREE.Raycaster();
    const surfaceAt = (x: number, z: number): number => {
      raycaster.set(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
      return raycaster.intersectObject(mesh)[0]?.point.y ?? NaN;
    };
    for (const x of [0, shape.stretch * 0.5, shape.stretch + 0.03, -(shape.stretch + 0.06)]) {
      for (const z of [0, 0.05, -0.05]) {
        expect(Math.abs(surfaceAt(x, z) - keycapSurfaceY(shape, x, z))).toBeLessThan(0.0012);
      }
    }

    // Chữ in nằm trên mặt phím
    const legend = createLegendGeometry(2.25, 2, shape.topWidth - 0.03, shape.topDepth - 0.03);
    const pos = legend.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 5) {
      expect(pos.getY(i)).toBeGreaterThan(keycapSurfaceY(shape, pos.getX(i), pos.getZ(i)));
    }
  });
});
