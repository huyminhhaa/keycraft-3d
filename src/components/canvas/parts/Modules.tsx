'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { PlacedModule } from '@/lib/keyboard/modules';
import { moduleFootprint } from '@/lib/keyboard/modules';
import { KEY_UNIT } from '../geometry/keyboardGeometry';
import { createKnurledKnobGeometry } from '../geometry/caseGeometry';
import { getMarbleTexture, getRainbowTexture, getScreenTexture } from '../geometry/proceduralTextures';
import { KNOB, RotaryKnob } from './CaseParts';

/**
 * Module phần cứng riêng của từng mẫu (modules.ts): màn hình, núm xoay, con lăn, đèn báo, badge.
 * Nằm trong group vỏ trên nên đi theo vỏ trên khi tách 7 lớp. Mọi geometry/material/texture đều
 * memo theo kích thước và được dispose khi module bị gỡ (đổi mẫu phím); texture màn hình/cầu vồng/marble
 * dùng chung qua cache của proceduralTextures.
 */

interface ModuleLayerProps {
  modules: PlacedModule[];
  layoutWidth: number;
  layoutDepth: number;
  /** Mặt trên plate trong toạ độ group vỏ trên */
  plateY: number;
  /** Mặt trên viền vỏ trong toạ độ group vỏ trên */
  caseTopY: number;
  /** Núm mặc định: bạc trên vỏ sáng, xám than trên vỏ tối */
  defaultKnobColor: string;
}

type Footprint = ReturnType<typeof moduleFootprint>;

const useDisposable = (items: { dispose: () => void }[]): void => {
  useEffect(() => () => items.forEach((item) => item.dispose()), [items]);
};

export const ModuleLayer: React.FC<ModuleLayerProps> = ({ modules, layoutWidth, layoutDepth, plateY, caseTopY, defaultKnobColor }) => (
  <group name="Modules">
    {modules.map((module, index) => {
      const foot = moduleFootprint(module.rect, layoutWidth, layoutDepth, KEY_UNIT);
      const baseY = module.mount === 'case' ? caseTopY : plateY;
      const key = `${module.kind}-${index}-${module.rect.x}-${module.rect.y}`;
      switch (module.kind) {
        case 'screen':
          return <ScreenModule key={key} foot={foot} baseY={plateY} size={module.size} ui={module.ui} />;
        case 'knob':
          return <KnobModule key={key} foot={foot} baseY={plateY} module={module} defaultColor={defaultKnobColor} />;
        case 'roller':
          return <RollerModule key={key} foot={foot} baseY={plateY} color={module.color ?? '#2a2b2e'} light={module.light} />;
        case 'lightbar':
          return <LightbarModule key={key} foot={foot} baseY={baseY} raised={module.mount === 'plate'} color={module.color} shape={module.shape} />;
        case 'badge':
          return <BadgeModule key={key} foot={foot} baseY={baseY} raised={module.mount === 'plate'} finish={module.finish} />;
        default:
          // blank: chỉ chừa ô trống (plate lộ ra)
          return null;
      }
    })}
  </group>
);

/* -------------------------------------------------------------------------- */
/* Màn hình                                                                   */
/* -------------------------------------------------------------------------- */

const SCREEN_HEIGHT = { mini: 0.22, medium: 0.22, large: 0.27 } as const;
const SCREEN_BEZEL = { mini: 0.022, medium: 0.026, large: 0.03 } as const;

