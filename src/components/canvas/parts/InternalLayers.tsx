'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { PlacedKey } from '@/lib/keyboard/layouts';
import type { PlateMaterial } from '@/types/keyboard';
import { KEY_UNIT, keyCenter } from '../geometry/keyboardGeometry';
import {
  MM,
  SWITCH_CUTOUT,
  createCutoutSlab,
  flexCuts,
  stabilizerCutouts,
  switchCutouts,
} from '../geometry/plateGeometry';
import {
  DEFAULT_PCB_MASK,
  MX_FOOTPRINT,
  getPcbTextures,
  getSurfaceTexture,
  type SurfaceKind,
} from '../geometry/proceduralTextures';
import { StaticInstances, composeMatrix } from './StaticInstances';

/** Độ dày các lớp (đơn vị thế giới) */
export const PCB_THICKNESS = 0.03;
export const FOAM_THICKNESS = 0.035;
export const PLATE_THICKNESS = 0.04;

/** Cổng USB-C nằm ở mép sau, lệch trái như phần lớn bàn phím custom */
export const usbPortX = (keysWidth: number): number => -keysWidth / 2 + 1.6 * KEY_UNIT;

interface LayerProps {
  keys: PlacedKey[];
  layoutWidth: number;
  layoutDepth: number;
  /** Kích thước vùng phím (đơn vị thế giới) */
  keysWidth: number;
  keysDepth: number;
  /** Khoá cache hình học: đổi layout/núm xoay thì tính lại */
  cacheKey: string;
}

const centersOf = (keys: PlacedKey[], layoutWidth: number, layoutDepth: number): [number, number][] =>
  keys.map((key) => keyCenter(key, layoutWidth, layoutDepth));

/* -------------------------------------------------------------------------- */
/* PCB                                                                        */
/* -------------------------------------------------------------------------- */
interface PcbProps extends LayerProps {
  ledEnabled: boolean;
  ledColor: string;
  ledBrightness: number;
  /** Màu solder mask thật của build (đen, trắng…); bỏ trống = xanh lá mặc định */
  pcbColor?: string;
}

const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

