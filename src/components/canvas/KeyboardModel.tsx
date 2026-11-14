'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { KeyboardLayout } from '@/types/keyboard';

// Cấu hình kích thước và phím theo từng Layout
export interface LayoutSpecs {
  width: number;
  depth: number;
  rows: number;
  cols: number;
  keySize: number;
  gap: number;
}

export const getLayoutSpecs = (layout: KeyboardLayout): LayoutSpecs => {
  switch (layout) {
    case '65%':
      return { width: 6.2, depth: 2.2, rows: 5, cols: 15, keySize: 0.36, gap: 0.04 };
    case '75%':
      return { width: 6.6, depth: 2.6, rows: 6, cols: 15, keySize: 0.36, gap: 0.04 };
    case 'TKL':
      return { width: 7.8, depth: 2.6, rows: 6, cols: 18, keySize: 0.36, gap: 0.04 };
  }
};

// Hàm tính toán vị trí trục Y cho 7 lớp linh kiện (Export để chạy Unit Test)
export interface LayerPositions {
  bottomCase: number;
  pcb: number;
  foam: number;
  plate: number;
  switches: number;
  keycaps: number;
  topCase: number;
}

export const calculateLayerPositions = (offset: number): LayerPositions => ({
  bottomCase: 0,
  pcb: Number((0.28 + offset * 0.35).toFixed(3)),
  foam: Number((0.34 + offset * 0.7).toFixed(3)),
  plate: Number((0.40 + offset * 1.05).toFixed(3)),
  switches: Number((0.52 + offset * 1.4).toFixed(3)),
  keycaps: Number((0.74 + offset * 1.8).toFixed(3)),
  topCase: Number((0.44 + offset * 2.15).toFixed(3)),
});

// Component Thẻ chú thích 3D HTML nổi phong cách MotionSites.ai
interface LayerAnnotationProps {
  layerIndex: string;
  name: string;
  subname: string;
  detail: string;
  visible: boolean;
  xOffset: number;
}

const LayerAnnotation: React.FC<LayerAnnotationProps> = ({
  layerIndex,
  name,
  subname,
  detail,
  visible,
  xOffset,
}) => {
  return (
    <Html
      position={[xOffset, 0, 0]}
      center={false}
      distanceFactor={9}
      zIndexRange={[100, 0]}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, x: -15, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2 pointer-events-auto select-none"
          >
            {/* Chấm tròn chỉ vị trí & Đường nối phát sáng */}
            <div className="flex items-center">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
              </span>
              <div className="w-6 h-[1px] bg-gradient-to-r from-cyan-400/80 to-white/20" />
            </div>

            {/* Thẻ Kính Mờ Frosted Liquid Glass */}
            <div className="px-3 py-1.5 rounded-xl glass-panel border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] min-w-[150px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-white tracking-tight flex items-center gap-1.5">
                  <span className="text-cyan-400 font-mono text-[10px]">{layerIndex}</span>
                  {name}
                </span>
                <span className="text-[9px] text-zinc-400 font-mono uppercase">{subname}</span>
              </div>
              <div className="text-[9px] text-zinc-400 font-mono mt-0.5 border-t border-white/5 pt-0.5">
                {detail}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Html>
  );
};

