'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ShellStyle } from '@/types/keyboard';
import { TYPING_ANGLE, wedgeBottomY } from '../geometry/caseGeometry';
import { CASE_BEVEL } from '../geometry/keyboardGeometry';
import { getLcdTexture, getSurfaceTexture, getWoodColorTexture } from '../geometry/proceduralTextures';
import { StaticInstances, composeMatrix } from './StaticInstances';

/**
 * Chi tiết vỏ nhận diện theo từng dòng phím thật (shellStyle). Dựng thêm trên vỏ CNC chung,
 * chia làm 2 phần đi theo đúng lớp khi tách: chi tiết vỏ dưới (BottomCase) và vỏ trên (TopCase).
 */

export interface ShellDims {
  outerWidth: number;
  outerDepth: number;
  keysWidth: number;
  keysDepth: number;
  /** Mép ghép vỏ trên/vỏ dưới trong toạ độ group vỏ dưới */
  seamY: number;
}

/** Chi tiết dán dưới đáy nêm: xoay ngược góc gõ để nằm phẳng trên mặt đáy */
const underside = (x: number, z: number, thickness: number, extraTilt = 0): THREE.Matrix4 =>
  composeMatrix(x, wedgeBottomY(z) - thickness / 2, z, [-TYPING_ANGLE + extraTilt, 0, 0]);

const useDisposable = <T extends { dispose: () => void }>(items: T[]): void => {
  useEffect(() => () => items.forEach((item) => item.dispose()), [items]);
};

/* -------------------------------------------------------------------------- */
/* Vỏ dưới                                                                    */
/* -------------------------------------------------------------------------- */
interface BottomDetailsProps {
  style: ShellStyle;
  dims: ShellDims;
}

export const ShellBottomDetails: React.FC<BottomDetailsProps> = ({ style, dims }) => {
  switch (style) {
    case 'aula':
      return <AulaBottom dims={dims} />;
    case 'hi75':
      return <MetalBadge dims={dims} />;
    case 'lucky65':
      return <BallCatchAndMirror dims={dims} />;
    case 'halo-rgb':
      return <HaloRing dims={dims} />;
    default:
      return null;
  }
};

/** AULA: rãnh ghép 2 mảnh ABS, 2 chân chống gập 2 nấc, khe cất dongle 2.4G */
const AulaBottom: React.FC<{ dims: ShellDims }> = ({ dims }) => {
  const { outerWidth: w, outerDepth: d, seamY } = dims;
  const parts = useMemo(
    () => ({
      seamX: new THREE.BoxGeometry(w - 0.3, 0.012, 0.012),
      seamZ: new THREE.BoxGeometry(0.012, 0.012, d - 0.3),
      leg: new THREE.BoxGeometry(0.55, 0.035, 0.22).translate(0, 0, -0.11),
      slot: new THREE.BoxGeometry(0.34, 0.01, 0.12),
      dark: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.75 }),
    }),
    [w, d]
  );
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  const off = CASE_BEVEL * 0.55;
  const legZ = -d / 2 + 0.3;
  return (
    <group name="Detail_AulaShell">
      {/* Rãnh ghép nằm trong khe chamfer giữa vỏ trên và vỏ dưới */}
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} geometry={parts.seamX} material={parts.dark} position={[0, seamY, s * (d / 2 + off)]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} geometry={parts.seamZ} material={parts.dark} position={[s * (w / 2 + off), seamY, 0]} />
      ))}
      {/* Chân chống mở nấc 2: bản lề sát mép sau, chân chĩa xuống bàn */}
      {[-1, 1].map((s) => (
        <group key={`leg${s}`} position={[s * (w / 2 - 0.75), wedgeBottomY(legZ) - 0.02, legZ]} rotation={[-TYPING_ANGLE - 0.75, 0, 0]}>
          <mesh geometry={parts.leg} material={parts.dark} castShadow />
        </group>
      ))}
      {/* Khe cất dongle 2.4G ở đáy */}
      <mesh geometry={parts.slot} material={parts.dark} matrix={underside(0, -d / 2 + 0.65, 0.01)} matrixAutoUpdate={false} />
    </group>
  );
};

/** Leobog Hi75: badge kim loại khắc tên ở đáy */
const MetalBadge: React.FC<{ dims: ShellDims }> = ({ dims }) => {
  const parts = useMemo(
    () => ({
      badge: new THREE.BoxGeometry(0.62, 0.008, 0.17),
      metal: new THREE.MeshPhysicalMaterial({ color: '#c9c6bd', metalness: 1, roughness: 0.18, clearcoat: 0.6 }),
    }),
    []
  );
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  return (
    <mesh
      name="Detail_Badge"
      geometry={parts.badge}
      material={parts.metal}
      matrix={underside(0, -dims.outerDepth / 2 + 0.5, 0.008)}
      matrixAutoUpdate={false}
    />
  );
};

