'use client';

import React, { useMemo } from 'react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { KeyboardLayout } from '@/types/keyboard';

// Cấu hình kích thước và phím theo từng Layout
interface LayoutSpecs {
  width: number;
  depth: number;
  rows: number;
  cols: number;
  keySize: number;
  gap: number;
}

const getLayoutSpecs = (layout: KeyboardLayout): LayoutSpecs => {
  switch (layout) {
    case '65%':
      return { width: 6.2, depth: 2.2, rows: 5, cols: 15, keySize: 0.36, gap: 0.04 };
    case '75%':
      return { width: 6.6, depth: 2.6, rows: 6, cols: 15, keySize: 0.36, gap: 0.04 };
    case 'TKL':
      return { width: 7.8, depth: 2.6, rows: 6, cols: 18, keySize: 0.36, gap: 0.04 };
  }
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

  // Độ dịch chuyển theo trục Y khi bung lớp (Exploded View)
  const offsetMultiplier = isExploded ? explosionOffset : 0;
  const bottomCaseY = 0;
  const pcbY = 0.28 + offsetMultiplier * 0.35;
  const foamY = 0.34 + offsetMultiplier * 0.7;
  const plateY = 0.40 + offsetMultiplier * 1.05;
  const switchesY = 0.52 + offsetMultiplier * 1.4;
  const keycapsY = 0.74 + offsetMultiplier * 1.8;
  const topCaseY = 0.44 + offsetMultiplier * 2.15;

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
        return '#d97706'; // Hổ phách Boba U4T
      case 'clicky':
        return '#0284c7'; // Xanh lam Cherry MX Blue
      case 'silent_linear':
        return '#f43f5e'; // Hồng nhạt Silent
      case 'linear':
      default:
        return '#dc2626'; // Đỏ Gateron / Oil King
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

        // Bỏ qua các ô phím con nằm trong khu vực phím cách
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

  return (
    <group position={[0, -0.3, 0]}>
      {/* ------------------------------------------------------------------ */}
      {/* LỚP 1: BOTTOM CASE (Đế nhôm CNC vát cạnh & Đèn gầm Underglow)      */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, bottomCaseY, 0]}>
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
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 2: PCB (Bảng mạch in điện tử đen nhám với viền mạ vàng)        */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, pcbY, 0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[specs.width - 0.05, 0.03, specs.depth - 0.05]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.2} />
        </mesh>
        {/* Đường viền mạ vàng trên PCB */}
        <mesh position={[0, 0.016, 0]}>
          <boxGeometry args={[specs.width - 0.08, 0.005, specs.depth - 0.08]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.9} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 3: PORON FOAM (Mút tiêu âm giảm cộng hưởng)                    */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, foamY, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[specs.width - 0.1, 0.04, specs.depth - 0.1]} />
          <meshStandardMaterial color="#111827" roughness={0.95} metalness={0.05} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 4: SWITCH PLATE (Tấm định vị Switch: Alu / Brass / PC / FR4)   */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, plateY, 0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[specs.width, 0.05, specs.depth]} />
          <meshStandardMaterial {...plateMaterialProps} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 5: SWITCHES (Hệ thống switch cơ học gồm Housing + Stem)        */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, switchesY, 0]}>
        {keyGrid.map((key, i) => (
          <group key={`sw-${i}`} position={[key.x, 0, key.z]}>
            {/* Vỏ Switch dưới (Bottom Housing) */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.26 * key.widthRatio, 0.12, 0.26]} />
              <meshStandardMaterial color="#1c1917" roughness={0.4} />
            </mesh>
            {/* Vỏ Switch trong suốt (Top Housing) */}
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
            {/* Chân Stem chữ thập mang màu đặc trưng của Switch */}
            <mesh position={[0, 0.14, 0]}>
              <boxGeometry args={[0.1, 0.08, 0.1]} />
              <meshStandardMaterial color={switchStemColor} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 6: KEYCAPS (Bộ nút phím với màu chính và phím điểm nhấn)       */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, keycapsY, 0]}>
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
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* LỚP 7: TOP CASE (Khung viền trên bao bọc sang trọng)               */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, topCaseY, 0]}>
        {/* Viền trái */}
        <mesh
          position={[-(specs.width / 2 + 0.08), 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.16, 0.2, specs.depth + 0.32]} />
          <meshPhysicalMaterial {...caseMaterialProps} />
        </mesh>
        {/* Viền phải */}
        <mesh
          position={[specs.width / 2 + 0.08, 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.16, 0.2, specs.depth + 0.32]} />
          <meshPhysicalMaterial {...caseMaterialProps} />
        </mesh>
        {/* Viền trên */}
        <mesh
          position={[0, 0, -(specs.depth / 2 + 0.08)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[specs.width + 0.32, 0.2, 0.16]} />
          <meshPhysicalMaterial {...caseMaterialProps} />
        </mesh>
        {/* Viền dưới */}
        <mesh
          position={[0, 0, specs.depth / 2 + 0.08]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[specs.width + 0.32, 0.2, 0.16]} />
          <meshPhysicalMaterial {...caseMaterialProps} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* ÁNH SÁNG ĐÈN GẦM REALTIME (PointLight phản chiếu xuống mặt bàn)    */}
      {/* ------------------------------------------------------------------ */}
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
