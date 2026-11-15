'use client';

import React from 'react';
import { Keyboard, Layers, PanelLeftClose, PanelLeftOpen, Pause, Play, Sparkles } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { useStageStore } from '@/store/useStageStore';
import { findKeycapSet } from '@/lib/keyboard/keycapSets';
import type { CameraPreset, CaseMaterial, KeyboardLayout, PlateMaterial, SwitchType } from '@/types/keyboard';
import { CASE_COLORS, CASE_MATERIAL_LABELS } from './DesignPanel';
import { PLATE_OPTIONS, SWITCH_OPTIONS } from './SoundPanel';

export const CAMERA_OPTIONS: { id: CameraPreset; label: string }[] = [
  { id: 'perspective', label: 'Phối cảnh' },
  { id: 'isometric', label: 'Chéo' },
  { id: 'top', label: 'Trên' },
  { id: 'front', label: 'Trước' },
  { id: 'side', label: 'Bên' },
];

export interface BuildSummary {
  layout: KeyboardLayout;
  caseMaterial: CaseMaterial;
  caseColor: string;
  keycapSetName?: string;
  plateMaterial: PlateMaterial;
  switchType: SwitchType;
}

/**
 * Tiêu đề sân khấu kiểu trang sản phẩm: tên máy lớn, một dòng mô tả cấu hình đang dựng.
 * Ví dụ: "KeyCraft TKL" / "Vỏ nhôm đỏ, keycap Đỏ hai tông, plate FR4, switch Linear."
 */
export const buildStageTitle = (build: BuildSummary): { brand: string; model: string; subtitle: string } => {
  const colorName =
    build.caseMaterial === 'wood'
      ? undefined
      : CASE_COLORS.find((c) => c.hex.toLowerCase() === build.caseColor.toLowerCase())?.label.toLowerCase();
  const shell = ['Vỏ', CASE_MATERIAL_LABELS[build.caseMaterial].toLowerCase(), colorName].filter(Boolean).join(' ');
  const plate = PLATE_OPTIONS.find((p) => p.id === build.plateMaterial)?.name;
  const sw = SWITCH_OPTIONS.find((s) => s.id === build.switchType)?.name;
  return {
    brand: 'KeyCraft',
    model: build.layout,
    subtitle: `${shell}, keycap ${build.keycapSetName ?? 'tự phối'}, plate ${plate}, switch ${sw}.`,
  };
};