/** Lucky65 / Bridge75 / Crush80: 4 chốt bi nam châm (ball-catch) trong lòng vỏ + tạ gương PVD dưới đáy */
const BallCatchAndMirror: React.FC<{ dims: ShellDims }> = ({ dims }) => {
  const { keysWidth, keysDepth, outerDepth, seamY } = dims;
  const parts = useMemo(
    () => ({
      housing: new THREE.CylinderGeometry(0.05, 0.05, 0.07, 20),
      ball: new THREE.SphereGeometry(0.032, 16, 12),
      mirror: new THREE.BoxGeometry(keysWidth * 0.55, 0.012, 0.2),
      dark: new THREE.MeshStandardMaterial({ color: '#202124', roughness: 0.5, metalness: 0.4 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#e6e8ec', roughness: 0.08, metalness: 1 }),
      // Inox mạ PVD gương: kim loại gần như không nhám, phản chiếu rõ đèn studio
      pvd: new THREE.MeshPhysicalMaterial({ color: '#d9d6cf', roughness: 0.04, metalness: 1, clearcoat: 1 }),
    }),
    [keysWidth]
  );
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  const corners = useMemo(
    () =>
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]): [number, number] => [sx * (keysWidth / 2 - 0.08), sz * (keysDepth / 2 - 0.02)]),
    [keysWidth, keysDepth]
  );
  const housings = useMemo(() => corners.map(([x, z]) => composeMatrix(x, seamY - 0.045, z)), [corners, seamY]);
  const balls = useMemo(() => corners.map(([x, z]) => composeMatrix(x, seamY - 0.005, z)), [corners, seamY]);
  return (
    <group name="Detail_BallCatch">
      <StaticInstances geometry={parts.housing} material={parts.dark} matrices={housings} />
      <StaticInstances geometry={parts.ball} material={parts.chrome} matrices={balls} />
      <mesh
        name="Detail_PvdWeight"
        geometry={parts.mirror}
        material={parts.pvd}
        matrix={underside(0, -outerDepth / 2 + 0.42, 0.012)}
        matrixAutoUpdate={false}
      />
    </group>
  );
};

