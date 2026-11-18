'use client';

import React, { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Một InstancedMesh đứng yên: cùng geometry + material, đặt ở nhiều vị trí (1 draw call cho mọi bản sao).
 * Dùng cho mọi linh kiện lặp lại: chân switch, socket hotswap, LED SMD, ốc vít, tai gasket…
 */
interface StaticInstancesProps {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  name?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Nhận InstancedMesh để cập nhật ma trận mỗi khung hình (stem lún theo keycap) */
  meshRef?: React.RefObject<THREE.InstancedMesh | null>;
}

export const StaticInstances: React.FC<StaticInstancesProps> = ({
  geometry,
  material,
  matrices,
  name,
  castShadow = false,
  receiveShadow = false,
  meshRef,
}) => {
  const ownRef = useRef<THREE.InstancedMesh>(null);
  const ref = meshRef ?? ownRef;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [matrices, ref]);

  if (matrices.length === 0) return null;
  return (
    <instancedMesh
      // Đổi số lượng bản sao (đổi layout) thì phải tạo InstancedMesh mới
      key={matrices.length}
      ref={ref}
      name={name}
      args={[geometry, material, matrices.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
};

const scratch = {
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  scale: new THREE.Vector3(),
  euler: new THREE.Euler(),
};

/** Ma trận từ vị trí (+ xoay quanh X/Y/Z, + co giãn), tiện cho việc dựng danh sách bản sao. */
export const composeMatrix = (
  x: number,
  y: number,
  z: number,
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1]
): THREE.Matrix4 => {
  scratch.position.set(x, y, z);
  scratch.quaternion.setFromEuler(scratch.euler.set(rotation[0], rotation[1], rotation[2]));
  scratch.scale.set(scale[0], scale[1], scale[2]);
  return new THREE.Matrix4().compose(scratch.position, scratch.quaternion, scratch.scale);
};
