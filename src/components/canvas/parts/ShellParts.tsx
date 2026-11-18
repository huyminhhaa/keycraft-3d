'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ShellStyle } from '@/types/keyboard';
import { TYPING_ANGLE, wedgeBottomY } from '../geometry/caseGeometry';
import { CASE_BEVEL } from '../geometry/keyboardGeometry';
import { getRainbowTexture, getSurfaceTexture, getWoodColorTexture } from '../geometry/proceduralTextures';
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
  /** Màu đèn ruột (vỏ PC mờ, khung skeletal) */
  glowColor?: string;
}

export const ShellBottomDetails: React.FC<BottomDetailsProps> = ({ style, dims, glowColor }) => {
  switch (style) {
    case 'aula':
      return <AulaBottom dims={dims} />;
    case 'hi75':
      return <MetalBadge dims={dims} />;
    case 'lucky65':
      return <BallCatchAndMirror dims={dims} />;
    case 'halo-rgb':
      return (
        <>
          <HaloRing dims={dims} />
          <HaloRibs dims={dims} />
        </>
      );
    case 'frosted-pc':
      return glowColor ? <InnerGlow dims={dims} color={glowColor} /> : null;
    case 'skeletal':
      return <SkeletalFrame dims={dims} color={glowColor ?? '#8a5cff'} />;
    default:
      return null;
  }
};

/* -------------------------------------------------------------------------- */
/* Hông vỏ theo nêm: dùng chung cho khung skeletal và ốp gỗ                     */
/* -------------------------------------------------------------------------- */

/** Mặt ngoài vỏ (tính cả vát cạnh) */
const outerX = (dims: ShellDims): number => dims.outerWidth / 2 + CASE_BEVEL;
const outerZ = (dims: ShellDims): number => dims.outerDepth / 2 + CASE_BEVEL;

/**
 * Tấm hông theo biên dạng nêm (đáy dốc theo góc gõ), ép đùn `thickness` theo trục X.
 * Toạ độ hình vẽ (u = −z, v = y) rồi xoay quanh Y 90° để u → z, phần ép đùn → x.
 */
const createSideProfile = (
  depth: number,
  bottomAt: (z: number) => number,
  topY: number,
  thickness: number,
  holes: { z: number; y: number; rz: number; ry: number }[] = []
): THREE.ExtrudeGeometry => {
  const front = depth / 2;
  const back = -depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-front, bottomAt(front));
  shape.lineTo(-back, bottomAt(back));
  shape.lineTo(-back, topY);
  shape.lineTo(-front, topY);
  shape.closePath();
  holes.forEach((h) => {
    const path = new THREE.Path();
    path.absellipse(-h.z, h.y, h.rz, h.ry, 0, Math.PI * 2, false, 0);
    shape.holes.push(path);
  });
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 20 })
    .translate(0, 0, -thickness / 2)
    .rotateY(Math.PI / 2);
};

/** Tấm mặt trước/sau phẳng có lỗ bầu dục, ép đùn theo trục Z */
const createFacePlate = (width: number, bottomY: number, topY: number, thickness: number, holes: number): THREE.ExtrudeGeometry => {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, bottomY);
  shape.lineTo(width / 2, bottomY);
  shape.lineTo(width / 2, topY);
  shape.lineTo(-width / 2, topY);
  shape.closePath();
  const pitch = width / holes;
  const height = topY - bottomY;
  for (let i = 0; i < holes; i++) {
    const path = new THREE.Path();
    // Lỗ to nhỏ xen kẽ, lệch lên xuống như khung xương hữu cơ
    const wobble = i % 2 ? 0.08 : -0.06;
    path.absellipse(-width / 2 + pitch * (i + 0.5), bottomY + height * (0.5 + wobble), pitch * (i % 2 ? 0.36 : 0.42), height * 0.3, 0, Math.PI * 2, false, 0);
    shape.holes.push(path);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -thickness / 2);
};

/** Khung skeletal cao hơn mép ghép vỏ dưới bao nhiêu (vỏ trên cao 0.44, chừa 0.05 cho viền trên) */
const SKELETAL_RISE = 0.39;

/**
 * GravaStar Mercury K1: khung xương sci-fi bọc quanh vỏ, khoét lỗ bầu dục;
 * phía sau mỗi lỗ là tấm phát sáng tím/xanh như đèn ruột hắt ra trong ảnh.
 */