export const StageOverlay: React.FC = () => {
  const cameraPreset = useKeyboardStore((s) => s.cameraPreset);
  const setCameraPreset = useKeyboardStore((s) => s.setCameraPreset);
  const isExploded = useKeyboardStore((s) => s.isExploded);
  const toggleExploded = useKeyboardStore((s) => s.toggleExploded);
  const explosionOffset = useKeyboardStore((s) => s.explosionOffset);
  const setExplosionOffset = useKeyboardStore((s) => s.setExplosionOffset);
  const layout = useKeyboardStore((s) => s.layout);
  const caseMaterial = useKeyboardStore((s) => s.caseMaterial);
  const caseColor = useKeyboardStore((s) => s.caseColor);
  const plateMaterial = useKeyboardStore((s) => s.plateMaterial);
  const switchType = useKeyboardStore((s) => s.switchType);
  const keycapColor = useKeyboardStore((s) => s.keycapColor);
  const keycapModifierColor = useKeyboardStore((s) => s.keycapModifierColor);
  const keycapAccentColor = useKeyboardStore((s) => s.keycapAccentColor);
  const autoRotate = useStageStore((s) => s.autoRotate);
  const toggleAutoRotate = useStageStore((s) => s.toggleAutoRotate);
  const activeTab = useStageStore((s) => s.activeTab);
  const setActiveTab = useStageStore((s) => s.setActiveTab);
  const sidebarOpen = useStageStore((s) => s.sidebarOpen);
  const toggleSidebar = useStageStore((s) => s.toggleSidebar);

  const title = buildStageTitle({
    layout,
    caseMaterial,
    caseColor,
    plateMaterial,
    switchType,
    keycapSetName: findKeycapSet({ keycapColor, keycapModifierColor, keycapAccentColor })?.name,
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="order-2 flex min-w-0 items-center gap-2 lg:order-1">
        <button
          type="button"
          aria-controls="config-sidebar"
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? 'Thu gọn thanh cấu hình' : 'Mở thanh cấu hình'}
          title={sidebarOpen ? 'Thu gọn thanh cấu hình' : 'Mở thanh cấu hình'}
          onClick={toggleSidebar}
          className="toolbar toolbar__icon pointer-events-auto hidden lg:flex"
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" aria-hidden /> : <PanelLeftOpen className="h-4 w-4" aria-hidden />}
        </button>
        <div role="group" aria-label="Góc nhìn" className="toolbar pointer-events-auto max-w-full overflow-x-auto">
          {CAMERA_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={cameraPreset === option.id}
              onClick={() => setCameraPreset(option.id)}
              className={`toolbar__item ${cameraPreset === option.id ? 'toolbar__item--on' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        </div>

        <div className="pointer-events-auto order-1 flex items-center gap-2 lg:order-2">
          {isExploded && (
            <label className="toolbar hidden items-center gap-2 px-4 sm:flex">
              <span className="text-[12px] text-muted">Khoảng cách</span>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.1}
                value={explosionOffset}
                onChange={(e) => setExplosionOffset(Number.parseFloat(e.target.value))}
                className="slider w-24"
                aria-label="Khoảng cách giữa các lớp"
              />
            </label>
          )}
          <button
            type="button"
            aria-pressed={autoRotate}
            aria-label="Xoay 360°"
            title={autoRotate ? 'Dừng xoay' : 'Xoay 360°'}
            onClick={toggleAutoRotate}
            className="toolbar toolbar__icon"
          >
            {autoRotate ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          </button>
          <button
            type="button"
            aria-pressed={isExploded}
            aria-label={isExploded ? 'Ghép lại' : 'Tách 7 lớp'}
            onClick={toggleExploded}
            className={`toolbar toolbar__action ${isExploded ? 'toolbar__action--on' : ''}`}
          >
            <Layers className="h-4 w-4" aria-hidden />
            {/* Trên điện thoại chỉ hiện biểu tượng để thanh góc nhìn đủ chỗ */}
            <span aria-hidden className="hidden whitespace-nowrap sm:inline">
              {isExploded ? 'Ghép lại' : 'Tách 7 lớp'}
            </span>
          </button>
          <button
            type="button"
            aria-label="Hỏi Trợ lý AI"
            title="Hỏi Trợ lý AI cấu hình bàn phím"
            onClick={() => setActiveTab('ai')}
            className={`toolbar toolbar__action ${activeTab === 'ai' ? 'toolbar__action--on' : ''}`}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            <span aria-hidden className="hidden whitespace-nowrap sm:inline">
              Trợ lý AI
            </span>
          </button>
        </div>
      </div>

      {/* Tiêu đề sản phẩm: tên máy lớn, ẩn đi khi tách lớp để nhường chỗ cho nhãn linh kiện */}
      <div className={`stage-title ${isExploded ? 'stage-title--hidden' : ''}`} aria-live="polite">
        <p className="stage-title__name">
          <span className="stage-title__mask">
            <span className="stage-title__word">{title.brand}</span>
          </span>{' '}
          <span className="stage-title__mask">
            {/* key đổi theo layout để chữ trồi lên lại khi đổi bố cục */}
            <span key={title.model} className="stage-title__word stage-title__word--model">
              {title.model}
            </span>
          </span>
        </p>
        <p className="stage-title__sub">{title.subtitle}</p>
      </div>

      <div className="hidden justify-center lg:flex">
        <p className="hint-fine toolbar items-center gap-2 px-4 py-2 text-[12px] text-muted">
          <Keyboard className="h-4 w-4" aria-hidden />
          Gõ phím để thử, kéo để xoay, cuộn để phóng to
        </p>
      </div>
    </div>
  );
};
