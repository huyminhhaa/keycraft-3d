import { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { registerKeycapModels } from './geometry/keyboardGeometry';
import { registerCaseModel } from './geometry/caseModel';
import { registerSwitchModels } from './geometry/switchGeometry';

/** Model dựng bằng Blender: `npm run models` (scripts/models/*.py) */
export const KEYCAP_MODEL_URL = '/models/keycaps.glb';
export const SWITCH_MODEL_URL = '/models/switch.glb';
export const CASE_MODEL_URL = '/models/case.glb';
const MODEL_URLS = [KEYCAP_MODEL_URL, SWITCH_MODEL_URL, CASE_MODEL_URL];

/** Gom geometry theo tên node trong file glTF */
const meshesByName = (scene: THREE.Object3D): Map<string, THREE.BufferGeometry> => {
  const meshes = new Map<string, THREE.BufferGeometry>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.set(object.name, object.geometry as THREE.BufferGeometry);
  });
  return meshes;
};

/**
 * Nạp keycap, switch và vỏ dựng bằng Blender (Suspense: component gọi hook chờ tới khi tải xong,
 * 3 file tải song song) rồi đăng ký vào các bộ dựng hình học: mọi lớp dựng sau đó dùng model thật.
 * Tắt Draco/Meshopt: file không nén theo các chuẩn đó, và bộ giải nén cần WebAssembly bị CSP chặn.
 */
export function useKeyboardModels(): void {
  const [keycapGltf, switchGltf, caseGltf] = useGLTF(MODEL_URLS, false, false);

  useMemo(() => {
    const keycaps = meshesByName(keycapGltf.scene);
    const stem = keycaps.get('keycap_stem');
    keycaps.delete('keycap_stem');
    if (stem && keycaps.size > 0) registerKeycapModels(keycaps, stem);
  }, [keycapGltf]);

  useMemo(() => {
    const parts = meshesByName(switchGltf.scene);
    const [top, bottom, stem, spring] = ['switch_top', 'switch_bottom', 'switch_stem', 'switch_spring'].map((n) =>
      parts.get(n)
    );
    if (top && bottom && stem && spring) registerSwitchModels({ top, bottom, stem, spring });
  }, [switchGltf]);

  useMemo(() => {
    const template = meshesByName(caseGltf.scene).get('case_template');
    if (template) registerCaseModel(template);
  }, [caseGltf]);
}

useGLTF.preload(MODEL_URLS, false, false);
