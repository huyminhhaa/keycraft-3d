'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { getLayout, knobKeyCode, topRowModuleCodes, type PlacedKey } from '@/lib/keyboard/layouts';
import { findBuild, type KeyboardBuild } from '@/lib/keyboard/builds';
import { legendColorFor } from '@/lib/keyboard/keycapSets';
import { isKeyPressed, pressKey, releaseKey } from '@/lib/keyboard/pressedKeys';
import { prefersReducedMotion, stepColorToward } from '@/lib/ui/cinematic';
import {
  DEFAULT_CASE_SHAPE,
  type CaseMaterial,
  type KeycapProfile,
  type PlateMaterial,
  type SwitchType,
} from '@/types/keyboard';
import {
  HOMING_BAR,
  HOMING_KEYS,
  KEY_UNIT,
  createCaseGeometry,
  createKeycapGeometry,
  createLegendGeometry,
  getCaseDimensions,
  getKeycapShape,
  keyCenter,
  keycapSurfaceY,
} from './geometry/keyboardGeometry';
import { getSurfaceTexture, getWoodColorTexture } from './geometry/proceduralTextures';
import { TYPING_ANGLE } from './geometry/caseGeometry';
import { BottomCaseBody, RotaryKnob } from './parts/CaseParts';
import { ShellBottomDetails, ShellTopDetails } from './parts/ShellParts';
import { createLegendTexture } from './geometry/legendTexture';
import { EXPORT_ROOT_NAME } from '@/lib/keyboard/exportGlb';
import { FoamLayer, PCB_THICKNESS, PLATE_THICKNESS, PcbLayer, PlateLayer } from './parts/InternalLayers';
import { SwitchLayer } from './parts/SwitchLayer';

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
  // Như sơ đồ tách lớp của các hãng: khung vỏ trên bay ngay trên switch, keycap lên trên cùng.
  // (Trước đây vỏ trên bay cao hơn keycap nên cả hàng keycap bị lọt thỏm trong khung, không nhìn thấy.)
  topCase: Number((0.44 + offset * 1.8).toFixed(3)),
  keycaps: Number((0.74 + offset * 2.45).toFixed(3)),
});

/** Chân núm xoay trong toạ độ group vỏ trên (gốc 0.44): chạm plate (0.4), đỉnh cao 0.36 ngang mặt keycap */
const KNOB_BASE_Y = -0.04;

/** Thông số vật liệu đặt về mặc định trước khi đổi chất liệu (setValues chỉ ghi đè thuộc tính được truyền) */
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

/** Núm kim loại: vỏ sáng thì núm bạc, vỏ tối thì núm xám than. */
export const knobColorFor = (caseColor: string): string =>
  new THREE.Color(caseColor).getHSL({ h: 0, s: 0, l: 0 }).l > 0.5 ? '#c9ccd1' : '#45484d';

export interface LayerDetails {
  bottomCase?: string;
  pcb?: string;
  foam?: string;
  plate?: string;
  switches?: string;
  keycaps?: string;
  topCase?: string;
}

/**
 * Chú thích 7 lớp khi tách: build phím thật thì ghi đúng linh kiện thật.
 * Người dùng đổi plate/switch khác build thì ghi theo lựa chọn mới (không còn là linh kiện của build).
 */
export const layerDetails = (
  build: KeyboardBuild | undefined,
  plateMaterial: PlateMaterial,
  switchType: SwitchType
): LayerDetails => ({
  bottomCase: build ? build.specs.case : 'Tạ đồng',
  pcb: 'Hotswap',
  foam: build ? build.specs.foam : 'Dày 3.5mm',
  plate: build && build.look.plateMaterial === plateMaterial ? build.specs.plate : plateMaterial.toUpperCase(),
  switches: build && build.look.switchType === switchType ? build.specs.switch : switchType.replace('_', ' '),
  keycaps: build?.specs.keycap,
  topCase: build?.specs.mount,
});

/** Build lắp không foam (theo nguồn): lớp foam không được vẽ */
export const hasNoFoam = (build: KeyboardBuild | undefined): boolean =>
  Boolean(build?.specs.foam.toLowerCase().startsWith('không foam'));