export const PcbLayer: React.FC<PcbProps> = ({
  keys,
  layoutWidth,
  layoutDepth,
  keysWidth,
  keysDepth,
  cacheKey,
  ledEnabled,
  ledColor,
  ledBrightness,
  pcbColor = DEFAULT_PCB_MASK,
}) => {
  const width = keysWidth - 0.02;
  const depth = keysDepth - 0.02;
  const centers = useMemo(() => centersOf(keys, layoutWidth, layoutDepth), [keys, layoutWidth, layoutDepth]);

  const boardMaterial = useMemo(() => {
    const textures = getPcbTextures(cacheKey, width, depth, centers.map(([x, z]) => ({ x, z })), pcbColor);
    if (!textures) return new THREE.MeshPhysicalMaterial({ color: pcbColor, roughness: 0.55, metalness: 0.2 });
    return new THREE.MeshPhysicalMaterial({
      map: textures.map,
      bumpMap: textures.data,
      bumpScale: 0.6,
      roughnessMap: textures.data,
      metalnessMap: textures.data,
      roughness: 1,
      metalness: 1,
      // Lớp phủ solder mask bóng nhẹ
      clearcoat: 0.25,
      clearcoatRoughness: 0.4,
    });
  }, [cacheKey, width, depth, centers, pcbColor]);
  useEffect(() => () => boardMaterial.dispose(), [boardMaterial]);

  const parts = useMemo(
    () => ({
      socketBody: box(10.9 * MM, 1.8 * MM, 5.2 * MM),
      socketTab: box(1.6 * MM, 1.2 * MM, 2.2 * MM),
      led: box(3.5 * MM, 1.0 * MM, 2.8 * MM),
      usbBoard: box(0.42, 0.024, 0.24),
      usbPort: box(8.9 * MM, 3.2 * MM, 7.4 * MM),
    }),
    []
  );
  useEffect(() => () => Object.values(parts).forEach((g) => g.dispose()), [parts]);

  const materials = useMemo(
    () => ({
      socket: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.55 }),
      metal: new THREE.MeshStandardMaterial({ color: '#c9c3b3', roughness: 0.3, metalness: 1 }),
      // Vỏ LED SMD: nhựa trắng ngà ánh vàng (không phải khối trắng tinh)
      led: new THREE.MeshStandardMaterial({ color: '#d8d2bd', roughness: 0.35 }),
      usbBoard: new THREE.MeshStandardMaterial({ color: DEFAULT_PCB_MASK, roughness: 0.5 }),
    }),
    []
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  // Bo mạch phụ USB cùng màu bo chính
  useEffect(() => {
    materials.usbBoard.color.set(pcbColor);
  }, [materials, pcbColor]);

  // LED SMD sáng nhẹ theo màu đèn khi bật
  useEffect(() => {
    materials.led.setValues({ emissive: ledColor, emissiveIntensity: ledEnabled ? 0.4 + ledBrightness * 1.6 : 0 });
  }, [materials, ledColor, ledEnabled, ledBrightness]);

  const half = PCB_THICKNESS / 2;
  const matrices = useMemo(() => {
    // Socket hotswap ôm 2 chân đồng ở mặt dưới bo mạch
    const socketX = -0.6 * MM;
    const socketZ = -3.8 * MM;
    return {
      sockets: centers.map(([x, z]) => composeMatrix(x + socketX, -half - 0.9 * MM, z + socketZ)),
      tabs: centers.flatMap(([x, z]) =>
        [-1, 1].map((side) => composeMatrix(x + socketX + side * 6.2 * MM, -half - 0.6 * MM, z + socketZ))
      ),
      leds: centers.map(([x, z]) => composeMatrix(x + MX_FOOTPRINT.led[0] * MM, half + 0.5 * MM, z + MX_FOOTPRINT.led[1] * MM)),
    };
  }, [centers, half]);

  const usbX = usbPortX(keysWidth);
  return (
    <>
      <mesh castShadow receiveShadow material={boardMaterial}>
        <boxGeometry args={[width, PCB_THICKNESS, depth]} />
      </mesh>
      <StaticInstances name="Detail_HotswapSocket" geometry={parts.socketBody} material={materials.socket} matrices={matrices.sockets} castShadow />
      <StaticInstances name="Detail_HotswapContact" geometry={parts.socketTab} material={materials.metal} matrices={matrices.tabs} />
      <StaticInstances name="Detail_SmdLed" geometry={parts.led} material={materials.led} matrices={matrices.leds} />
      {/* Bo mạch phụ USB-C ở mép sau */}
      <group name="Detail_UsbDaughterboard" position={[usbX, 0, -depth / 2 - 0.1]}>
        <mesh geometry={parts.usbBoard} material={materials.usbBoard} castShadow />
        <mesh geometry={parts.usbPort} material={materials.metal} position={[0, 0.012 + 1.6 * MM, -0.12 + 3.7 * MM]} />
      </group>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Foam Poron có lỗ khoét                                                      */
/* -------------------------------------------------------------------------- */
/** Poron xám than mặc định khi build chưa có màu foam thật */
export const DEFAULT_FOAM_COLOR = '#3d4045';

interface FoamProps extends LayerProps {
  /** Màu foam thật của build (Poron đen, foam trắng AULA, foam be Bridge75…) */
  foamColor?: string;
}

export const FoamLayer: React.FC<FoamProps> = ({
  keys,
  layoutWidth,
  layoutDepth,
  keysWidth,
  keysDepth,
  cacheKey,
  foamColor = DEFAULT_FOAM_COLOR,
}) => {
  const geometry = useMemo(
    () =>
      createCutoutSlab(`foam:${cacheKey}`, keysWidth - 0.04, keysDepth - 0.04, FOAM_THICKNESS, [
        // Lỗ foam rộng hơn lỗ plate 0.6mm để vỏ switch lọt qua
        ...switchCutouts(keys, layoutWidth, layoutDepth, SWITCH_CUTOUT + 0.6 * MM),
        ...stabilizerCutouts(keys, layoutWidth, layoutDepth),
      ]),
    [cacheKey, keys, layoutWidth, layoutDepth, keysWidth, keysDepth]
  );

  const material = useMemo(() => {
    const pores = getSurfaceTexture('poron');
    // Poron plate foam xám than: tách bạch với plate POM/PC trắng khi tách lớp, lỗ khí li ti hút sáng
    return new THREE.MeshStandardMaterial({
      color: DEFAULT_FOAM_COLOR,
      roughness: 1,
      bumpMap: pores,
      bumpScale: 1.2,
      roughnessMap: pores,
    });
  }, []);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    material.color.set(foamColor);
  }, [material, foamColor]);

  return <mesh geometry={geometry} material={material} receiveShadow castShadow />;
};

