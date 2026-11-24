import { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { registerKeycapModels } from './geometry/keyboardGeometry';

/** Keycap dựng bằng Blender: `npm run models:keycaps` (scripts/models/build_keycaps.py) */
export const KEYCAP_MODEL_URL = '/models/keycaps.glb';

/**
 * Nạp keycaps.glb (Suspense: component gọi hook này chờ tới khi tải xong) rồi đăng ký vào
 * keyboardGeometry, để mọi keycap dựng sau đó dùng model thật.
 * Tắt Draco/Meshopt: file không nén theo các chuẩn đó, và bộ giải nén cần WebAssembly bị CSP chặn.
 */
export function useKeycapModels(): void {
  const gltf = useGLTF(KEYCAP_MODEL_URL, false, false);

  useMemo(() => {
    const bases = new Map<string, THREE.BufferGeometry>();
    let stem: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry as THREE.BufferGeometry;
      if (object.name === 'keycap_stem') stem = geometry;
      else if (object.name.startsWith('keycap_')) bases.set(object.name, geometry);
    });
    if (stem && bases.size > 0) registerKeycapModels(bases, stem);
  }, [gltf]);
}

useGLTF.preload(KEYCAP_MODEL_URL, false, false);