export const KeyboardModel: React.FC = () => {
  const layout = useKeyboardStore((s) => s.layout);
  const isExploded = useKeyboardStore((s) => s.isExploded);
  const explosionOffset = useKeyboardStore((s) => s.explosionOffset);
  const plateMaterial = useKeyboardStore((s) => s.plateMaterial);
  const caseMaterial = useKeyboardStore((s) => s.caseMaterial);
  const switchType = useKeyboardStore((s) => s.switchType);
  const keycapColor = useKeyboardStore((s) => s.keycapColor);
  const keycapAccentColor = useKeyboardStore((s) => s.keycapAccentColor);
  const caseColor = useKeyboardStore((s) => s.caseColor);
  const underglowColor = useKeyboardStore((s) => s.underglowColor);
  const underglowBrightness = useKeyboardStore((s) => s.underglowBrightness);
  const underglowEnabled = useKeyboardStore((s) => s.underglowEnabled);

  const specs = useMemo(() => getLayoutSpecs(layout), [layout]);

  // Tham chiếu DOM 3D cho 7 tầng linh kiện
  const bottomCaseRef = useRef<THREE.Group>(null);
  const pcbRef = useRef<THREE.Group>(null);
  const foamRef = useRef<THREE.Group>(null);
  const plateRef = useRef<THREE.Group>(null);
  const switchesRef = useRef<THREE.Group>(null);
  const keycapsRef = useRef<THREE.Group>(null);
  const topCaseRef = useRef<THREE.Group>(null);

  // Giá trị offset nội suy thời gian thực
  const currentOffset = useRef(isExploded ? explosionOffset : 0);

  // Vòng lặp Render 60/120 FPS: MathUtils.lerp mượt mà không gây re-render React
  useFrame((_, delta) => {
    const targetOffset = isExploded ? explosionOffset : 0;
    // Nội suy mượt mà theo delta time (tốc độ lerp = 8)
    currentOffset.current = THREE.MathUtils.lerp(
      currentOffset.current,
      targetOffset,
      Math.min(1, delta * 8)
    );

    const o = currentOffset.current;
    const positions = calculateLayerPositions(o);

    if (bottomCaseRef.current) bottomCaseRef.current.position.y = positions.bottomCase;
    if (pcbRef.current) pcbRef.current.position.y = positions.pcb;
    if (foamRef.current) foamRef.current.position.y = positions.foam;
    if (plateRef.current) plateRef.current.position.y = positions.plate;
    if (switchesRef.current) switchesRef.current.position.y = positions.switches;
    if (keycapsRef.current) keycapsRef.current.position.y = positions.keycaps;
    if (topCaseRef.current) topCaseRef.current.position.y = positions.topCase;
  });

  // Tọa độ X để gắn thẻ chú thích ở cạnh phải bàn phím
  const annotationX = specs.width / 2 + 0.3;

  // Cấu hình vật liệu Case theo lựa chọn
  const caseMaterialProps = useMemo(() => {
    switch (caseMaterial) {
      case 'polycarbonate':
        return {
          color: caseColor,
          roughness: 0.25,
          metalness: 0.05,
          transmission: 0.75,
          transparent: true,
          opacity: 0.85,
        };
      case 'acrylic':
        return {
          color: caseColor,
          roughness: 0.15,
          metalness: 0.05,
          transmission: 0.9,
          transparent: true,
          opacity: 0.9,
        };
      case 'wood':
        return {
          color: '#573318',
          roughness: 0.8,
          metalness: 0.05,
        };
      case 'aluminum':
      default:
        return {
          color: caseColor,
          roughness: 0.22,
          metalness: 0.85,
        };
    }
  }, [caseMaterial, caseColor]);

  // Cấu hình vật liệu Plate theo lựa chọn
  const plateMaterialProps = useMemo(() => {
    switch (plateMaterial) {
      case 'fr4':
        return { color: '#181e29', roughness: 0.65, metalness: 0.4 };
      case 'pom':
        return { color: '#090d16', roughness: 0.45, metalness: 0.1 };
      case 'polycarbonate':
        return { color: '#cbd5e1', roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.7 };
      case 'aluminum':
      default:
        return { color: '#94a3b8', roughness: 0.25, metalness: 0.9 };
    }
  }, [plateMaterial]);

  // Màu Stem của switch
  const switchStemColor = useMemo(() => {
    switch (switchType) {
      case 'tactile':
        return '#d97706';
      case 'clicky':
        return '#0284c7';
      case 'silent_linear':
        return '#f43f5e';
      case 'linear':
      default:
        return '#dc2626';
    }
  }, [switchType]);

  // Danh sách vị trí phím bấm procedural
  const keyGrid = useMemo(() => {
    const keys: Array<{ x: number; z: number; isAccent: boolean; widthRatio: number }> = [];
    const stepX = specs.keySize + specs.gap;
    const stepZ = specs.keySize + specs.gap;
    const startX = -((specs.cols - 1) * stepX) / 2;
    const startZ = -((specs.rows - 1) * stepZ) / 2;

    for (let r = 0; r < specs.rows; r++) {
      for (let c = 0; c < specs.cols; c++) {
        const isEsc = r === 0 && c === 0;
        const isEnter = r === specs.rows - 3 && c === specs.cols - 1;
        const isSpace = r === specs.rows - 1 && c >= 4 && c <= 8;

        if (r === specs.rows - 1 && c > 4 && c <= 8) {
          continue;
        }

        const widthRatio = isSpace ? 5 : 1;
        const xOffset = isSpace ? 2 * stepX : 0;

        keys.push({
          x: startX + c * stepX + xOffset,
          z: startZ + r * stepZ,
          isAccent: isEsc || isEnter || isSpace,
          widthRatio,
        });
      }
    }
    return keys;
  }, [specs]);

  const initialPositions = calculateLayerPositions(isExploded ? explosionOffset : 0);

  return (
    <group position={[0, -0.3, 0]}>
      {/* ------------------------------------------------------------------ */}
      {/* LỚP 1: BOTTOM CASE (Đế nhôm CNC vát cạnh & Đèn gầm Underglow)      */}
      {/* ------------------------------------------------------------------ */}
      <group ref={bottomCaseRef} position={[0, initialPositions.bottomCase, 0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[specs.width + 0.25, 0.24, specs.depth + 0.25]} />
          <meshPhysicalMaterial {...caseMaterialProps} />
        </mesh>

        {/* Đèn gầm Underglow RGB Emissive Bar */}
        {underglowEnabled && (
          <mesh position={[0, -0.11, 0]}>
            <boxGeometry args={[specs.width + 0.2, 0.04, specs.depth + 0.2]} />
            <meshStandardMaterial
              color={underglowColor}
              emissive={underglowColor}
              emissiveIntensity={underglowBrightness * 3}
              toneMapped={false}
            />
          </mesh>
        )}

        {/* 4 Chân đệm cao su chống trượt */}
        {[
          [-specs.width / 2.2, -0.13, -specs.depth / 2.3],
          [specs.width / 2.2, -0.13, -specs.depth / 2.3],
          [-specs.width / 2.2, -0.13, specs.depth / 2.3],
          [specs.width / 2.2, -0.13, specs.depth / 2.3],
        ].map(([x, y, z], idx) => (
          <mesh key={idx} position={[x, y, z]}>
            <cylinderGeometry args={[0.12, 0.12, 0.03, 16]} />
            <meshStandardMaterial color="#18181b" roughness={0.9} />
          </mesh>
        ))}

        {/* Nhãn chú thích 3D Lớp 01 */}
        <LayerAnnotation
          layerIndex="01"
          name="Bottom Case"
          subname="Đế Vỏ"
          detail={`${caseMaterial.toUpperCase()} CNC • RGB LED`}
          visible={isExploded}
          xOffset={annotationX}
        />
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 2: PCB (Bảng mạch in điện tử đen nhám với viền mạ vàng)        */}
      {/* ------------------------------------------------------------------ */}
      <group ref={pcbRef} position={[0, initialPositions.pcb, 0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[specs.width - 0.05, 0.03, specs.depth - 0.05]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.016, 0]}>
          <boxGeometry args={[specs.width - 0.08, 0.005, specs.depth - 0.08]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.9} />
        </mesh>

        {/* Nhãn chú thích 3D Lớp 02 */}
        <LayerAnnotation
          layerIndex="02"
          name="PCB"
          subname="Bạch Mạch"
          detail="Hotswap 5-Pin • Gold Plated"
          visible={isExploded}
          xOffset={annotationX}
        />
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 3: PORON FOAM (Mút tiêu âm giảm cộng hưởng)                    */}
      {/* ------------------------------------------------------------------ */}
      <group ref={foamRef} position={[0, initialPositions.foam, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[specs.width - 0.1, 0.04, specs.depth - 0.1]} />
          <meshStandardMaterial color="#111827" roughness={0.95} metalness={0.05} />
        </mesh>

        {/* Nhãn chú thích 3D Lớp 03 */}
        <LayerAnnotation
          layerIndex="03"
          name="Poron Foam"
          subname="Tiêu Âm"
          detail="Poron 3.5mm High Density"
          visible={isExploded}
          xOffset={annotationX}
        />
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 4: SWITCH PLATE (Tấm định vị Switch: Alu / Brass / PC / FR4)   */}
      {/* ------------------------------------------------------------------ */}
      <group ref={plateRef} position={[0, initialPositions.plate, 0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[specs.width, 0.05, specs.depth]} />
          <meshStandardMaterial {...plateMaterialProps} />
        </mesh>

        {/* Nhãn chú thích 3D Lớp 04 */}
        <LayerAnnotation
          layerIndex="04"
          name="Switch Plate"
          subname="Định Vị"
          detail={`${plateMaterial.toUpperCase()} • Gasket Mount`}
          visible={isExploded}
          xOffset={annotationX}
        />
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 5: SWITCHES (Hệ thống switch cơ học gồm Housing + Stem)        */}
      {/* ------------------------------------------------------------------ */}
      <group ref={switchesRef} position={[0, initialPositions.switches, 0]}>
        {keyGrid.map((key, i) => (
          <group key={`sw-${i}`} position={[key.x, 0, key.z]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.26 * key.widthRatio, 0.12, 0.26]} />
              <meshStandardMaterial color="#1c1917" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.08, 0]}>
              <boxGeometry args={[0.24 * key.widthRatio, 0.08, 0.24]} />
              <meshPhysicalMaterial
                color="#ffffff"
                roughness={0.2}
                transmission={0.8}
                transparent
                opacity={0.7}
              />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <boxGeometry args={[0.1, 0.08, 0.1]} />
              <meshStandardMaterial color={switchStemColor} roughness={0.3} />
            </mesh>
          </group>
        ))}

        {/* Nhãn chú thích 3D Lớp 05 */}
        <LayerAnnotation
          layerIndex="05"
          name="Switches"
          subname="Công Tắc"
          detail={`${switchType.toUpperCase().replace('_', ' ')} Mechanical`}
          visible={isExploded}
          xOffset={annotationX}
        />
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 6: KEYCAPS (Bộ nút phím với màu chính và phím điểm nhấn)       */}
      {/* ------------------------------------------------------------------ */}
      <group ref={keycapsRef} position={[0, initialPositions.keycaps, 0]}>
        {keyGrid.map((key, i) => (
          <mesh
            key={`kc-${i}`}
            position={[key.x, 0, key.z]}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[
                (specs.keySize - 0.04) * key.widthRatio,
                0.16,
                specs.keySize - 0.04,
              ]}
            />
            <meshStandardMaterial
              color={key.isAccent ? keycapAccentColor : keycapColor}
              roughness={0.4}
              metalness={0.1}
            />
          </mesh>
        ))}

        {/* Nhãn chú thích 3D Lớp 06 */}
        <LayerAnnotation
          layerIndex="06"
          name="Keycaps"
          subname="Nút Phím"
          detail="Cherry Profile • Double-shot PBT"
          visible={isExploded}
          xOffset={annotationX}
        />
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 7: TOP CASE (Khung viền trên bao bọc sang trọng)               */}
      {/* ------------------------------------------------------------------ */}
      <group ref={topCaseRef} position={[0, initialPositions.topCase, 0]}>
        <mesh
          position={[-(specs.width / 2 + 0.08), 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.16, 0.2, specs.depth + 0.32]} />
          <meshPhysicalMaterial {...caseMaterialProps} />
        </mesh>
        <mesh
          position={[specs.width / 2 + 0.08, 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.16, 0.2, specs.depth + 0.32]} />
          <meshPhysicalMaterial {...caseMaterialProps} />
        </mesh>
        <mesh
          position={[0, 0, -(specs.depth / 2 + 0.08)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[specs.width + 0.32, 0.2, 0.16]} />
          <meshPhysicalMaterial {...caseMaterialProps} />
        </mesh>
        <mesh
          position={[0, 0, specs.depth / 2 + 0.08]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[specs.width + 0.32, 0.2, 0.16]} />
          <meshPhysicalMaterial {...caseMaterialProps} />
        </mesh>

        {/* Nhãn chú thích 3D Lớp 07 */}
        <LayerAnnotation
          layerIndex="07"
          name="Top Case"
          subname="Khung Trên"
          detail={`${caseMaterial.toUpperCase()} CNC Beveled`}
          visible={isExploded}
          xOffset={annotationX}
        />
      </group>

      {/* Ánh sáng đèn gầm phản chiếu realtime */}
      {underglowEnabled && (
        <pointLight
          position={[0, -0.4, 0]}
          color={underglowColor}
          intensity={underglowBrightness * 15}
          distance={8}
          decay={2}
        />
      )}
    </group>
  );
};