/* -------------------------------------------------------------------------- */
/* Plate: lỗ switch, lỗ stabilizer, flex-cut, tai gasket + dải Poron           */
/* -------------------------------------------------------------------------- */

/** Bề mặt theo chất liệu plate: nhôm phun cát, FR4 sợi dệt, POM hạt mịn, PC nhẵn trong */
export const PLATE_SURFACE: Record<PlateMaterial, { kind: SurfaceKind | null; bumpScale: number; flexCut: boolean }> = {
  aluminum: { kind: 'beadBlast', bumpScale: 0.3, flexCut: false },
  fr4: { kind: 'fr4', bumpScale: 0.6, flexCut: true },
  pom: { kind: 'pbt', bumpScale: 0.25, flexCut: true },
  polycarbonate: { kind: null, bumpScale: 0, flexCut: true },
};

/** Vị trí tai gasket dọc hai cạnh dài của plate (mỗi cạnh ≈ 1 tai / 1.1 đơn vị, tối thiểu 3) */
export const gasketTabPositions = (width: number, depth: number): [number, number][] => {
  const perEdge = Math.max(3, Math.round(width / 1.1));
  const span = width - 0.6;
  const xs = Array.from({ length: perEdge }, (_, i) => -span / 2 + (span * i) / (perEdge - 1));
  return [-1, 1].flatMap((side) => xs.map((x): [number, number] => [x, side * (depth / 2 + 0.05)]));
};

interface PlateProps extends LayerProps {
  plateMaterial: PlateMaterial;
  materialProps: Partial<THREE.MeshPhysicalMaterialParameters>;
}

export const PlateLayer: React.FC<PlateProps> = ({
  keys,
  layoutWidth,
  layoutDepth,
  keysWidth,
  keysDepth,
  cacheKey,
  plateMaterial,
  materialProps,
}) => {
  const surface = PLATE_SURFACE[plateMaterial];
  const width = keysWidth + 0.02;
  const depth = keysDepth + 0.02;

  const geometry = useMemo(
    () =>
      createCutoutSlab(`plate:${cacheKey}:${surface.flexCut}`, width, depth, PLATE_THICKNESS, [
        ...switchCutouts(keys, layoutWidth, layoutDepth),
        ...stabilizerCutouts(keys, layoutWidth, layoutDepth),
        ...(surface.flexCut ? flexCuts(keys, layoutWidth, layoutDepth) : []),
      ]),
    [cacheKey, surface.flexCut, keys, layoutWidth, layoutDepth, width, depth]
  );

  const material = useMemo(() => {
    const map = surface.kind ? getSurfaceTexture(surface.kind) : null;
    return new THREE.MeshPhysicalMaterial({
      ...materialProps,
      bumpMap: map,
      bumpScale: surface.bumpScale,
      roughnessMap: map,
      metalnessMap: plateMaterial === 'aluminum' ? map : null,
      side: THREE.DoubleSide,
    });
  }, [materialProps, surface, plateMaterial]);
  useEffect(() => () => material.dispose(), [material]);

  const gasket = useMemo(() => {
    const tabs = gasketTabPositions(width, depth);
    return {
      tabGeometry: new THREE.BoxGeometry(0.2, PLATE_THICKNESS, 0.1),
      stripGeometry: new THREE.BoxGeometry(0.19, 0.012, 0.09),
      tabs: tabs.map(([x, z]) => composeMatrix(x, 0, z)),
      // Dải Poron đen dán cả mặt trên và mặt dưới tai gasket
      strips: tabs.flatMap(([x, z]) => [-1, 1].map((side) => composeMatrix(x, side * (PLATE_THICKNESS / 2 + 0.006), z))),
    };
  }, [width, depth]);
  useEffect(
    () => () => {
      gasket.tabGeometry.dispose();
      gasket.stripGeometry.dispose();
    },
    [gasket]
  );
  const stripMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111113', roughness: 0.95 }), []);
  useEffect(() => () => stripMaterial.dispose(), [stripMaterial]);

  return (
    <>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <StaticInstances name="Detail_GasketTab" geometry={gasket.tabGeometry} material={material} matrices={gasket.tabs} castShadow />
      <StaticInstances name="Detail_GasketStrip" geometry={gasket.stripGeometry} material={stripMaterial} matrices={gasket.strips} />
    </>
  );
};