const ScreenModule: React.FC<{ foot: Footprint; baseY: number; size: 'mini' | 'medium' | 'large'; ui: 'clock' | 'calculator' | 'status' | 'off' }> = ({
  foot,
  baseY,
  size,
  ui,
}) => {
  const height = SCREEN_HEIGHT[size];
  const bezel = SCREEN_BEZEL[size];
  const width = foot.width - 0.03;
  const depth = foot.depth - 0.03;
  const parts = useMemo(() => {
    const texture = getScreenTexture(ui, size);
    return {
      body: new THREE.BoxGeometry(width, height, depth),
      panel: new THREE.PlaneGeometry(width - bezel * 2, depth - bezel * 2).rotateX(-Math.PI / 2),
      // Khung bezel đen bóng
      frame: new THREE.MeshPhysicalMaterial({ color: '#111216', roughness: 0.28, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 }),
      // Màn hình tự phát sáng: không chịu ánh sáng/tone mapping để giữ màu giao diện rực như thật
      lcd: new THREE.MeshBasicMaterial({ map: texture, color: texture ? '#ffffff' : '#163447', toneMapped: false }),
      // Lớp kính phủ: phản chiếu đèn studio như mặt kính bóng
      glass: new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        transparent: true,
        opacity: ui === 'off' ? 0.35 : 0.1,
        depthWrite: false,
      }),
    };
  }, [width, height, depth, bezel, ui, size]);
  useDisposable(useMemo(() => [parts.body, parts.panel, parts.frame, parts.lcd, parts.glass], [parts]));
  return (
    <group name={`Detail_Screen_${size}`} position={[foot.x, baseY, foot.z]}>
      <mesh geometry={parts.body} material={parts.frame} position={[0, height / 2, 0]} castShadow receiveShadow />
      <mesh geometry={parts.panel} material={parts.lcd} position={[0, height + 0.0015, 0]} />
      <mesh geometry={parts.panel} material={parts.glass} position={[0, height + 0.003, 0]} />
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/* Núm xoay                                                                    */
/* -------------------------------------------------------------------------- */

const KnobModule: React.FC<{
  foot: Footprint;
  baseY: number;
  module: Extract<PlacedModule, { kind: 'knob' }>;
  defaultColor: string;
}> = ({ foot, baseY, module, defaultColor }) => {
  const fit = Math.min(foot.width, foot.depth) / 2;
  const color = module.color ?? defaultColor;
  if (module.style === 'flat') {
    // Đĩa tròn thấp, gần như nhẵn, viền mảnh (MCHOSE G75 V2)
    return (
      <RotaryKnob
        position={[foot.x, baseY, foot.z]}
        color={color}
        radius={Math.min(0.16, fit * 0.88)}
        height={KNOB.height * 0.55}
        ridges={90}
        ridgeDepth={0.008}
        accentRing={module.ring}
      />
    );
  }
  if (module.style === 'side') {
    // Trụ khía gắn ở hông vỏ, nhô ra ngoài mép (AULA Nova75 Pro)
    return <RotaryKnob position={[foot.x, baseY, foot.z]} color={color} radius={Math.min(0.13, fit)} height={KNOB.height * 1.02} ridges={48} />;
  }
  return (
    <RotaryKnob
      position={[foot.x, baseY, foot.z]}
      color={color}
      radius={module.cap ? Math.min(0.168, fit * 0.92) : Math.min(KNOB.radius, fit * 0.85)}
      ridges={module.cap ? 48 : 60}
      accentRing={module.ring}
      cap={module.cap}
    />
  );
};

/* -------------------------------------------------------------------------- */
/* Con lăn                                                                     */
/* -------------------------------------------------------------------------- */

const RollerModule: React.FC<{ foot: Footprint; baseY: number; color: string; light?: string }> = ({ foot, baseY, color, light }) => {
  const radius = Math.min(0.11, foot.depth * 0.32);
  const length = Math.min(foot.width * 0.62, 0.26);
  const parts = useMemo(
    () => ({
      // Trụ khía nằm ngang, trục song song hàng phím (lăn tới/lui về phía người gõ)
      wheel: createKnurledKnobGeometry({ radius, height: length, ridges: 40, depth: 0.08 })
        .translate(0, -length / 2, 0)
        .rotateZ(Math.PI / 2),
      // Hốc khuyết tối và hai giá đỡ trục
      pocket: new THREE.BoxGeometry(foot.width - 0.05, 0.02, foot.depth - 0.05),
      bracket: new THREE.BoxGeometry(0.03, radius * 1.3, radius * 1.1),
      led: new THREE.BoxGeometry(0.03, 0.012, 0.06),
      metal: new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.85, clearcoat: 0.4 }),
      dark: new THREE.MeshStandardMaterial({ color: '#0d0d10', roughness: 0.85 }),
      glow: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: light ?? '#ffffff', emissiveIntensity: 1.6, toneMapped: false }),
    }),
    [radius, length, foot.width, foot.depth, color, light]
  );
  useDisposable(useMemo(() => Object.values(parts), [parts]));
  const axleY = baseY + radius + 0.06;
  return (
    <group name="Detail_Roller" position={[foot.x, 0, foot.z]}>
      <mesh geometry={parts.pocket} material={parts.dark} position={[0, baseY + 0.01, 0]} receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={parts.bracket} material={parts.dark} position={[s * (length / 2 + 0.02), axleY - radius * 0.2, 0]} />
      ))}
      <mesh geometry={parts.wheel} material={parts.metal} position={[0, axleY, 0]} castShadow />
      {light && <mesh geometry={parts.led} material={parts.glow} position={[-(length / 2 + 0.06), baseY + 0.03, 0]} />}
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/* Đèn báo / dải RGB                                                           */
/* -------------------------------------------------------------------------- */