const SkeletalFrame: React.FC<{ dims: ShellDims; color: string }> = ({ dims, color }) => {
  const { seamY } = dims;
  const ox = outerX(dims);
  const oz = outerZ(dims);
  // Khung phủ cả hông vỏ dưới lẫn vỏ trên (tới sát mép trên vỏ) như ảnh thật
  const frameTop = seamY + SKELETAL_RISE;
  const parts = useMemo(() => {
    const frontBottom = wedgeBottomY(oz) + 0.005;
    const backBottom = wedgeBottomY(-oz) + 0.005;
    const sideHoles = [-0.3, 0, 0.3].map((t, i) => {
      const z = t * dims.outerDepth;
      const bottom = wedgeBottomY(z);
      const h = frameTop - bottom;
      return { z, y: bottom + h * (i === 1 ? 0.52 : 0.46), rz: dims.outerDepth * 0.12, ry: h * 0.3 };
    });
    return {
      front: createFacePlate(dims.outerWidth * 0.96, frontBottom, frameTop, 0.03, 9),
      back: createFacePlate(dims.outerWidth * 0.96, backBottom, frameTop, 0.03, 9),
      side: createSideProfile(dims.outerDepth * 0.94, (z) => wedgeBottomY(z) + 0.005, frameTop, 0.03, sideHoles),
      glowFront: new THREE.BoxGeometry(dims.outerWidth * 0.92, (frameTop - frontBottom) * 0.8, 0.006),
      glowBack: new THREE.BoxGeometry(dims.outerWidth * 0.92, (frameTop - backBottom) * 0.8, 0.006),
      glowSide: createSideProfile(dims.outerDepth * 0.88, (z) => wedgeBottomY(z) + 0.02, frameTop - 0.03, 0.006),
      frame: new THREE.MeshPhysicalMaterial({ color: '#121316', roughness: 0.38, metalness: 0.6, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
      glow: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 2.4, toneMapped: false }),
      glowCyan: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#37e0ff', emissiveIntensity: 2.2, toneMapped: false }),
    };
  }, [dims.outerWidth, dims.outerDepth, frameTop, oz, color]);
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  const frontMid = (wedgeBottomY(oz) + frameTop) / 2;
  const backMid = (wedgeBottomY(-oz) + frameTop) / 2;
  return (
    <group name="Detail_SkeletalFrame">
      {/* Tấm phát sáng nằm sát vách vỏ, khung khoét lỗ ở ngoài cùng */}
      <mesh geometry={parts.glowFront} material={parts.glow} position={[0, frontMid, oz + 0.006]} />
      <mesh geometry={parts.glowBack} material={parts.glowCyan} position={[0, backMid, -oz - 0.006]} />
      {[-1, 1].map((s) => (
        <mesh key={`g${s}`} geometry={parts.glowSide} material={s < 0 ? parts.glow : parts.glowCyan} position={[s * (ox + 0.006), 0, 0]} />
      ))}
      <mesh geometry={parts.front} material={parts.frame} position={[0, 0, oz + 0.026]} castShadow />
      <mesh geometry={parts.back} material={parts.frame} position={[0, 0, -oz - 0.026]} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={`f${s}`} geometry={parts.side} material={parts.frame} position={[s * (ox + 0.026), 0, 0]} castShadow />
      ))}
    </group>
  );
};

/** Vỏ PC mờ (Mode Envoy, Wooting 80HE, CIDOO QK61/QK75): đèn ruột dưới PCB hắt sáng xuyên vỏ */
const InnerGlow: React.FC<{ dims: ShellDims; color: string }> = ({ dims, color }) => {
  const parts = useMemo(
    () => ({
      geometry: new THREE.BoxGeometry(dims.keysWidth * 0.96, 0.01, dims.keysDepth * 0.9),
      material: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 2.2, toneMapped: false }),
    }),
    [dims.keysWidth, dims.keysDepth, color]
  );
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  return <mesh name="Detail_InnerGlow" geometry={parts.geometry} material={parts.material} position={[0, wedgeBottomY(0) + 0.05, 0]} rotation={[-TYPING_ANGLE, 0, 0]} />;
};

/** NuPhy Halo: gân dọc trên đáy nhựa trong mờ (mặt trước và hai hông) — một InstancedMesh */
const HaloRibs: React.FC<{ dims: ShellDims }> = ({ dims }) => {
  const { seamY } = dims;
  const ox = outerX(dims);
  const oz = outerZ(dims);
  const parts = useMemo(
    () => ({
      rib: new THREE.BoxGeometry(0.014, 1, 0.014),
      // Không dùng transmission (đắt): nhựa mờ giả bằng độ trong suốt
      material: new THREE.MeshPhysicalMaterial({ color: '#f2f5f2', roughness: 0.35, clearcoat: 0.4, transparent: true, opacity: 0.82 }),
    }),
    []
  );
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  const matrices = useMemo(() => {
    const pitch = 0.055;
    const list: THREE.Matrix4[] = [];
    const rib = (x: number, z: number) => {
      const bottom = wedgeBottomY(z) + 0.012;
      const height = seamY - 0.09 - bottom;
      if (height > 0.01) list.push(composeMatrix(x, bottom + height / 2, z, [0, 0, 0], [1, height, 1]));
    };
    for (let x = -ox + 0.12; x <= ox - 0.12; x += pitch) rib(x, oz + 0.004);
    for (let z = -oz + 0.12; z <= oz - 0.12; z += pitch) {
      rib(-ox - 0.004, z);
      rib(ox + 0.004, z);
    }
    return list;
  }, [ox, oz, seamY]);
  return <StaticInstances name="Detail_HaloRibs" geometry={parts.rib} material={parts.material} matrices={matrices} />;
};

