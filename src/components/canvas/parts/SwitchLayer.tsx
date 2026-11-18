'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { PlacedKey } from '@/lib/keyboard/layouts';
import type { SwitchColors } from '@/types/keyboard';
import { keyCenter } from '../geometry/keyboardGeometry';
import { stabilizerPositions } from '../geometry/plateGeometry';
import { STAB_WIRE, createStabilizerGeometries, createSwitchGeometries } from '../geometry/switchGeometry';
import { StaticInstances, composeMatrix } from './StaticInstances';

interface SwitchLayerProps {
  keys: PlacedKey[];
  layoutWidth: number;
  layoutDepth: number;
  stemColor: string;
  /** Màu switch thật của build (nếu đã tra được) */
  switchColors?: SwitchColors;
  /** Độ cao mặt trên plate trong toạ độ của group switch (khi đã ghép lớp) */
  plateTopY: number;
  /** Độ lún hiện tại của keycap (≤ 0) để stem lún theo */
  getKeyOffset: (code: string) => number;
}

/** Hình học dùng chung cho mọi bàn phím: tạo một lần */
let sharedGeometries: { switch: ReturnType<typeof createSwitchGeometries>; stab: ReturnType<typeof createStabilizerGeometries> } | null =
  null;
const geometries = () => {
  sharedGeometries ??= { switch: createSwitchGeometries(), stab: createStabilizerGeometries() };
  return sharedGeometries;
};

/** Ma trận đặt stabilizer: 2 vỏ mỗi phím ≥ 2u, 1 thanh thép nối ngang */
export const stabilizerMatrices = (
  keys: PlacedKey[],
  layoutWidth: number,
  layoutDepth: number,
  plateTopY: number
): { housings: THREE.Matrix4[]; wires: THREE.Matrix4[] } => {
  const housings: THREE.Matrix4[] = [];
  const wires: THREE.Matrix4[] = [];
  keys.forEach((key) => {
    const pair = stabilizerPositions(key, layoutWidth, layoutDepth);
    if (pair.length !== 2) return;
    pair.forEach(([x, z]) => housings.push(composeMatrix(x, plateTopY, z)));
    const [[x0, z0], [x1]] = pair;
    wires.push(composeMatrix((x0 + x1) / 2, plateTopY + STAB_WIRE.y, z0 + STAB_WIRE.z, [0, 0, 0], [x1 - x0, 1, 1]));
  });
  return { housings, wires };
};

/** Màu mặc định: vỏ trên PC trong, đế nylon đen (stem lấy theo loại switch) */
const DEFAULT_SWITCH_COLORS: SwitchColors = { top: '#f6f5f1', bottom: '#232326', stem: '#d9342b', topOpacity: 0.32 };