const LightbarModule: React.FC<{ foot: Footprint; baseY: number; raised: boolean; color: string; shape: 'bar' | 'dot' }> = ({
  foot,
  baseY,
  raised,
  color,
  shape,
}) => {
  // Trên plate: ống dẫn sáng cao 0.06 để nhìn thấy giữa các keycap; trên viền vỏ: khe mỏng
  const thickness = raised ? 0.06 : 0.008;
  const parts = useMemo(() => {
    const rainbow = color === 'rainbow' ? getRainbowTexture() : null;
    const radius = Math.min(foot.width, foot.depth) / 2;
    return {
      geometry:
        shape === 'dot'
          ? new THREE.CylinderGeometry(radius, radius, thickness, 32)
          : new THREE.BoxGeometry(foot.width, thickness, foot.depth),
      ring: shape === 'dot' ? new THREE.TorusGeometry(radius * 0.92, radius * 0.12, 8, 40).rotateX(Math.PI / 2) : null,
      material:
        color === 'rainbow'
          ? new THREE.MeshBasicMaterial({ map: rainbow, color: rainbow ? '#ffffff' : '#9a7bff', toneMapped: false })
          : new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 1.8, toneMapped: false }),
      metal: new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 1, roughness: 0.25 }),
    };
  }, [foot.width, foot.depth, color, shape, thickness]);
  useDisposable(useMemo(() => [parts.geometry, parts.material, parts.metal, ...(parts.ring ? [parts.ring] : [])], [parts]));
  return (
    <group name="Detail_Lightbar" position={[foot.x, baseY + thickness / 2 + 0.002, foot.z]}>
      <mesh geometry={parts.geometry} material={parts.material} />
      {parts.ring && <mesh geometry={parts.ring} material={parts.metal} position={[0, thickness / 2, 0]} />}
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

const BADGE_FINISH: Record<'gold' | 'silver' | 'marble' | 'black', THREE.MeshPhysicalMaterialParameters> = {
  gold: { color: '#d6a94c', metalness: 1, roughness: 0.22, clearcoat: 0.6 },
  silver: { color: '#d3d6db', metalness: 1, roughness: 0.2, clearcoat: 0.5 },
  black: { color: '#141518', metalness: 0.3, roughness: 0.3, clearcoat: 1 },
  marble: { color: '#ffffff', metalness: 0, roughness: 0.12, clearcoat: 1 },
};

const BadgeModule: React.FC<{ foot: Footprint; baseY: number; raised: boolean; finish: keyof typeof BADGE_FINISH }> = ({
  foot,
  baseY,
  raised,
  finish,
}) => {
  // Trên plate: khối badge cao tới chân keycap; trên viền vỏ: tấm mỏng dán nổi
  const thickness = raised ? 0.13 : 0.01;
  const parts = useMemo(
    () => ({
      geometry: new THREE.BoxGeometry(foot.width - 0.03, thickness, foot.depth - 0.03),
      material: new THREE.MeshPhysicalMaterial({
        ...BADGE_FINISH[finish],
        map: finish === 'marble' ? getMarbleTexture() : null,
      }),
    }),
    [foot.width, foot.depth, thickness, finish]
  );
  useDisposable(useMemo(() => [parts.geometry, parts.material], [parts]));
  return (
    <mesh
      name={`Detail_Badge_${finish}`}
      geometry={parts.geometry}
      material={parts.material}
      position={[foot.x, baseY + thickness / 2, foot.z]}
      castShadow
      receiveShadow
    />
  );
};