/** Độ lún của keycap khi nhấn (đơn vị thế giới ≈ 4mm hành trình switch) */
export const KEY_TRAVEL = 0.07;

/* -------------------------------------------------------------------------- */
/* Vật liệu                                                                   */
/* -------------------------------------------------------------------------- */
type PhysicalProps = Partial<THREE.MeshPhysicalMaterialParameters>;

export const getCaseMaterialProps = (material: CaseMaterial, color: string): PhysicalProps => {
  switch (material) {
    case 'plastic':
      // Nhựa ABS đúc (AULA F75, F99 Pro…): đục, mờ, chỉ hơi bóng
      return { color, roughness: 0.62, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.7 };
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

export const getPlateMaterialProps =(material: PlateMaterial): PhysicalProps => {
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
  profile: KeycapProfile;
  registerRef: (code: string, group: THREE.Group | null) => void;
}

const homingBarGeometry = new THREE.BoxGeometry(HOMING_BAR.width, HOMING_BAR.height, HOMING_BAR.depth);

const Keycap: React.FC<KeycapProps> = ({ keyDef, position, material, legendColor, profile, registerRef }) => {
  const shape = getKeycapShape(keyDef.w, keyDef.profileRow, profile);
  const geometry = createKeycapGeometry(keyDef.w, keyDef.profileRow, profile);
  const legendWidth = shape.topWidth - 0.03;
  const legendDepth = shape.topDepth - 0.03;
  const legendGeometry = createLegendGeometry(keyDef.w, keyDef.profileRow, legendWidth, legendDepth, profile);
  const texture = useMemo(
    () => createLegendTexture(keyDef.legend, legendWidth, legendDepth),
    [keyDef.legend, legendWidth, legendDepth]
  );
  const homing = HOMING_KEYS.has(keyDef.code);

  const onDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    pressKey(keyDef.code);
  };
  const onUp = () => releaseKey(keyDef.code);

  return (
    // Tên theo quy ước modelParts.ts: file .glb xuất ra vẫn nhấn phím và đổi màu đúng nhóm
    <group ref={(group) => registerRef(keyDef.code, group)} position={position} name={`Keycap_${keyDef.code}_${keyDef.role}`}>
      <mesh
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      />
      {/* Gờ định vị F/J: cùng vật liệu keycap, nổi trên mặt lõm gần mép trước */}
      {homing && (
        <mesh
          geometry={homingBarGeometry}
          material={material}
          position={[0, keycapSurfaceY(shape, 0, HOMING_BAR.z) + HOMING_BAR.height / 2 - 0.001, HOMING_BAR.z]}
          castShadow
        />
      )}
      {texture && (
        <mesh name="Legend" geometry={legendGeometry}>
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
/* Mô hình bàn phím                                                           */
/* -------------------------------------------------------------------------- */
// Vỏ cao tổng 0.64 (≈ 32mm quy đổi): nửa dưới mỏng, nửa trên ôm sát tới chân keycap
const BOTTOM_CASE = { yBottom: -0.08, height: 0.2 };
const TOP_CASE = { yBottom: -0.32, height: 0.44 }; // tương đối với gốc lớp top case (0.44) → mép trên ở 0.56
const KEYCAP_BASE_Y = -0.17; // đáy keycap so với gốc lớp keycap (0.74)
/** Mặt trên plate trong toạ độ group switch khi đã ghép lớp (switch ngồi trên plate, vỏ dưới lọt qua lỗ) */
const REST = calculateLayerPositions(0);
const SWITCH_PLATE_TOP_Y = REST.plate + PLATE_THICKNESS / 2 - REST.switches;
/** Tốc độ chuyển màu: ~0.4s để đổi gần hết màu */
const COLOR_SPEED = 7;

type KeycapMaterials = Record<PlacedKey['role'], THREE.MeshPhysicalMaterial>;

const createKeycapMaterials = (colors: Record<PlacedKey['role'], string>): KeycapMaterials => {
  // Nhựa PBT double-shot: hạt li ti (bumpMap) + nhám lì (roughnessMap), không bóng như ABS
  const grain = getSurfaceTexture('pbt');
  const make = (hex: string) =>
    new THREE.MeshPhysicalMaterial({
      color: hex,
      roughness: 0.68,
      metalness: 0,
      bumpMap: grain,
      bumpScale: 0.35,
      roughnessMap: grain,
      sheen: 0.25,
      sheenRoughness: 0.85,
    });
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
  const caseShape = useKeyboardStore((s) => s.caseShape ?? DEFAULT_CASE_SHAPE);
  const shellStyle = useKeyboardStore((s) => s.shellStyle ?? 'default');
  const keycapProfile = useKeyboardStore((s) => s.keycapProfile ?? 'cherry');
  const switchColors = useKeyboardStore((s) => s.switchColors);
  const build = findBuild(useKeyboardStore((s) => s.buildId ?? null));

  const layout = useMemo(() => getLayout(layoutId), [layoutId]);
  const dims = useMemo(() => getCaseDimensions(layout.width, layout.depth, caseShape.bezel), [layout, caseShape.bezel]);

  // Núm xoay chiếm chỗ phím ngoài cùng bên phải hàng trên (giống AULA F75, Hi75C Pro…)
  const knobCode = caseShape.knob ? knobKeyCode(layoutId) : null;
  // Module LCD 2U (kiểu Zoom75) chiếm 2 phím ngoài cùng bên phải hàng trên
  const lcdCodes = useMemo(() => (shellStyle === 'lcd-75' ? topRowModuleCodes(layoutId, 2) : []), [shellStyle, layoutId]);
  const keys = useMemo(
    () => layout.keys.filter((key) => key.code !== knobCode && !lcdCodes.includes(key.code)),
    [layout, knobCode, lcdCodes]
  );
  const lcdPosition = useMemo((): [number, number] | null => {
    const centers = layout.keys.filter((key) => lcdCodes.includes(key.code)).map((key) => keyCenter(key, layout.width, layout.depth));
    if (centers.length === 0) return null;
    return [centers.reduce((s, [x]) => s + x, 0) / centers.length, centers[0][1]];
  }, [layout, lcdCodes]);
  const keyPositions = useMemo(() => keys.map((key) => keyCenter(key, layout.width, layout.depth)), [keys, layout]);
  const knobPosition = useMemo(() => {
    const knobKey = layout.keys.find((key) => key.code === knobCode);
    return knobKey ? keyCenter(knobKey, layout.width, layout.depth) : null;
  }, [layout, knobCode]);

  const topCaseGeometry = useMemo(
    () =>
      createCaseGeometry(
        dims.outerWidth,
        dims.outerDepth,
        TOP_CASE.height,
        TOP_CASE.yBottom,
        { width: dims.keysWidth + 0.06, depth: dims.keysDepth + 0.06 },
        caseShape.cornerRadius
      ),
    [dims, caseShape.cornerRadius]
  );

  // Thông số chung cho các lớp bên trong (PCB, foam, plate, switch): hình học cache theo layout + núm xoay
  const layerProps = useMemo(
    () => ({
      keys,
      layoutWidth: layout.width,
      layoutDepth: layout.depth,
      keysWidth: dims.keysWidth,
      keysDepth: dims.keysDepth,
      cacheKey: `${layoutId}:${knobCode ?? 'no-knob'}:${lcdCodes.join('+') || 'no-lcd'}`,
    }),
    [keys, layout, dims, layoutId, knobCode, lcdCodes]
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
  // Vỏ gỗ có texture vân màu: tint gần trắng để không nhân màu nâu hai lần
  const caseTarget = useMemo(
    () => new THREE.Color(caseMaterial === 'wood' && getWoodColorTexture() ? '#efe2d2' : (caseMaterialProps.color as string)),
    [caseMaterial, caseMaterialProps.color]
  );

  const shellDims = useMemo(
    () => ({
      outerWidth: dims.outerWidth,
      outerDepth: dims.outerDepth,
      keysWidth: dims.keysWidth,
      keysDepth: dims.keysDepth,
      seamY: BOTTOM_CASE.yBottom + BOTTOM_CASE.height,
    }),
    [dims]
  );
  // NuPhy Halo: đáy nhựa ABS trong mờ để dải đèn Halo hắt sáng xuyên qua
  const haloBottomMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#eef1f2',
        roughness: 0.5,
        transmission: 0.55,
        thickness: 0.3,
        transparent: true,
        opacity: 0.9,
      }),
    []
  );
  useEffect(() => () => haloBottomMaterial.dispose(), [haloBottomMaterial]);

  /* ---------------- Vật liệu vỏ dùng chung cho vỏ trên, vỏ dưới, trụ ốc, gờ gasket ---------------- */
  const caseMaterialObject = useMemo(() => new THREE.MeshPhysicalMaterial({ color: initialCaseColor }), [initialCaseColor]);
  useEffect(() => () => caseMaterialObject.dispose(), [caseMaterialObject]);
  useEffect(() => {
    const wood = caseMaterial === 'wood';
    // Nhôm: hạt phun cát (bead-blast) trước khi anodize; gỗ: vân + thớ nổi; nhựa/PC/acrylic: nhẵn
    const blasted = caseMaterial === 'aluminum' ? getSurfaceTexture('beadBlast') : null;
    caseMaterialObject.setValues({
      ...MATERIAL_RESET,
      ...caseRestProps,
      map: wood ? getWoodColorTexture() : null,
      bumpMap: wood ? getSurfaceTexture('wood') : blasted,
      bumpScale: wood ? 0.6 : 0.15,
      roughnessMap: wood ? getSurfaceTexture('wood') : blasted,
    });
    // eslint-disable-next-line react-hooks/immutability -- vật liệu Three.js là đối tượng mutable, cần báo shader biên dịch lại
    caseMaterialObject.needsUpdate = true;
  }, [caseMaterialObject, caseMaterial, caseRestProps]);
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

  /* ---------------- Refs cho 7 lớp và từng keycap ---------------- */
  const bottomCaseRef = useRef<THREE.Group>(null);
  const pcbRef = useRef<THREE.Group>(null);
  const foamRef = useRef<THREE.Group>(null);
  const plateRef = useRef<THREE.Group>(null);
  const switchesRef = useRef<THREE.Group>(null);
  const keycapsRef = useRef<THREE.Group>(null);
  const topCaseRef = useRef<THREE.Group>(null);
  const keyGroups = useRef(new Map<string, THREE.Group>());
  // Stem switch lún đúng bằng keycap: đọc vị trí keycap thay vì tự tính lại
  const getKeyOffset = useCallback((code: string): number => {
    const group = keyGroups.current.get(code);
    return group ? group.position.y - KEYCAP_BASE_Y : 0;
  }, []);
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
        [caseMaterialObject, caseTarget],
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

  const details = layerDetails(build, plateMaterial, switchType);
  const ledIntensity = ledEnabled ? 1.5 + ledBrightness * 5 : 0;
  const ledLength = dims.outerDepth * 0.62;

  return (
    // Nghiêng nhẹ về phía người gõ như góc gõ thật của vỏ
    // Tên các group theo quy ước modelParts.ts (TopCase, Plate, Keycaps…) để nút "Tải file .glb" xuất đúng bộ phận
    <group name={EXPORT_ROOT_NAME} rotation={[TYPING_ANGLE, 0, 0]}>
      {/* LỚP 1: BOTTOM CASE nêm 6.5° + khoang rỗng + tạ đồng + LED hông */}
      <group ref={bottomCaseRef} name="BottomCase" position={[0, initial.bottomCase, 0]}>
        {/* Tạ đồng chỉ có ở mẫu tự phối; build thật không ghi có tạ thì không vẽ */}
        <BottomCaseBody
          outerWidth={dims.outerWidth}
          outerDepth={dims.outerDepth}
          keysWidth={dims.keysWidth}
          keysDepth={dims.keysDepth}
          cornerRadius={caseShape.cornerRadius}
          top={BOTTOM_CASE.yBottom + BOTTOM_CASE.height}
          pcbBottom={REST.pcb - PCB_THICKNESS / 2}
          material={shellStyle === 'halo-rgb' ? haloBottomMaterial : caseMaterialObject}
          showWeight={!build}
        />
        <ShellBottomDetails style={shellStyle} dims={shellDims} />

        {/* Dải LED hai bên hông (chỉ mẫu tự phối; build thật không có) */}
        {!build && [-1, 1].map((side) => (
          <mesh
            key={side}
            name="Detail_Led"
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

        <LayerLabel index="01" name="Vỏ dưới" detail={details.bottomCase} visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 2: PCB */}
      <group ref={pcbRef} name="PCB" position={[0, initial.pcb, 0]}>
        <PcbLayer {...layerProps} ledEnabled={ledEnabled} ledColor={ledColor} ledBrightness={ledBrightness} />
        <LayerLabel index="02" name="PCB" detail={details.pcb} visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 3: FOAM */}
      <group ref={foamRef} name="Foam" position={[0, initial.foam, 0]}>
        {/* Build ghi "Không foam" (Neo65, Mode Envoy trong video): không vẽ lớp foam, chỉ giữ nhãn */}
        {!hasNoFoam(build) && <FoamLayer {...layerProps} />}
        <LayerLabel index="03" name={build ? 'Foam' : 'Foam Poron'} detail={details.foam} visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 4: PLATE */}
      <group ref={plateRef} name="Plate" position={[0, initial.plate, 0]}>
        <PlateLayer {...layerProps} plateMaterial={plateMaterial} materialProps={plateMaterialProps} />
        <LayerLabel index="04" name="Plate" detail={details.plate} visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 5: SWITCHES */}
      <group ref={switchesRef} name="Switches" position={[0, initial.switches, 0]}>
        <SwitchLayer
          keys={keys}
          layoutWidth={layout.width}
          layoutDepth={layout.depth}
          stemColor={SWITCH_STEM[switchType]}
          // Màu switch thật chỉ áp dụng khi vẫn đúng loại switch của build (đổi loại thì về màu theo loại)
          switchColors={build && build.look.switchType === switchType ? switchColors : undefined}
          plateTopY={SWITCH_PLATE_TOP_Y}
          getKeyOffset={getKeyOffset}
        />
        <LayerLabel index="05" name="Switch" detail={details.switches} visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 6: KEYCAPS */}
      <group ref={keycapsRef} name="Keycaps" position={[0, initial.keycaps, 0]}>
        {keys.map((key, i) => (
          <Keycap
            key={`${layoutId}-${key.code}`}
            keyDef={key}
            position={[keyPositions[i][0], KEYCAP_BASE_Y, keyPositions[i][1]]}
            material={keycapMaterials[key.role]}
            legendColor={legendColors[key.role]}
            profile={keycapProfile}
            registerRef={registerKey}
          />
        ))}
        <LayerLabel index="07" name="Keycap" detail={details.keycaps} visible={isExploded} x={labelX} />
      </group>

      {/* LỚP 7: TOP CASE (khung) */}
      <group ref={topCaseRef} name="TopCase" position={[0, initial.topCase, 0]}>
        <mesh geometry={topCaseGeometry} material={caseMaterialObject} castShadow receiveShadow />
        {/* Núm xoay nhôm CNC khía rãnh: chân trên mặt plate, đỉnh ngang mặt keycap */}
        {knobPosition && (
          <RotaryKnob
            position={[knobPosition[0], KNOB_BASE_Y, knobPosition[1]]}
            color={knobColorFor(caseColor)}
            // AULA: khía mịn; Hi75: núm to có vòng viền kim loại nhấn màu
            ridges={shellStyle === 'aula' ? 60 : 36}
            radius={shellStyle === 'hi75' ? 0.185 : undefined}
            accentRing={shellStyle === 'hi75' ? '#c9a35a' : undefined}
          />
        )}
        <ShellTopDetails
          style={shellStyle}
          dims={shellDims}
          caseMaterial={caseMaterialObject}
          ledColor={ledColor}
          modulePosition={lcdPosition}
          topY={TOP_CASE.yBottom + TOP_CASE.height}
          plateY={KNOB_BASE_Y}
        />
        <LayerLabel index="06" name="Vỏ trên" detail={details.topCase} visible={isExploded} x={labelX} />
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

/** Bề rộng ngoài của vỏ theo layout (và viền của build) — dùng để camera tự canh khung. */
export const getModelWidth = (layoutId: Parameters<typeof getLayout>[0], bezel?: number): number => {
  const layout = getLayout(layoutId);
  return getCaseDimensions(layout.width, layout.depth, bezel).outerWidth + 0.06;
};

export { KEY_UNIT };
