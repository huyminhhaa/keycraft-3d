'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import type { GlbModelEntry } from '@/lib/keyboard/models';
import { isKeyPressed } from '@/lib/keyboard/pressedKeys';
import { applyNodePositions, fitToStage, prepareModel } from '@/lib/keyboard/gltfModel';
import type { ModelLayer } from '@/lib/keyboard/modelParts';
import { prefersReducedMotion, stepColorToward } from '@/lib/ui/cinematic';
import { KEY_TRAVEL, calculateLayerPositions, getCaseMaterialProps, getModelWidth, getPlateMaterialProps } from './KeyboardModel';

const COLOR_SPEED = 7;
/** setValues chỉ ghi đè thuộc tính được truyền: trả các thuộc tính về mặc định trước khi đổi chất liệu (vd PC trong suốt → nhôm) */
const MATERIAL_RESET: Partial<THREE.MeshPhysicalMaterialParameters> = {
  roughness: 1,
  metalness: 0,
  transmission: 0,
  thickness: 0,
  transparent: false,
  opacity: 1,
  clearcoat: 0,
  clearcoatRoughness: 0,
};
const REST = calculateLayerPositions(0);

const layerDeltas = (offset: number): Record<ModelLayer, number> => {
  const at = calculateLayerPositions(offset);
  return {
    bottomCase: at.bottomCase - REST.bottomCase,
    pcb: at.pcb - REST.pcb,
    foam: at.foam - REST.foam,
    plate: at.plate - REST.plate,
    switches: at.switches - REST.switches,
    keycaps: at.keycaps - REST.keycaps,
    topCase: at.topCase - REST.topCase,
  };
};

/**
 * Bàn phím nạp từ file .glb. Bộ phận được nhận theo tên (modelParts.ts) để:
 * tách lớp như mẫu dựng bằng code, nhấn phím khi gõ, và (nếu `recolor`) lấy màu/chất liệu đang chọn.
 */
export const GltfKeyboard: React.FC<{ entry: GlbModelEntry }> = ({ entry }) => {
  const { scene } = useGLTF(entry.url);
  const isExploded = useKeyboardStore((s) => s.isExploded);
  const explosionOffset = useKeyboardStore((s) => s.explosionOffset);
  const caseMaterial = useKeyboardStore((s) => s.caseMaterial);
  const caseColor = useKeyboardStore((s) => s.caseColor);
  const plateMaterial = useKeyboardStore((s) => s.plateMaterial);
  const keycapColor = useKeyboardStore((s) => s.keycapColor);
  const keycapModifierColor = useKeyboardStore((s) => s.keycapModifierColor);
  const keycapAccentColor = useKeyboardStore((s) => s.keycapAccentColor);

  // Bản sao riêng: useGLTF cache scene theo url, sửa trực tiếp sẽ hỏng lần nạp sau
  const model = useMemo(() => scene.clone(true), [scene]);
  const prepared = useMemo(() => prepareModel(model), [model]);
  const fit = useMemo(
    () => fitToStage(new THREE.Box3().setFromObject(model), getModelWidth(entry.layout)),
    [model, entry.layout]
  );

  /* ---------------- Vật liệu dùng chung khi recolor ---------------- */
  const materials = useMemo(() => {
    // Màu ban đầu lấy đúng màu đang chọn để lúc vừa tải xong không chớp màu trắng
    const start = useKeyboardStore.getState();
    const keycap = (color: string) =>
      new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.2, sheenRoughness: 0.8 });
    return {
      case: new THREE.MeshPhysicalMaterial({ color: start.caseColor }),
      plate: new THREE.MeshPhysicalMaterial(),
      alpha: keycap(start.keycapColor),
      modifier: keycap(start.keycapModifierColor),
      accent: keycap(start.keycapAccentColor),
    };
  }, []);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  useEffect(() => {
    if (!entry.recolor) return;
    const { recolor } = prepared;
    recolor.case.forEach((mesh) => (mesh.material = materials.case));
    recolor.plate.forEach((mesh) => (mesh.material = materials.plate));
    (['alpha', 'modifier', 'accent'] as const).forEach((role) =>
      recolor.keycaps[role].forEach((mesh) => (mesh.material = materials[role]))
    );
  }, [entry.recolor, prepared, materials]);

  // Thông số vật liệu (độ nhám, kim loại, trong suốt) đổi ngay; riêng màu vỏ đổi dần trong useFrame
  useEffect(() => {
    const caseProps = { ...MATERIAL_RESET, ...getCaseMaterialProps(caseMaterial, caseColor) };
    delete caseProps.color;
    materials.case.setValues(caseProps);
    materials.plate.setValues({ ...MATERIAL_RESET, ...getPlateMaterialProps(plateMaterial) });
    // eslint-disable-next-line react-hooks/immutability
    materials.case.needsUpdate = true;
    materials.plate.needsUpdate = true;
  }, [caseMaterial, caseColor, plateMaterial, materials]);

  const targets = useMemo(
    () => ({
      case: new THREE.Color(getCaseMaterialProps(caseMaterial, caseColor).color as string),
      alpha: new THREE.Color(keycapColor),
      modifier: new THREE.Color(keycapModifierColor),
      accent: new THREE.Color(keycapAccentColor),
    }),
    [caseMaterial, caseColor, keycapColor, keycapModifierColor, keycapAccentColor]
  );

  /* ---------------- Tách lớp + nhấn phím mỗi khung hình ---------------- */
  const [reduceMotion] = useState(prefersReducedMotion);
  const offset = useRef(isExploded ? explosionOffset : 0);
  const press = useRef(new Map<string, number>());

  useFrame((_, delta) => {
    offset.current = THREE.MathUtils.lerp(offset.current, isExploded ? explosionOffset : 0, Math.min(1, delta * 8));

    prepared.nodes.forEach(({ keyCode }) => {
      if (!keyCode) return;
      const down = isKeyPressed(keyCode);
      const current = press.current.get(keyCode) ?? 0;
      press.current.set(keyCode, THREE.MathUtils.lerp(current, down ? KEY_TRAVEL : 0, Math.min(1, delta * (down ? 40 : 22))));
    });
    applyNodePositions(prepared.nodes, layerDeltas(offset.current), (code) => press.current.get(code) ?? 0, fit.scale);

    if (!entry.recolor) return;
    const step = reduceMotion ? 1 : Math.min(1, delta * COLOR_SPEED);
    stepColorToward(materials.case.color, targets.case, step);
    stepColorToward(materials.alpha.color, targets.alpha, step);
    stepColorToward(materials.modifier.color, targets.modifier, step);
    stepColorToward(materials.accent.color, targets.accent, step);
  });

  return (
    <group position={fit.position} scale={fit.scale}>
      <primitive object={model} />
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/* File .glb lỗi (thiếu file, hỏng file) → hiện mẫu dựng bằng code thay thế     */
/* -------------------------------------------------------------------------- */
interface BoundaryProps {
  fallback: React.ReactNode;
  onError: (message: string) => void;
  children: React.ReactNode;
}

export class ModelErrorBoundary extends React.Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error.message);
  }

  render(): React.ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