export const SwitchLayer: React.FC<SwitchLayerProps> = ({
  keys,
  layoutWidth,
  layoutDepth,
  stemColor,
  switchColors,
  plateTopY,
  getKeyOffset,
}) => {
  const { switch: sw, stab } = geometries();

  const materials = useMemo(
    () => ({
      // Vỏ trên polycarbonate trong mờ: thấy lờ mờ lò xo và stem bên trong
      // depthWrite tắt: 87 vỏ trong suốt chồng nhau không che mất stem/vỏ phía sau
      top: new THREE.MeshPhysicalMaterial({
        color: '#f6f5f1',
        roughness: 0.08,
        transparent: true,
        opacity: 0.32,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        specularIntensity: 1,
        depthWrite: false,
      }),
      lens: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.2, transparent: true, opacity: 0.7, depthWrite: false }),
      bottom: new THREE.MeshPhysicalMaterial({ color: '#232326', roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
      gold: new THREE.MeshStandardMaterial({ color: '#d6ab4b', roughness: 0.22, metalness: 1 }),
      // Màu stem đặt trong useEffect bên dưới: đổi switch không phải tạo lại cả bộ vật liệu
      stem: new THREE.MeshStandardMaterial({ roughness: 0.42 }),
      stabHousing: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.48 }),
      wire: new THREE.MeshStandardMaterial({ color: '#cdb06a', roughness: 0.25, metalness: 1 }),
    }),
    []
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  // Màu thật của switch theo build (Cocoa vỏ kem stem nâu, HMX Violet tím…); không có thì vỏ trong, đế đen, stem theo loại
  useEffect(() => {
    const colors = switchColors ?? DEFAULT_SWITCH_COLORS;
    materials.top.color.set(colors.top);
    // Vỏ đục (POM/nylon) vẽ như vật đặc; vỏ PC trong mới bật trong suốt + tắt ghi độ sâu
    const clear = colors.topOpacity < 0.9;
    materials.top.setValues({
      opacity: clear ? colors.topOpacity : 1,
      transparent: clear,
      depthWrite: !clear,
      roughness: clear ? 0.08 : 0.38,
    });
    // eslint-disable-next-line react-hooks/immutability -- đổi transparent cần biên dịch lại shader của vật liệu Three.js
    materials.top.needsUpdate = true;
    materials.bottom.color.set(colors.bottom);
    materials.stem.color.set(switchColors ? switchColors.stem : stemColor);
  }, [materials, stemColor, switchColors]);

  const centers = useMemo(() => keys.map((key) => keyCenter(key, layoutWidth, layoutDepth)), [keys, layoutWidth, layoutDepth]);
  const matrices = useMemo(() => centers.map(([x, z]) => composeMatrix(x, plateTopY, z)), [centers, plateTopY]);
  const stabs = useMemo(() => stabilizerMatrices(keys, layoutWidth, layoutDepth, plateTopY), [keys, layoutWidth, layoutDepth, plateTopY]);

  /* ---------------- Stem lún theo keycap ---------------- */
  const stemRef = useRef<THREE.InstancedMesh>(null);
  const lastOffsets = useRef<Float32Array>(new Float32Array(0));
  const scratch = useMemo(() => new THREE.Matrix4(), []);
  // Đổi layout: StaticInstances đặt lại stem về vị trí nghỉ, nên quên các độ lún đã ghi
  useEffect(() => {
    lastOffsets.current = new Float32Array(0);
  }, [matrices]);

  useFrame(() => {
    const mesh = stemRef.current;
    if (!mesh) return;
    if (lastOffsets.current.length !== keys.length) lastOffsets.current = new Float32Array(keys.length);
    let changed = false;
    keys.forEach((key, i) => {
      const offset = getKeyOffset(key.code);
      if (Math.abs(offset - lastOffsets.current[i]) < 1e-5) return;
      lastOffsets.current[i] = offset;
      const [x, z] = centers[i];
      scratch.makeTranslation(x, plateTopY + offset, z);
      mesh.setMatrixAt(i, scratch);
      changed = true;
    });
    if (changed) mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <StaticInstances name="Detail_SwitchTopHousing" geometry={sw.topHousing} material={materials.top} matrices={matrices} />
      <StaticInstances name="Detail_SwitchLens" geometry={sw.lens} material={materials.lens} matrices={matrices} />
      <StaticInstances name="Detail_SwitchBottomHousing" geometry={sw.bottomHousing} material={materials.bottom} matrices={matrices} castShadow />
      <StaticInstances name="Detail_SwitchPins" geometry={sw.pins} material={materials.gold} matrices={matrices} />
      <StaticInstances name="Detail_SwitchStem" geometry={sw.stem} material={materials.stem} matrices={matrices} meshRef={stemRef} castShadow />
      <StaticInstances name="Detail_StabHousing" geometry={stab.housing} material={materials.stabHousing} matrices={stabs.housings} castShadow />
      <StaticInstances name="Detail_StabWire" geometry={stab.wire} material={materials.wire} matrices={stabs.wires} />
    </>
  );
};