/** NuPhy Halo: dải đèn chạy vòng quanh đáy, đổi màu cầu vồng chậm */
const HaloRing: React.FC<{ dims: ShellDims }> = ({ dims }) => {
  const { outerWidth: w, outerDepth: d, seamY } = dims;
  const geometry = useMemo(() => {
    const outer = new THREE.Shape();
    const hw = w / 2 + 0.012;
    const hd = d / 2 + 0.012;
    outer.moveTo(-hw, -hd);
    outer.lineTo(hw, -hd);
    outer.lineTo(hw, hd);
    outer.lineTo(-hw, hd);
    outer.lineTo(-hw, -hd);
    const hole = new THREE.Path();
    const iw = w / 2 - 0.03;
    const id = d / 2 - 0.03;
    hole.moveTo(-iw, -id);
    hole.lineTo(-iw, id);
    hole.lineTo(iw, id);
    hole.lineTo(iw, -id);
    hole.lineTo(-iw, -id);
    outer.holes.push(hole);
    return new THREE.ExtrudeGeometry(outer, { depth: 0.025, bevelEnabled: false }).rotateX(-Math.PI / 2);
  }, [w, d]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', emissiveIntensity: 2.2, toneMapped: false }), []);
  useDisposable(useMemo(() => [geometry, material], [geometry, material]));
  useFrame(({ clock }) => {
    material.emissive.setHSL((clock.elapsedTime * 0.06) % 1, 0.9, 0.55);
  });
  return <mesh name="Detail_HaloLight" geometry={geometry} material={material} position={[0, seamY - 0.075, 0]} />;
};

/* -------------------------------------------------------------------------- */
/* Vỏ trên                                                                    */
/* -------------------------------------------------------------------------- */
interface TopDetailsProps {
  style: ShellStyle;
  dims: ShellDims;
  caseMaterial: THREE.Material;
  ledColor: string;
  /** Tâm module LCD 2U (lcd-75) */
  modulePosition: [number, number] | null;
  /** Mặt trên vỏ trên và mặt trên plate trong toạ độ group vỏ trên */
  topY: number;
  plateY: number;
}

export const ShellTopDetails: React.FC<TopDetailsProps> = ({ style, dims, caseMaterial, ledColor, modulePosition, topY, plateY }) => {
  switch (style) {
    case 'aula':
      return <IndicatorBar dims={dims} topY={topY} color="#f4f6ff" />;
    case 'x85':
      return (
        <>
          <SportSideFacets dims={dims} material={caseMaterial} topY={topY} />
          <IndicatorBar dims={dims} topY={topY} color={ledColor} short />
        </>
      );
    case 'wood-accent':
      return <WoodSidePanels dims={dims} topY={topY} />;
    case 'lcd-75':
      return modulePosition ? <LcdModule position={modulePosition} plateY={plateY} /> : null;
    default:
      return null;
  }
};

/** Dải đèn báo mảnh trên viền trước, cạnh cụm phím mũi tên */
const IndicatorBar: React.FC<{ dims: ShellDims; topY: number; color: string; short?: boolean }> = ({ dims, topY, color, short }) => {
  const parts = useMemo(
    () => ({
      bar: new THREE.BoxGeometry(short ? 0.05 : 0.3, 0.006, 0.022),
      light: new THREE.MeshStandardMaterial({ color: '#ffffff', emissiveIntensity: 1.6, toneMapped: false }),
    }),
    [short]
  );
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  useEffect(() => {
    parts.light.emissive.set(color);
  }, [parts, color]);
  const bezel = (dims.outerDepth - dims.keysDepth) / 2;
  return (
    <mesh
      name="Detail_Indicator"
      geometry={parts.bar}
      material={parts.light}
      position={[dims.keysWidth / 2 - 0.55, topY + 0.003, dims.keysDepth / 2 + bezel / 2]}
    />
  );
};

/** Attack Shark X85: hai hông vát chéo kiểu thể thao */
const SportSideFacets: React.FC<{ dims: ShellDims; material: THREE.Material; topY: number }> = ({ dims, material, topY }) => {
  const facet = useMemo(() => new THREE.BoxGeometry(0.07, 0.24, dims.outerDepth * 0.82), [dims.outerDepth]);
  useDisposable(useMemo(() => [facet], [facet]));
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          name="Detail_SideFacet"
          geometry={facet}
          material={material}
          position={[s * (dims.outerWidth / 2 + 0.01), topY - 0.17, 0]}
          rotation={[0, 0, s * -0.55]}
          castShadow
        />
      ))}
    </>
  );
};

/** Keychron K2 HE Special Edition: hai thanh ốp gỗ hồng mộc hai bên hông */
const WoodSidePanels: React.FC<{ dims: ShellDims; topY: number }> = ({ dims, topY }) => {
  const parts = useMemo(
    () => ({
      panel: new THREE.BoxGeometry(0.07, 0.36, dims.outerDepth - 0.16),
      wood: new THREE.MeshPhysicalMaterial({
        color: '#f3e6da',
        map: getWoodColorTexture(),
        bumpMap: getSurfaceTexture('wood'),
        bumpScale: 0.6,
        roughness: 0.6,
        clearcoat: 0.3,
        clearcoatRoughness: 0.5,
      }),
    }),
    [dims.outerDepth]
  );
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          name="Detail_WoodPanel"
          geometry={parts.panel}
          material={parts.wood}
          position={[s * (dims.outerWidth / 2 + CASE_BEVEL + 0.035), topY - 0.25, 0]}
          castShadow
          receiveShadow
        />
      ))}
    </>
  );
};

/** Meletrix Zoom75: module màn hình LCD 2U góc trên phải */
const LcdModule: React.FC<{ position: [number, number]; plateY: number }> = ({ position, plateY }) => {
  const parts = useMemo(
    () => ({
      body: new THREE.BoxGeometry(0.68, 0.2, 0.33),
      screen: new THREE.PlaneGeometry(0.56, 0.24).rotateX(-Math.PI / 2),
      bezel: new THREE.MeshPhysicalMaterial({ color: '#141518', roughness: 0.25, clearcoat: 0.8 }),
      lcd: new THREE.MeshBasicMaterial({ map: getLcdTexture(), color: getLcdTexture() ? '#ffffff' : '#163447', toneMapped: false }),
    }),
    []
  );
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  return (
    <group name="Detail_LcdModule" position={[position[0], plateY, position[1]]}>
      <mesh geometry={parts.body} material={parts.bezel} position={[0, 0.1, 0]} castShadow />
      {/* Mặt kính nghiêng nhẹ về phía người dùng */}
      <mesh geometry={parts.screen} material={parts.lcd} position={[0, 0.201, 0]} rotation={[0.04, 0, 0]} />
    </group>
  );
};
