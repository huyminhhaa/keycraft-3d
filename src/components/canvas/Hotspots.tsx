'use client';

import React from 'react';
import { Html } from '@react-three/drei';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { useStageStore } from '@/store/useStageStore';
import { getLayout } from '@/lib/keyboard/layouts';
import { getModelEntry } from '@/lib/keyboard/models';
import { findKeycapSet } from '@/lib/keyboard/keycapSets';
import type { KeyboardState } from '@/types/keyboard';
import { CASE_COLORS, CASE_MATERIAL_LABELS } from '@/components/ui/DesignPanel';
import { PLATE_OPTIONS, SWITCH_OPTIONS } from '@/components/ui/SoundPanel';
import { getCaseDimensions, keyCenter } from './geometry/keyboardGeometry';

export interface Hotspot {
  id: string;
  position: [number, number, number];
  title: string;
  detail: string;
}

/** Điểm chú thích kiểu trang sản phẩm: mỗi điểm gắn vào một bộ phận, nội dung lấy đúng cấu hình đang chọn. */
export const buildHotspots = (state: KeyboardState): Hotspot[] => {
  const layout = getLayout(state.layout);
  const dims = getCaseDimensions(layout.width, layout.depth);
  const center = (code: string) => {
    const key = layout.keys.find((k) => k.code === code);
    return key ? keyCenter(key, layout.width, layout.depth) : ([0, 0] as [number, number]);
  };
  const [escX, escZ] = center('Escape');
  const [spaceX, spaceZ] = center('Space');
  const keycapSet = findKeycapSet(state)?.name ?? 'tự phối';
  const color =
    state.caseMaterial === 'wood'
      ? ''
      : ` ${CASE_COLORS.find((c) => c.hex.toLowerCase() === state.caseColor.toLowerCase())?.label.toLowerCase() ?? ''}`;
  const sw = SWITCH_OPTIONS.find((s) => s.id === state.switchType);
  const plate = PLATE_OPTIONS.find((p) => p.id === state.plateMaterial)?.name;

  const spots: Hotspot[] = [
    { id: 'keycap', position: [escX, 0.82, escZ], title: `Keycap ${keycapSet}`, detail: 'Profile Cherry, ký tự in trên mặt phím' },
    {
      id: 'case',
      position: [dims.outerWidth / 2 - 0.25, 0.6, dims.outerDepth / 2 - 0.12],
      title: `Vỏ ${CASE_MATERIAL_LABELS[state.caseMaterial].toLowerCase()}${color}`.trimEnd(),
      detail: 'Cạnh vát, tạ đồng bên trong',
    },
    { id: 'switch', position: [spaceX, 0.82, spaceZ], title: `Switch ${sw?.name}`, detail: `${sw?.feel}, plate ${plate}` },
  ];
  if (state.underglowEnabled) {
    spots.push({
      id: 'led',
      position: [dims.outerWidth / 2 + 0.05, 0.09, 0.12],
      title: 'Đèn LED hông',
      detail: `Độ sáng ${Math.round(state.underglowBrightness * 100)}%`,
    });
  }
  return spots;
};

// shortcut: chú thích không bị che khi mô hình xoay ra sau (occlude raycast tốn khung hình), thêm occlude nếu người dùng thấy rối
export const Hotspots: React.FC = () => {
  const state = useKeyboardStore();
  const introDone = useStageStore((s) => s.introDone);
  // Vị trí chú thích tính theo mẫu dựng bằng code; file .glb có hình dáng riêng nên không gắn chú thích
  if (!introDone || state.isExploded || getModelEntry(state.modelId).source === 'glb') return null;

  return (
    // Cùng độ nghiêng với vỏ trong KeyboardModel
    <group rotation={[0.05, 0, 0]}>
      {buildHotspots(state).map((spot) => (
        <Html key={spot.id} position={spot.position} center zIndexRange={[15, 0]}>
          <div className="hotspot">
            <button type="button" className="hotspot__dot" aria-label={`${spot.title}. ${spot.detail}`} />
            <div className="hotspot__card" aria-hidden>
              <p className="hotspot__title">{spot.title}</p>
              <p className="hotspot__detail">{spot.detail}</p>
            </div>
          </div>
        </Html>
      ))}
    </group>
  );
};
