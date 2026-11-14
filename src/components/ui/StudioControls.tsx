'use client';

import React, { useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  Box,
  Camera,
  ChevronDown,
  Cpu,
  Grid3x3,
  Layers,
  Lightbulb,
  Palette,
  Sliders,
  ToggleRight,
} from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { SPRINGS, createStaggerContainer } from '@/lib/ui/motion';
import type {
  CameraPreset,
  CaseMaterial,
  KeyboardLayout,
  PlateMaterial,
  SwitchType,
} from '@/types/keyboard';
import { BentoCard } from './studio/BentoCard';
import { OptionTile } from './studio/OptionTile';
import { SwatchRow, type SwatchOption } from './studio/ColorSwatch';
import { GlowToggle, LuxeRange } from './studio/Controls';

type StudioTab = 'hardware' | 'aesthetic' | 'camera';

const TABS: { id: StudioTab; label: string; icon: typeof Layers }[] = [
  { id: 'hardware', label: 'Phần Cứng', icon: Layers },
  { id: 'aesthetic', label: 'Màu & RGB', icon: Palette },
  { id: 'camera', label: 'Góc Nhìn', icon: Camera },
];

const LAYOUTS: { id: KeyboardLayout; keys: string }[] = [
  { id: '65%', keys: '68 phím' },
  { id: '75%', keys: '84 phím' },
  { id: 'TKL', keys: '87 phím' },
];

const PLATES: { id: PlateMaterial; name: string; sound: string }[] = [
  { id: 'aluminum', name: 'Nhôm (Alu)', sound: 'Đanh · Clack' },
  { id: 'polycarbonate', name: 'PC', sound: 'Trầm · Thock' },
  { id: 'pom', name: 'POM', sound: 'Sâu · Deep' },
  { id: 'fr4', name: 'FR4', sound: 'Cân bằng' },
];

const SWITCHES: { id: SwitchType; name: string; tag: string }[] = [
  { id: 'linear', name: 'Linear', tag: 'Mượt mà' },
  { id: 'tactile', name: 'Tactile', tag: 'Có khấc' },
  { id: 'clicky', name: 'Clicky', tag: 'Tiếng đanh' },
  { id: 'silent_linear', name: 'Silent', tag: 'Êm tĩnh' },
];

const CASE_MATERIALS: { id: CaseMaterial; name: string; hint: string }[] = [
  { id: 'aluminum', name: 'Nhôm CNC', hint: 'Anodized' },
  { id: 'polycarbonate', name: 'PC Mờ', hint: 'Frosted' },
  { id: 'acrylic', name: 'Acrylic', hint: 'Clear' },
  { id: 'wood', name: 'Gỗ', hint: 'Walnut' },
];

const CASE_COLORS: SwatchOption[] = [
  { label: 'Slate', hex: '#0f172a' },
  { label: 'Midnight', hex: '#020617' },
  { label: 'Silver', hex: '#475569' },
  { label: 'Crimson', hex: '#881337' },
  { label: 'Emerald', hex: '#064e3b' },
  { label: 'Cyber', hex: '#083344' },
];

const KEYCAP_COLORS: SwatchOption[] = [
  { label: 'Graphite', hex: '#1e293b' },
  { label: 'Ink', hex: '#0f172a' },
  { label: 'Chalk', hex: '#e2e8f0' },
  { label: 'Steel', hex: '#334155' },
  { label: 'Stone', hex: '#1c1917' },
];

const ACCENT_COLORS: SwatchOption[] = [
  { label: 'Cobalt', hex: '#3b82f6' },
  { label: 'Neon Cyan', hex: '#00f0ff' },
  { label: 'Magenta', hex: '#ec4899' },
  { label: 'Amber', hex: '#f59e0b' },
  { label: 'Jade', hex: '#10b981' },
  { label: 'Signal Red', hex: '#dc2626' },
];

