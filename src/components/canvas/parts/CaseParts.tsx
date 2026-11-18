'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  CASE_FLOOR_THICKNESS,
  FOOT,
  TYPING_ANGLE,
  caseFeetPositions,
  createKnurledKnobGeometry,
  createWedgeCaseGeometry,
  createWeightGeometry,
  standoffPositions,
  wedgeBottomY,
} from '../geometry/caseGeometry';
import { CASE_BEVEL } from '../geometry/keyboardGeometry';
import { getSurfaceTexture } from '../geometry/proceduralTextures';
import { gasketTabPositions, usbPortX } from './InternalLayers';
import { StaticInstances, composeMatrix } from './StaticInstances';

interface BottomCaseProps {
  outerWidth: number;
  outerDepth: number;
  keysWidth: number;
  keysDepth: number;
  cornerRadius: number;
  /** Mép trên vỏ dưới (đường ghép với vỏ trên) */
  top: number;
  /** Mặt dưới PCB (trụ bắt ốc đỡ lên tới đây) */
  pcbBottom: number;
  material: THREE.Material;
  showWeight: boolean;
}

/** Vỏ dưới nêm + khoang rỗng: trụ bắt ốc, gờ đỡ gasket, cổng USB-C khoét lõm, chân cao su trong hốc, tạ đồng. */
export const BottomCaseBody: React.FC<BottomCaseProps> = ({
  outerWidth,
  outerDepth,
  keysWidth,
  keysDepth,
  cornerRadius,
  top,
  pcbBottom,
  material,
  showWeight,
}) => {
  const cavity = useMemo(() => ({ width: keysWidth + 0.06, depth: keysDepth + 0.06 }), [keysWidth, keysDepth]);
  const shell = useMemo(
    () => createWedgeCaseGeometry({ width: outerWidth, depth: outerDepth, top, cavity, cornerRadius }),
    [outerWidth, outerDepth, top, cavity, cornerRadius]
  );
  useEffect(() => () => shell.dispose(), [shell]);

  const parts = useMemo(
    () => ({
      // Trụ cao 1 đơn vị, co giãn theo khoảng từ sàn tới PCB tại từng vị trí
      standoff: new THREE.CylinderGeometry(0.045, 0.05, 1, 16),
      ledge: new THREE.BoxGeometry(0.22, 0.03, 0.05),
      usb: new THREE.BoxGeometry(0.19, 0.075, 0.03),
      foot: new THREE.CylinderGeometry(FOOT.radius, FOOT.radius * 0.94, FOOT.height, 28),
      recess: new THREE.CylinderGeometry(FOOT.recessRadius, FOOT.recessRadius, 0.004, 28),
    }),
    []
  );
  useEffect(() => () => Object.values(parts).forEach((g) => g.dispose()), [parts]);

  const darkMaterials = useMemo(
    () => ({
      rubber: new THREE.MeshStandardMaterial({ color: '#121214', roughness: 0.95 }),
      recess: new THREE.MeshStandardMaterial({ color: '#0c0c0d', roughness: 0.8 }),
      port: new THREE.MeshStandardMaterial({ color: '#08080a', roughness: 0.6 }),
    }),
    []
  );
  useEffect(() => () => Object.values(darkMaterials).forEach((m) => m.dispose()), [darkMaterials]);

  const matrices = useMemo(() => {
    // Chân cao su vuông góc với mặt đáy nêm (= đứng thẳng trên mặt bàn): xoay ngược góc gõ
    const tilt: [number, number, number] = [-TYPING_ANGLE, 0, 0];
    const feet = caseFeetPositions(outerWidth, outerDepth);
    const ledges = gasketTabPositions(cavity.width, cavity.depth - 0.16);
    return {
      standoffs: standoffPositions(keysWidth, keysDepth).map(([x, z]) => {
        const floor = wedgeBottomY(z) + CASE_FLOOR_THICKNESS;
        return composeMatrix(x, (floor + pcbBottom) / 2, z, [0, 0, 0], [1, pcbBottom - floor, 1]);
      }),
      ledges: ledges.map(([x, z]) => composeMatrix(x, top - 0.03, z)),
      feet: feet.map(([x, z]) => composeMatrix(x, wedgeBottomY(z) - FOOT.height / 2, z, tilt)),
      recesses: feet.map(([x, z]) => composeMatrix(x, wedgeBottomY(z) - 0.0015, z, tilt)),
    };
  }, [outerWidth, outerDepth, keysWidth, keysDepth, cavity, pcbBottom, top]);

  return (
    <>
      <mesh geometry={shell} material={material} castShadow receiveShadow />
      <StaticInstances geometry={parts.standoff} material={material} matrices={matrices.standoffs} castShadow />
      <StaticInstances geometry={parts.ledge} material={material} matrices={matrices.ledges} />
      <StaticInstances name="Detail_Foot" geometry={parts.foot} material={darkMaterials.rubber} matrices={matrices.feet} />
      <StaticInstances name="Detail_FootRecess" geometry={parts.recess} material={darkMaterials.recess} matrices={matrices.recesses} />
      {/* Cổng USB-C khoét lõm ở mặt sau, ngay dưới đường ghép vỏ */}
      <mesh
        name="Detail_UsbCutout"
        geometry={parts.usb}
        material={darkMaterials.port}
        position={[usbPortX(keysWidth), top - 0.055, -outerDepth / 2 - CASE_BEVEL + 0.012]}
      />
      {showWeight && <BrassWeight keysWidth={keysWidth} keysDepth={keysDepth} />}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Tạ đồng phay xước, vát cạnh, 4 ốc lục giác                                  */
/* -------------------------------------------------------------------------- */
export const WEIGHT_THICKNESS = 0.032;

const BrassWeight: React.FC<{ keysWidth: number; keysDepth: number }> = ({ keysWidth, keysDepth }) => {
  const width = keysWidth * 0.62;
  const depth = keysDepth * 0.45;
  const geometry = useMemo(() => createWeightGeometry(width, depth, WEIGHT_THICKNESS), [width, depth]);
  const screw = useMemo(() => new THREE.CylinderGeometry(0.03, 0.03, 0.012, 6), []);
  useEffect(
    () => () => {
      geometry.dispose();
      screw.dispose();
    },
    [geometry, screw]
  );

  const materials = useMemo(() => {
    const brushed = getSurfaceTexture('brushed');
    return {
      brass: new THREE.MeshPhysicalMaterial({
        color: '#c99a43',
        metalness: 1,
        roughness: 0.42,
        roughnessMap: brushed,
        bumpMap: brushed,
        bumpScale: 0.25,
        clearcoat: 0.3,
        clearcoatRoughness: 0.2,
      }),
      screw: new THREE.MeshStandardMaterial({ color: '#2b2c2f', metalness: 0.9, roughness: 0.35 }),
    };
  }, []);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  const screws = useMemo(
    () =>
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => composeMatrix(sx * (width / 2 - 0.09), WEIGHT_THICKNESS + 0.004, sz * (depth / 2 - 0.08))),
    [width, depth]
  );

  // Nằm phẳng trên sàn nêm: đặt tại tâm sàn rồi xoay ngược góc gõ cho song song mặt sàn
  return (
    <group name="Weight" position={[0, wedgeBottomY(0) + CASE_FLOOR_THICKNESS, 0]} rotation={[-TYPING_ANGLE, 0, 0]}>
      <mesh geometry={geometry} material={materials.brass} castShadow receiveShadow />
      <StaticInstances name="Detail_WeightScrew" geometry={screw} material={materials.screw} matrices={screws} />
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/* Núm xoay nhôm CNC khía rãnh                                                 */
/* -------------------------------------------------------------------------- */
export const KNOB = { radius: 0.15, height: 0.36 } as const;

interface RotaryKnobProps {
  position: [number, number, number];
  color: string;
  radius?: number;
  /** Số rãnh khía: AULA khía mịn (~60), mặc định 36 */
  ridges?: number;
  /** Vòng viền kim loại nhấn màu quanh đỉnh núm (kiểu Leobog Hi75) */
  accentRing?: string;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({ position, color, radius = KNOB.radius, ridges = 36, accentRing }) => {
  const geometry = useMemo(() => createKnurledKnobGeometry({ radius, height: KNOB.height, ridges }), [radius, ridges]);
  const ring = useMemo(() => new THREE.TorusGeometry(radius * 0.86, radius * 0.07, 10, 64).rotateX(Math.PI / 2), [radius]);
  useEffect(() => () => ring.dispose(), [ring]);
  const ringMaterial = useMemo(() => new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.2 }), []);
  useEffect(() => () => ringMaterial.dispose(), [ringMaterial]);
  useEffect(() => {
    if (accentRing) ringMaterial.color.set(accentRing);
  }, [ringMaterial, accentRing]);
  const marker = useMemo(() => new THREE.BoxGeometry(0.012, 0.004, 0.06), []);
  useEffect(
    () => () => {
      geometry.dispose();
      marker.dispose();
    },
    [geometry, marker]
  );
  const materials = useMemo(() => {
    const blasted = getSurfaceTexture('beadBlast');
    return {
      body: new THREE.MeshPhysicalMaterial({
        roughness: 0.4,
        metalness: 0.5,
        roughnessMap: blasted,
        bumpMap: blasted,
        bumpScale: 0.2,
        clearcoat: 0.4,
      }),
      marker: new THREE.MeshStandardMaterial({ color: '#f2f2f0', roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.15 }),
    };
  }, []);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  useEffect(() => {
    materials.body.color.set(color);
  }, [materials, color]);

  return (
    <group name="Detail_Knob" position={position}>
      <mesh geometry={geometry} material={materials.body} castShadow receiveShadow />
      {/* Vạch chỉ báo trên mặt đỉnh */}
      <mesh geometry={marker} material={materials.marker} position={[0, KNOB.height + 0.002, radius * 0.45]} />
      {accentRing && <mesh name="Detail_KnobRing" geometry={ring} material={ringMaterial} position={[0, KNOB.height - radius * 0.1, 0]} />}
    </group>
  );
};
