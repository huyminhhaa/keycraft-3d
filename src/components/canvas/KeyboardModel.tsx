'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { getLayout, type PlacedKey } from '@/lib/keyboard/layouts';
import { legendColorFor } from '@/lib/keyboard/keycapSets';
import { isKeyPressed, pressKey, releaseKey } from '@/lib/keyboard/pressedKeys';
import { prefersReducedMotion, stepColorToward } from '@/lib/ui/cinematic';
import type { CaseMaterial, PlateMaterial, SwitchType } from '@/types/keyboard';
import {
  KEY_UNIT,
  createCaseGeometry,
  createKeycapGeometry,
  getCaseDimensions,
  getKeycapShape,
  keyCenter,
} from './geometry/keyboardGeometry';
import { createLegendTexture } from './geometry/legendTexture';

/* -------------------------------------------------------------------------- */
/* Vị trí trục Y của 7 lớp (export để unit test)                              */
/* -------------------------------------------------------------------------- */
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
  plate: Number((0.4 + offset * 1.05).toFixed(3)),
  switches: Number((0.52 + offset * 1.4).toFixed(3)),
  keycaps: Number((0.74 + offset * 1.8).toFixed(3)),
  topCase: Number((0.44 + offset * 2.15).toFixed(3)),
});

/** Độ lún của keycap khi nhấn (đơn vị thế giới ≈ 4mm hành trình switch) */
export const KEY_TRAVEL = 0.07;

/* -------------------------------------------------------------------------- */
/* Vật liệu                                                                   */
/* -------------------------------------------------------------------------- */
type PhysicalProps = Partial<THREE.MeshPhysicalMaterialParameters>;

export const getCaseMaterialProps = (material: CaseMaterial, color: string): PhysicalProps => {
  switch (material) {
    case 'polycarbonate':
      return { color, roughness: 0.45, metalness: 0, transmission: 0.6, thickness: 0.4, transparent: true, opacity: 0.92 };
    case 'acrylic':
      return { color, roughness: 0.08, metalness: 0, transmission: 0.85, thickness: 0.4, transparent: true, opacity: 0.95 };
    case 'wood':
      return { color: '#6b4226', roughness: 0.72, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.6 };
    case 'aluminum':
    default:
      // Nhôm anodized: kim loại có màu, hơi nhám, phủ lớp bóng mỏng để bắt highlight của đèn studio
      return { color, roughness: 0.34, metalness: 0.75, clearcoat: 0.35, clearcoatRoughness: 0.25 };
  }
};

const getPlateMaterialProps = (material: PlateMaterial): PhysicalProps => {
  switch (material) {
    case 'fr4':
      return { color: '#1c1f1a', roughness: 0.6, metalness: 0.15 };
    case 'pom':
      return { color: '#e7e4dc', roughness: 0.55, metalness: 0 };
    case 'polycarbonate':
      return { color: '#d8dbdf', roughness: 0.3, metalness: 0, transparent: true, opacity: 0.6 };
    case 'aluminum':
    default:
      return { color: '#a9adb3', roughness: 0.3, metalness: 0.9 };
  }
};

const SWITCH_STEM: Record<SwitchType, string> = {
  linear: '#d9342b',
  tactile: '#a0612f',
  clicky: '#2f6bd9',
  silent_linear: '#5c5f66',
};

/* -------------------------------------------------------------------------- */
/* Nhãn chú thích khi tách lớp                                                */
/* -------------------------------------------------------------------------- */
interface LayerLabelProps {
  index: string;
  name: string;
  /** Hai lớp trên cùng bung rộng nhất trong khung hình nên chỉ ghi tên */
  detail?: string;
  visible: boolean;
  /** Khoảng cách từ tâm tới mép vỏ + lề */
  x: number;
}

/** Lớp lẻ ghi chú bên phải, lớp chẵn bên trái: hai lớp sát nhau không bao giờ đè chữ lên nhau. */
export const labelSide = (index: string): 'left' | 'right' => (Number(index) % 2 === 0 ? 'left' : 'right');