const UNDERGLOW_COLORS: SwatchOption[] = [
  { label: 'Cyan', hex: '#00f0ff' },
  { label: 'Purple', hex: '#a855f7' },
  { label: 'Blue', hex: '#3b82f6' },
  { label: 'Pink', hex: '#ec4899' },
  { label: 'Green', hex: '#10b981' },
  { label: 'Amber', hex: '#f59e0b' },
];

const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'perspective', label: 'Phối Cảnh' },
  { id: 'isometric', label: 'Isometric' },
  { id: 'top', label: 'Nhìn Trên' },
  { id: 'front', label: 'Mặt Trước' },
  { id: 'side', label: 'Cạnh Bên' },
];

/* -------------------------------------------------------------------------- */
/* Tab: Phần cứng                                                             */
/* -------------------------------------------------------------------------- */
const HardwareTab: React.FC = () => {
  const layout = useKeyboardStore((s) => s.layout);
  const setLayout = useKeyboardStore((s) => s.setLayout);
  const plateMaterial = useKeyboardStore((s) => s.plateMaterial);
  const setPlateMaterial = useKeyboardStore((s) => s.setPlateMaterial);
  const switchType = useKeyboardStore((s) => s.switchType);
  const setSwitchType = useKeyboardStore((s) => s.setSwitchType);
  const caseMaterial = useKeyboardStore((s) => s.caseMaterial);
  const setCaseMaterial = useKeyboardStore((s) => s.setCaseMaterial);

  return (
    <>
      <BentoCard title="Kích Thước Bố Cục" eyebrow="01 · Layout" icon={Grid3x3} className="col-span-2">
        <div className="grid grid-cols-3 gap-2">
          {LAYOUTS.map((l) => (
            <OptionTile
              key={l.id}
              group="layout"
              label={l.id}
              hint={l.keys}
              mono
              selected={layout === l.id}
              onSelect={() => setLayout(l.id)}
            />
          ))}
        </div>
      </BentoCard>

      <BentoCard title="Chất Liệu Switch Plate" eyebrow="02 · Plate" icon={Box} className="col-span-2">
        <div className="grid grid-cols-2 gap-2">
          {PLATES.map((p) => (
            <OptionTile
              key={p.id}
              group="plate"
              label={p.name}
              hint={p.sound}
              selected={plateMaterial === p.id}
              onSelect={() => setPlateMaterial(p.id)}
            />
          ))}
        </div>
      </BentoCard>

      <BentoCard title="Switch" eyebrow="03 · Feel" icon={ToggleRight}>
        <div className="grid gap-1.5">
          {SWITCHES.map((sw) => (
            <OptionTile
              key={sw.id}
              group="switch"
              tone="indigo"
              label={sw.name}
              hint={sw.tag}
              selected={switchType === sw.id}
              onSelect={() => setSwitchType(sw.id)}
            />
          ))}
        </div>
      </BentoCard>

      <BentoCard title="Case" eyebrow="04 · Shell" icon={Cpu}>
        <div className="grid gap-1.5">
          {CASE_MATERIALS.map((c) => (
            <OptionTile
              key={c.id}
              group="case"
              tone="purple"
              label={c.name}
              hint={c.hint}
              selected={caseMaterial === c.id}
              onSelect={() => setCaseMaterial(c.id)}
            />
          ))}
        </div>
      </BentoCard>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Tab: Màu sắc & RGB                                                         */
/* -------------------------------------------------------------------------- */
const AestheticTab: React.FC = () => {
  const caseColor = useKeyboardStore((s) => s.caseColor);
  const setCaseColor = useKeyboardStore((s) => s.setCaseColor);
  const keycapColor = useKeyboardStore((s) => s.keycapColor);
  const setKeycapColor = useKeyboardStore((s) => s.setKeycapColor);
  const keycapAccentColor = useKeyboardStore((s) => s.keycapAccentColor);
  const setKeycapAccentColor = useKeyboardStore((s) => s.setKeycapAccentColor);
  const underglowEnabled = useKeyboardStore((s) => s.underglowEnabled);
  const setUnderglowEnabled = useKeyboardStore((s) => s.setUnderglowEnabled);
  const underglowColor = useKeyboardStore((s) => s.underglowColor);
  const setUnderglowColor = useKeyboardStore((s) => s.setUnderglowColor);
  const underglowBrightness = useKeyboardStore((s) => s.underglowBrightness);
  const setUnderglowBrightness = useKeyboardStore((s) => s.setUnderglowBrightness);

  return (
    <>
      <BentoCard title="Màu Sắc Case" eyebrow="01 · Shell finish" icon={Palette} className="col-span-2">
        <SwatchRow group="case-color" options={CASE_COLORS} value={caseColor} onChange={setCaseColor} />
      </BentoCard>

      <BentoCard title="Keycaps" eyebrow="02 · Alphas">
        <SwatchRow group="keycap-color" size="sm" options={KEYCAP_COLORS} value={keycapColor} onChange={setKeycapColor} />
      </BentoCard>

      <BentoCard title="Phím Nhấn" eyebrow="Esc · Enter · Space">
        <SwatchRow
          group="accent-color"
          size="sm"
          options={ACCENT_COLORS}
          value={keycapAccentColor}
          onChange={setKeycapAccentColor}
        />
      </BentoCard>

      <BentoCard
        title="Đèn Gầm RGB Underglow"
        eyebrow="03 · Bloom"
        icon={Lightbulb}
        className="col-span-2"
        action={
          <GlowToggle checked={underglowEnabled} onChange={setUnderglowEnabled} label="Bật tắt đèn gầm RGB" />
        }
      >
        <AnimatePresence initial={false}>
          {underglowEnabled ? (
            <motion.div
              key="underglow-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={SPRINGS.smooth}
              className="space-y-3.5 overflow-hidden"
            >
              <SwatchRow group="underglow-color" options={UNDERGLOW_COLORS} value={underglowColor} onChange={setUnderglowColor} />
              <LuxeRange
                label="Độ sáng (Bloom Glow)"
                min={0}
                max={1}
                step={0.05}
                value={underglowBrightness}
                onChange={setUnderglowBrightness}
                display={`${Math.round(underglowBrightness * 100)}%`}
              />
            </motion.div>
          ) : (
            <p className="text-[11px] text-slate-500">Đèn gầm đang tắt.</p>
          )}
        </AnimatePresence>
      </BentoCard>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Tab: Góc nhìn & Exploded view                                              */
/* -------------------------------------------------------------------------- */
const CameraTab: React.FC = () => {
  const cameraPreset = useKeyboardStore((s) => s.cameraPreset);
  const setCameraPreset = useKeyboardStore((s) => s.setCameraPreset);
  const isExploded = useKeyboardStore((s) => s.isExploded);
  const toggleExploded = useKeyboardStore((s) => s.toggleExploded);
  const explosionOffset = useKeyboardStore((s) => s.explosionOffset);
  const setExplosionOffset = useKeyboardStore((s) => s.setExplosionOffset);

  return (
    <>
      <BentoCard
        title="Bung Lớp 7 Phần Cứng"
        eyebrow="01 · Exploded view"
        icon={Layers}
        className="col-span-2"
        action={
          <motion.button
            type="button"
            aria-pressed={isExploded}
            onClick={toggleExploded}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRINGS.snappy}
            className={`rounded-full px-3 py-1.5 text-[11px] font-medium ring-1 ring-inset transition-colors ${
              isExploded
                ? 'bg-cyan-400 text-slate-950 ring-cyan-200/60 shadow-[0_0_20px_rgba(0,240,255,0.45)]'
                : 'bg-white/[0.05] text-zinc-200 ring-white/10 hover:bg-white/[0.09]'
            }`}
          >
            {isExploded ? 'Đang Bung' : 'Gộp Lại'}
          </motion.button>
        }
      >
        <AnimatePresence initial={false}>
          {isExploded ? (
            <motion.div
              key="explode-range"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={SPRINGS.smooth}
              className="overflow-hidden"
            >
              <LuxeRange
                label="Khoảng cách bung"
                min={0.5}
                max={3}
                step={0.1}
                value={explosionOffset}
                onChange={setExplosionOffset}
                display={`${explosionOffset.toFixed(1)}x`}
              />
            </motion.div>
          ) : (
            <p className="text-[11px] text-slate-500">Quan sát cấu trúc bên trong từng tầng.</p>
          )}
        </AnimatePresence>
      </BentoCard>

      <BentoCard title="Góc Nhìn Studio Presets" eyebrow="02 · Camera" icon={Camera} className="col-span-2">
        <div className="grid grid-cols-2 gap-2">
          {CAMERA_PRESETS.map((preset, index) => (
            <OptionTile
              key={preset.id}
              group="camera"
              label={preset.label}
              hint={preset.id}
              selected={cameraPreset === preset.id}
              onSelect={() => setCameraPreset(preset.id)}
              className={index === 0 ? 'col-span-2' : ''}
            />
          ))}
        </div>
      </BentoCard>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Panel chính                                                                */
/* -------------------------------------------------------------------------- */
export const StudioControls: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<StudioTab>('hardware');

  return (
    <motion.aside
      aria-label="Bảng điều khiển Studio"
      initial={{ opacity: 0, x: 40, filter: 'blur(12px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={{ ...SPRINGS.smooth, delay: 0.35 }}
      className="fixed inset-x-3 bottom-3 z-30 flex max-h-[46vh] flex-col lg:inset-x-auto lg:bottom-auto lg:right-6 lg:top-[88px] lg:max-h-[calc(100dvh-112px)] lg:w-[360px]"
    >
      <div className="glass-liquid flex min-h-0 flex-col overflow-hidden rounded-[28px]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-b from-cyan-300/20 to-indigo-500/10 text-cyan-200 ring-1 ring-inset ring-white/15 shadow-[0_0_24px_-6px_rgba(0,240,255,0.6)]">
              <Sliders className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="font-display text-[15px] font-semibold tracking-tight text-white">Studio Architect</h3>
              <p className="text-[11px] text-[#94a3b8]">Cấu hình 3D theo thời gian thực</p>
            </div>
          </div>

          <motion.button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Thu gọn bảng điều khiển' : 'Mở bảng điều khiển'}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            transition={SPRINGS.snappy}
            className="glass-button grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:text-white"
          >
            <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={SPRINGS.smooth} className="grid place-items-center">
              <ChevronDown className="h-4 w-4" aria-hidden />
            </motion.span>
          </motion.button>
        </div>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="studio-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={SPRINGS.smooth}
              className="flex min-h-0 flex-col overflow-hidden"
            >
              {/* Tabs — viên sáng trượt bằng shared layout animation */}
              <LayoutGroup id="studio-tabs">
                <div role="tablist" aria-label="Danh mục cấu hình" className="mx-3 grid grid-cols-3 gap-1 rounded-2xl bg-black/35 p-1 ring-1 ring-inset ring-white/[0.06]">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11.5px] font-medium transition-colors ${
                          isActive ? 'text-white' : 'text-slate-400 hover:text-zinc-200'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="studio-tab-pill"
                            transition={SPRINGS.smooth}
                            className="absolute inset-0 rounded-xl bg-white/[0.08] ring-1 ring-inset ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                          />
                        )}
                        <Icon className="relative h-3.5 w-3.5" aria-hidden />
                        <span className="relative">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>

              {/* Nội dung bento (mount lại theo tab để chạy stagger reveal) */}
              <div role="tabpanel" className="scroll-luxe mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                <LayoutGroup id={`studio-${activeTab}`}>
                  <motion.div
                    key={activeTab}
                    initial="hidden"
                    animate="visible"
                    variants={createStaggerContainer(0.05, 0.02)}
                    className="grid grid-cols-2 gap-2.5"
                  >
                    {activeTab === 'hardware' && <HardwareTab />}
                    {activeTab === 'aesthetic' && <AestheticTab />}
                    {activeTab === 'camera' && <CameraTab />}
                  </motion.div>
                </LayoutGroup>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
};