/* -------------------------------------------------------------------------- */
/* Dải đèn RGB trên vỏ (Nut108 mép trước, F87 Pro hai hông, Nut87 mặt sau)      */
/* -------------------------------------------------------------------------- */

export const LightStrips: React.FC<{ dims: ShellDims; placement: 'none' | 'front' | 'sides' | 'rear' }> = ({ dims, placement }) => {
  const ox = outerX(dims);
  const oz = outerZ(dims);
  const parts = useMemo(() => {
    const rainbow = getRainbowTexture();
    return {
      long: new THREE.BoxGeometry(dims.outerWidth * 0.94, 0.022, 0.01),
      side: new THREE.BoxGeometry(0.01, 0.022, dims.outerDepth * 0.82),
      material: new THREE.MeshBasicMaterial({ map: rainbow, color: rainbow ? '#ffffff' : '#7b6bff', toneMapped: false }),
    };
  }, [dims.outerWidth, dims.outerDepth]);
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  if (placement === 'none') return null;
  if (placement === 'front') {
    return <mesh name="Detail_LightStrip" geometry={parts.long} material={parts.material} position={[0, wedgeBottomY(oz) + 0.035, oz + 0.006]} />;
  }
  if (placement === 'rear') {
    return <mesh name="Detail_LightStrip" geometry={parts.long} material={parts.material} position={[0, (wedgeBottomY(-oz) + dims.seamY) / 2, -oz - 0.006]} />;
  }
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          name="Detail_LightStrip"
          geometry={parts.side}
          material={parts.material}
          position={[s * (ox + 0.006), wedgeBottomY(0) + 0.045, 0]}
          rotation={[-TYPING_ANGLE, 0, 0]}
        />
      ))}
    </>
  );
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
  /** Mặt trên vỏ trên trong toạ độ group vỏ trên */
  topY: number;
  /** Độ cao gốc group vỏ trên khi đã ghép (để chi tiết phủ kín cả hông vỏ dưới) */
  restY: number;
}

/** Màn hình, núm, con lăn… nay là module riêng (parts/Modules.tsx), không nằm trong shellStyle nữa */
export const ShellTopDetails: React.FC<TopDetailsProps> = ({ style, dims, caseMaterial, ledColor, topY, restY }) => {
  switch (style) {
    case 'x85':
      return (
        <>
          <SportSideFacets dims={dims} material={caseMaterial} topY={topY} />
          <IndicatorBar dims={dims} topY={topY} color={ledColor} short />
        </>
      );
    case 'wood-accent':
      return <WoodSidePanels dims={dims} topY={topY} restY={restY} />;
    case 'stars-s':
      return <DiagonalCornerStrips dims={dims} topY={topY} color={ledColor} />;
    default:
      return null;
  }
};

/** Weikav Stars75 S: hai dải đèn PC cắt kim cương chạy chéo qua góc trên-trái và dưới-phải ("phá kén") */
const DiagonalCornerStrips: React.FC<{ dims: ShellDims; topY: number; color: string }> = ({ dims, topY, color }) => {
  const bezel = (dims.outerDepth - dims.keysDepth) / 2;
  const parts = useMemo(
    () => ({
      strip: new THREE.BoxGeometry(bezel * 2.6, 0.012, 0.045),
      pc: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.25, transparent: true, opacity: 0.85, emissiveIntensity: 0.9 }),
    }),
    [bezel]
  );
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  useEffect(() => {
    parts.pc.emissive.set(color);
  }, [parts, color]);
  const inset = bezel * 0.75;
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          name="Detail_DiagonalLightStrip"
          geometry={parts.strip}
          material={parts.pc}
          position={[s * (dims.outerWidth / 2 - inset), topY + 0.004, -s * (dims.outerDepth / 2 - inset)]}
          rotation={[0, s * (Math.PI / 4), 0]}
        />
      ))}
    </>
  );
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

/**
 * Keychron K2 HE Special Edition: hai thanh ốp gỗ hồng mộc phủ kín hai hông, từ mặt bàn lên ngang mặt vỏ
 * (nhìn từ trên thấy rõ hai dải gỗ như ảnh). Biên dạng theo nêm nên đáy gỗ nằm phẳng trên bàn.
 */
const WOOD_THICKNESS = 0.13;
const WoodSidePanels: React.FC<{ dims: ShellDims; topY: number; restY: number }> = ({ dims, topY, restY }) => {
  const parts = useMemo(
    () => ({
      panel: createSideProfile(dims.outerDepth + CASE_BEVEL * 2, (z) => wedgeBottomY(z) - restY, topY, WOOD_THICKNESS),
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
    [dims.outerDepth, topY, restY]
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
          position={[s * (dims.outerWidth / 2 + CASE_BEVEL + WOOD_THICKNESS / 2 - 0.01), 0, 0]}
          castShadow
          receiveShadow
        />
      ))}
    </>
  );
};