const LayerLabel: React.FC<LayerLabelProps> = ({ index, name, detail, visible, x }) => {
  if (!visible) return null;
  const side = labelSide(index);
  return (
    <Html position={[side === 'left' ? -x : x, 0, 0]} distanceFactor={7.5} zIndexRange={[20, 0]}>
      <div className={`layer-label layer-label--${side}`}>
        <span className="layer-label__line" aria-hidden />
        <span className="layer-label__index">{index}</span>
        <span className="layer-label__name">{name}</span>
        {detail && <span className="layer-label__detail">{detail}</span>}
      </div>
    </Html>
  );
};

/* -------------------------------------------------------------------------- */
/* Một keycap                                                                 */
/* -------------------------------------------------------------------------- */
interface KeycapProps {
  keyDef: PlacedKey;
  position: [number, number, number];
  /** Vật liệu dùng chung theo vai trò phím (đổi màu dần cho cả nhóm cùng lúc) */
  material: THREE.Material;
  legendColor: string;
  registerRef: (code: string, group: THREE.Group | null) => void;
}

const Keycap: React.FC<KeycapProps> = ({ keyDef, position, material, legendColor, registerRef }) => {
  const shape = getKeycapShape(keyDef.w, keyDef.profileRow);
  const geometry = createKeycapGeometry(keyDef.w, keyDef.profileRow);
  const legendWidth = shape.topWidth - 0.03;
  const legendDepth = shape.topDepth - 0.03;
  const texture = useMemo(
    () => createLegendTexture(keyDef.legend, legendWidth, legendDepth),
    [keyDef.legend, legendWidth, legendDepth]
  );

  const onDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    pressKey(keyDef.code);
  };
  const onUp = () => releaseKey(keyDef.code);

  return (
    <group ref={(group) => registerRef(keyDef.code, group)} position={position}>
      <mesh
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      />
      {texture && (
        <mesh position={[0, shape.height + 0.0015, 0]} rotation={[-Math.PI / 2 + shape.tilt, 0, 0]}>
          <planeGeometry args={[legendWidth, legendDepth]} />
          <meshStandardMaterial
            map={texture}
            color={legendColor}
            transparent
            roughness={0.6}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      )}
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/* Switch: dùng InstancedMesh (3 draw call cho cả bàn phím)                   */
/* -------------------------------------------------------------------------- */
interface SwitchesProps {
  centers: [number, number][];
  stemColor: string;
}

const SWITCH_PARTS = [
  { size: [0.26, 0.08, 0.26] as const, y: -0.05, color: '#18181a', transparent: false },
  { size: [0.25, 0.07, 0.25] as const, y: 0.025, color: '#c9c3b6', transparent: true },
];

const Switches: React.FC<SwitchesProps> = ({ centers, stemColor }) => {
  const bottomRef = useRef<THREE.InstancedMesh>(null);
  const topRef = useRef<THREE.InstancedMesh>(null);
  const stemRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const place = (mesh: THREE.InstancedMesh | null, y: number) => {
      if (!mesh) return;
      centers.forEach(([x, z], i) => {
        matrix.makeTranslation(x, y, z);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    place(bottomRef.current, SWITCH_PARTS[0].y);
    place(topRef.current, SWITCH_PARTS[1].y);
    place(stemRef.current, 0.09);
  }, [centers]);

  return (
    <>
      <instancedMesh ref={bottomRef} args={[undefined, undefined, centers.length]} castShadow>
        <boxGeometry args={[...SWITCH_PARTS[0].size]} />
        <meshStandardMaterial color={SWITCH_PARTS[0].color} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={topRef} args={[undefined, undefined, centers.length]}>
        <boxGeometry args={[...SWITCH_PARTS[1].size]} />
        <meshStandardMaterial color={SWITCH_PARTS[1].color} roughness={0.25} transparent opacity={0.55} />
      </instancedMesh>
      <instancedMesh ref={stemRef} args={[undefined, undefined, centers.length]}>
        <boxGeometry args={[0.09, 0.07, 0.09]} />
        <meshStandardMaterial color={stemColor} roughness={0.4} />
      </instancedMesh>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Mô hình bàn phím                                                           */
/* -------------------------------------------------------------------------- */
// Vỏ cao tổng 0.64 (≈ 32mm quy đổi): nửa dưới mỏng, nửa trên ôm sát tới chân keycap
const BOTTOM_CASE = { yBottom: -0.08, height: 0.2 };
const TOP_CASE = { yBottom: -0.32, height: 0.44 }; // tương đối với gốc lớp top case (0.44) → mép trên ở 0.56
const KEYCAP_BASE_Y = -0.17; // đáy keycap so với gốc lớp keycap (0.74)
/** Tốc độ chuyển màu: ~0.4s để đổi gần hết màu */
const COLOR_SPEED = 7;

type KeycapMaterials = Record<PlacedKey['role'], THREE.MeshPhysicalMaterial>;

const createKeycapMaterials = (colors: Record<PlacedKey['role'], string>): KeycapMaterials => {
  const make = (hex: string) =>
    new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.55, metalness: 0, sheen: 0.2, sheenRoughness: 0.8 });
  return { alpha: make(colors.alpha), modifier: make(colors.modifier), accent: make(colors.accent) };
};

/** Đưa màu của các vật liệu dần về màu đích (thao tác imperative trên đối tượng Three.js). */
const stepMaterials = (
  pairs: [THREE.Material & { color: THREE.Color } | null | undefined, THREE.Color][],
  step: number
): void => {
  pairs.forEach(([material, target]) => {
    if (material) stepColorToward(material.color, target, step);
  });
};

export const KeyboardModel: React.FC = () => {
  const layoutId = useKeyboardStore((s) => s.layout);
  const isExploded = useKeyboardStore((s) => s.isExploded);
  const explosionOffset = useKeyboardStore((s) => s.explosionOffset);
  const plateMaterial = useKeyboardStore((s) => s.plateMaterial);
  const caseMaterial = useKeyboardStore((s) => s.caseMaterial);
  const switchType = useKeyboardStore((s) => s.switchType);
  const keycapColor = useKeyboardStore((s) => s.keycapColor);
  const keycapModifierColor = useKeyboardStore((s) => s.keycapModifierColor);
  const keycapAccentColor = useKeyboardStore((s) => s.keycapAccentColor);
  const caseColor = useKeyboardStore((s) => s.caseColor);
  const ledColor = useKeyboardStore((s) => s.underglowColor);
  const ledBrightness = useKeyboardStore((s) => s.underglowBrightness);
  const ledEnabled = useKeyboardStore((s) => s.underglowEnabled);

  const layout = useMemo(() => getLayout(layoutId), [layoutId]);
  const dims = useMemo(() => getCaseDimensions(layout.width, layout.depth), [layout]);

  const keyPositions = useMemo(
    () => layout.keys.map((key) => keyCenter(key, layout.width, layout.depth)),
    [layout]
  );

  const bottomCaseGeometry = useMemo(
    () => createCaseGeometry(dims.outerWidth, dims.outerDepth, BOTTOM_CASE.height, BOTTOM_CASE.yBottom),
    [dims]
  );
  const topCaseGeometry = useMemo(
    () =>
      createCaseGeometry(dims.outerWidth, dims.outerDepth, TOP_CASE.height, TOP_CASE.yBottom, {
        width: dims.keysWidth + 0.06,
        depth: dims.keysDepth + 0.06,
      }),
    [dims]
  );

  const caseMaterialProps = useMemo(() => getCaseMaterialProps(caseMaterial, caseColor), [caseMaterial, caseColor]);
  const plateMaterialProps = useMemo(() => getPlateMaterialProps(plateMaterial), [plateMaterial]);

  /* ---------------- Màu đổi dần (không nhảy cụt) ---------------- */
  // Màu ban đầu chỉ đặt một lần; sau đó useFrame kéo màu dần về đích
  const [initialCaseColor] = useState(() => caseMaterialProps.color as string);
  const [reduceMotion] = useState(prefersReducedMotion);
  const caseRestProps = useMemo(() => {
    const rest = { ...caseMaterialProps };
    delete rest.color;
    return rest;
  }, [caseMaterialProps]);
  const caseTarget = useMemo(() => new THREE.Color(caseMaterialProps.color as string), [caseMaterialProps.color]);
  const keycapMaterials = useMemo(
    () =>
      createKeycapMaterials({
        alpha: useKeyboardStore.getState().keycapColor,
        modifier: useKeyboardStore.getState().keycapModifierColor,
        accent: useKeyboardStore.getState().keycapAccentColor,
      }),
    []
  );
  useEffect(() => () => Object.values(keycapMaterials).forEach((m) => m.dispose()), [keycapMaterials]);
  const keycapTargets = useMemo(
    () => ({
      alpha: new THREE.Color(keycapColor),
      modifier: new THREE.Color(keycapModifierColor),
      accent: new THREE.Color(keycapAccentColor),
    }),
    [keycapColor, keycapModifierColor, keycapAccentColor]
  );
  const bottomCaseMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const topCaseMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  /* ---------------- Refs cho 7 lớp và từng keycap ---------------- */
  const bottomCaseRef = useRef<THREE.Group>(null);
  const pcbRef = useRef<THREE.Group>(null);
  const foamRef = useRef<THREE.Group>(null);
  const plateRef = useRef<THREE.Group>(null);
  const switchesRef = useRef<THREE.Group>(null);
  const keycapsRef = useRef<THREE.Group>(null);
  const topCaseRef = useRef<THREE.Group>(null);
  const keyGroups = useRef(new Map<string, THREE.Group>());
  const registerKey = (code: string, group: THREE.Group | null) => {
    if (group) keyGroups.current.set(code, group);
    else keyGroups.current.delete(code);
  };

  const currentOffset = useRef(isExploded ? explosionOffset : 0);

  useFrame((_, delta) => {
    // Tách lớp: nội suy mượt theo delta (không re-render React)
    const target = isExploded ? explosionOffset : 0;
    currentOffset.current = THREE.MathUtils.lerp(currentOffset.current, target, Math.min(1, delta * 8));
    const positions = calculateLayerPositions(currentOffset.current);
    const layers: [THREE.Group | null, number][] = [
      [bottomCaseRef.current, positions.bottomCase],
      [pcbRef.current, positions.pcb],
      [foamRef.current, positions.foam],
      [plateRef.current, positions.plate],
      [switchesRef.current, positions.switches],
      [keycapsRef.current, positions.keycaps],
      [topCaseRef.current, positions.topCase],
    ];
    layers.forEach(([group, y]) => {
      if (group) group.position.y = y;
    });

    // Đổi màu vỏ và keycap dần trong ~0.4s
    const colorStep = reduceMotion ? 1 : Math.min(1, delta * COLOR_SPEED);
    stepMaterials(
      [
        [bottomCaseMaterialRef.current, caseTarget],
        [topCaseMaterialRef.current, caseTarget],
        [keycapMaterials.alpha, keycapTargets.alpha],
        [keycapMaterials.modifier, keycapTargets.modifier],
        [keycapMaterials.accent, keycapTargets.accent],
      ],
      colorStep
    );

    // Nhấn phím: keycap lún xuống nhanh, bật lên chậm hơn một chút như switch thật
    keyGroups.current.forEach((group, code) => {
      const down = isKeyPressed(code);
      const goal = down ? KEYCAP_BASE_Y - KEY_TRAVEL : KEYCAP_BASE_Y;
      group.position.y = THREE.MathUtils.lerp(group.position.y, goal, Math.min(1, delta * (down ? 40 : 22)));
    });
  });

  const initial = calculateLayerPositions(isExploded ? explosionOffset : 0);
  const labelX = dims.outerWidth / 2 + 0.15;
  const legendColors: Record<PlacedKey['role'], string> = {
    alpha: legendColorFor(keycapColor),
    modifier: legendColorFor(keycapModifierColor),
    accent: legendColorFor(keycapAccentColor),
  };

  const ledIntensity = ledEnabled ? 1.5 + ledBrightness * 5 : 0;
  const ledLength = dims.outerDepth * 0.62;

  return (
    // Nghiêng nhẹ về phía người gõ như góc gõ thật của vỏ
    <group rotation={[0.05, 0, 0]}>
      {/* LỚP 1: BOTTOM CASE + tạ đồng bên trong + LED hông */}
      <group ref={bottomCaseRef} position={[0, initial.bottomCase, 0]}>
        <mesh geometry={bottomCaseGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial ref={bottomCaseMaterialRef} {...caseRestProps} color={initialCaseColor} />
        </mesh>

        {/* Tạ đồng chải xước nằm trong lòng vỏ */}
        <mesh position={[0, BOTTOM_CASE.yBottom + BOTTOM_CASE.height + 0.012, 0]} receiveShadow>
          <boxGeometry args={[dims.keysWidth * 0.72, 0.024, dims.keysDepth * 0.62]} />
          <meshPhysicalMaterial color="#c79a45" metalness={1} roughness={0.32} clearcoat={0.2} />
        </mesh>

        {/* Dải LED hai bên hông, ngay đường ghép vỏ trên/dưới */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * (dims.outerWidth / 2 + 0.024), BOTTOM_CASE.yBottom + BOTTOM_CASE.height - 0.035, 0.12]}
          >
            <boxGeometry args={[0.012, 0.05, ledLength]} />
            <meshStandardMaterial
              color={ledEnabled ? ledColor : '#2a2a2c'}
              emissive={ledColor}
              emissiveIntensity={ledIntensity}
              toneMapped={!ledEnabled}
            />
          </mesh>
        ))}

        {/* Chân cao su */}
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <mesh key={i} position={[sx * (dims.outerWidth / 2 - 0.35), BOTTOM_CASE.yBottom - 0.015, sz * (dims.outerDepth / 2 - 0.3)]}>
            <cylinderGeometry args={[0.13, 0.13, 0.03, 24]} />
            <meshStandardMaterial color="#121214" roughness={0.95} />
          </mesh>
        ))}

        <LayerLabel index="01" name="Vỏ dưới" detail="Tạ đồng" visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 2: PCB */}
      <group ref={pcbRef} position={[0, initial.pcb, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[dims.keysWidth - 0.02, 0.03, dims.keysDepth - 0.02]} />
          <meshStandardMaterial color="#14211a" roughness={0.55} metalness={0.2} />
        </mesh>
        <LayerLabel index="02" name="PCB" detail="Hotswap 5 chân" visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 3: FOAM */}
      <group ref={foamRef} position={[0, initial.foam, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[dims.keysWidth - 0.04, 0.035, dims.keysDepth - 0.04]} />
          <meshStandardMaterial color="#d6cfc0" roughness={1} />
        </mesh>
        <LayerLabel index="03" name="Foam Poron" detail="Dày 3.5mm" visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 4: PLATE */}
      <group ref={plateRef} position={[0, initial.plate, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[dims.keysWidth + 0.02, 0.04, dims.keysDepth + 0.02]} />
          <meshPhysicalMaterial {...plateMaterialProps} />
        </mesh>
        <LayerLabel index="04" name="Plate" detail={plateMaterial.toUpperCase()} visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 5: SWITCHES */}
      <group ref={switchesRef} position={[0, initial.switches, 0]}>
        <Switches centers={keyPositions} stemColor={SWITCH_STEM[switchType]} />
        <LayerLabel index="05" name="Switch" detail={switchType.replace('_', ' ')} visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 6: KEYCAPS */}
      <group ref={keycapsRef} position={[0, initial.keycaps, 0]}>
        {layout.keys.map((key, i) => (
          <Keycap
            key={`${layoutId}-${key.code}`}
            keyDef={key}
            position={[keyPositions[i][0], KEYCAP_BASE_Y, keyPositions[i][1]]}
            material={keycapMaterials[key.role]}
            legendColor={legendColors[key.role]}
            registerRef={registerKey}
          />
        ))}
        <LayerLabel index="06" name="Keycap" visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 7: TOP CASE (khung) */}
      <group ref={topCaseRef} position={[0, initial.topCase, 0]}>
        <mesh geometry={topCaseGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial ref={topCaseMaterialRef} {...caseRestProps} color={initialCaseColor} />
        </mesh>
        <LayerLabel index="07" name="Vỏ trên" visible={isExploded} x={labelX} />
      </group>

      {/* Ánh LED hắt xuống mặt bàn hai bên */}
      {ledEnabled &&
        [-1, 1].map((side) => (
          <pointLight
            key={side}
            position={[side * (dims.outerWidth / 2 + 0.3), -0.05, 0.1]}
            color={ledColor}
            intensity={ledBrightness * 2.2}
            distance={2.4}
            decay={2}
          />
        ))}
    </group>
  );
};

/** Bề rộng ngoài của vỏ theo layout — dùng để camera tự canh khung. */
export const getModelWidth = (layoutId: Parameters<typeof getLayout>[0]): number => {
  const layout = getLayout(layoutId);
  return getCaseDimensions(layout.width, layout.depth).outerWidth + 0.06;
};

export { KEY_UNIT };
