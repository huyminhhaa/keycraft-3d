'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sliders,
  Palette,
  Camera,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import {
  KeyboardLayout,
  PlateMaterial,
  CaseMaterial,
  SwitchType,
  CameraPreset,
} from '@/types/keyboard';

export const StudioControls: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'hardware' | 'aesthetic' | 'camera'>('hardware');

  // Zustand state & actions
  const layout = useKeyboardStore((s) => s.layout);
  const setLayout = useKeyboardStore((s) => s.setLayout);
  const plateMaterial = useKeyboardStore((s) => s.plateMaterial);
  const setPlateMaterial = useKeyboardStore((s) => s.setPlateMaterial);
  const caseMaterial = useKeyboardStore((s) => s.caseMaterial);
  const setCaseMaterial = useKeyboardStore((s) => s.setCaseMaterial);
  const switchType = useKeyboardStore((s) => s.switchType);
  const setSwitchType = useKeyboardStore((s) => s.setSwitchType);

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

  const cameraPreset = useKeyboardStore((s) => s.cameraPreset);
  const setCameraPreset = useKeyboardStore((s) => s.setCameraPreset);
  const isExploded = useKeyboardStore((s) => s.isExploded);
  const toggleExploded = useKeyboardStore((s) => s.toggleExploded);
  const explosionOffset = useKeyboardStore((s) => s.explosionOffset);
  const setExplosionOffset = useKeyboardStore((s) => s.setExplosionOffset);

  const layouts: KeyboardLayout[] = ['65%', '75%', 'TKL'];
  const plates: { id: PlateMaterial; name: string; sound: string }[] = [
    { id: 'aluminum', name: 'Nhôm (Alu)', sound: 'Đanh (Clack)' },
    { id: 'polycarbonate', name: 'PC', sound: 'Trầm (Thock)' },
    { id: 'pom', name: 'POM', sound: 'Sâu (Deep Thock)' },
    { id: 'fr4', name: 'FR4', sound: 'Cân Bằng' },
  ];

  const caseMaterials: { id: CaseMaterial; name: string }[] = [
    { id: 'aluminum', name: 'Nhôm CNC' },
    { id: 'polycarbonate', name: 'PC Mờ' },
    { id: 'acrylic', name: 'Acrylic' },
    { id: 'wood', name: 'Gỗ Tự Nhiên' },
  ];

  const switches: { id: SwitchType; name: string; tag: string }[] = [
    { id: 'linear', name: 'Linear', tag: 'Mượt mà' },
    { id: 'tactile', name: 'Tactile', tag: 'Có khấc' },
    { id: 'clicky', name: 'Clicky', tag: 'Tiếng đanh' },
    { id: 'silent_linear', name: 'Silent', tag: 'Êm tĩnh' },
  ];

  const caseColors = [
    { label: 'Slate', hex: '#0f172a' },
    { label: 'Midnight', hex: '#020617' },
    { label: 'Silver', hex: '#475569' },
    { label: 'Crimson', hex: '#881337' },
    { label: 'Emerald', hex: '#064e3b' },
    { label: 'Cyber', hex: '#083344' },
  ];

  const underglowPresets = ['#00f0ff', '#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b'];

  const cameraPresets: { id: CameraPreset; label: string }[] = [
    { id: 'perspective', label: 'Góc Phối Cảnh' },
    { id: 'top', label: 'Nhìn Thẳng Trên' },
    { id: 'front', label: 'Mặt Trước' },
    { id: 'side', label: 'Góc Cạnh Bên' },
    { id: 'isometric', label: 'Isometric 3D' },
  ];

  return (
    <motion.aside
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed right-4 sm:right-6 top-20 bottom-6 z-30 w-80 sm:w-96 flex flex-col pointer-events-none"
    >
      <div className="w-full h-full flex flex-col rounded-3xl glass-panel border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.7)] overflow-hidden pointer-events-auto">
        {/* Panel Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 tracking-tight">Studio Architect</h3>
              <p className="text-[11px] text-zinc-400 font-mono">Realtime 3D Configurator</p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg glass-button text-zinc-400 hover:text-white"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {isOpen && (
          <>
            {/* Category Navigation Tabs */}
            <div className="grid grid-cols-3 p-2 bg-black/30 border-b border-white/5 gap-1">
              {[
                { id: 'hardware', label: 'Phần Cứng', icon: Layers },
                { id: 'aesthetic', label: 'Màu & RGB', icon: Palette },
                { id: 'camera', label: 'Góc Nhìn', icon: Camera },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs text-zinc-300">
              {/* TAB 1: HARDWARE CONFIG */}
              {activeTab === 'hardware' && (
                <div className="space-y-5">
                  {/* Bố cục bàn phím (Layout) */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      Kích Thước Bố Cục (Layout)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {layouts.map((l) => (
                        <button
                          key={l}
                          onClick={() => setLayout(l)}
                          className={`py-2 px-3 rounded-xl font-mono text-center transition-all ${
                            layout === l
                              ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                              : 'glass-panel-subtle hover:bg-white/10 text-zinc-300'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chất liệu Switch Plate */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      Chất Liệu Switch Plate
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {plates.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPlateMaterial(p.id)}
                          className={`p-2.5 rounded-xl text-left transition-all ${
                            plateMaterial === p.id
                              ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200'
                              : 'glass-panel-subtle hover:bg-white/10 text-zinc-300'
                          }`}
                        >
                          <div className="font-semibold text-zinc-100">{p.name}</div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{p.sound}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Loại Switch */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      Hệ Thống Switch
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {switches.map((sw) => (
                        <button
                          key={sw.id}
                          onClick={() => setSwitchType(sw.id)}
                          className={`p-2.5 rounded-xl text-left transition-all ${
                            switchType === sw.id
                              ? 'bg-indigo-500/20 border border-indigo-400/50 text-indigo-200'
                              : 'glass-panel-subtle hover:bg-white/10 text-zinc-300'
                          }`}
                        >
                          <div className="font-semibold text-zinc-100">{sw.name}</div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{sw.tag}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chất liệu Case */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      Chất Liệu Case
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {caseMaterials.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setCaseMaterial(c.id)}
                          className={`p-2.5 rounded-xl text-left transition-all ${
                            caseMaterial === c.id
                              ? 'bg-purple-500/20 border border-purple-400/50 text-purple-200'
                              : 'glass-panel-subtle hover:bg-white/10 text-zinc-300'
                          }`}
                        >
                          <div className="font-semibold text-zinc-100">{c.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AESTHETICS & RGB */}
              {activeTab === 'aesthetic' && (
                <div className="space-y-5">
                  {/* Màu sắc Vỏ Case */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      Màu Sắc Case
                    </label>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {caseColors.map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => setCaseColor(c.hex)}
                          title={c.label}
                          className={`w-7 h-7 rounded-full border-2 transition-transform ${
                            caseColor === c.hex ? 'border-cyan-400 scale-110 shadow-lg' : 'border-white/20'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Màu Keycaps chính */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      Màu Phím Chính (Keycaps)
                    </label>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {['#1e293b', '#0f172a', '#e2e8f0', '#334155', '#1c1917'].map((hex) => (
                        <button
                          key={hex}
                          onClick={() => setKeycapColor(hex)}
                          className={`w-7 h-7 rounded-full border-2 transition-transform ${
                            keycapColor === hex ? 'border-cyan-400 scale-110 shadow-lg' : 'border-white/20'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Màu Phím Điểm Nhấn (Accent) */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      Phím Điểm Nhấn (Esc, Spacebar, Enter)
                    </label>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {['#3b82f6', '#00f0ff', '#ec4899', '#f59e0b', '#10b981', '#dc2626'].map((hex) => (
                        <button
                          key={hex}
                          onClick={() => setKeycapAccentColor(hex)}
                          className={`w-7 h-7 rounded-full border-2 transition-transform ${
                            keycapAccentColor === hex ? 'border-cyan-400 scale-110 shadow-lg' : 'border-white/20'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Điều khiển Đèn Gầm RGB Underglow */}
                  <div className="p-3.5 rounded-2xl glass-panel-subtle border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200">Đèn Gầm RGB Underglow</span>
                      <button
                        onClick={() => setUnderglowEnabled(!underglowEnabled)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${
                          underglowEnabled ? 'bg-cyan-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                            underglowEnabled ? 'left-5' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>

                    {underglowEnabled && (
                      <>
                        <div>
                          <p className="text-[10px] font-mono text-zinc-400 mb-1.5">Màu Sắc Ánh Sáng</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {underglowPresets.map((hex) => (
                              <button
                                key={hex}
                                onClick={() => setUnderglowColor(hex)}
                                className={`w-6 h-6 rounded-full border-2 ${
                                  underglowColor === hex ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                            <span>Độ Sáng (Bloom Glow)</span>
                            <span>{Math.round(underglowBrightness * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={underglowBrightness}
                            onChange={(e) => setUnderglowBrightness(parseFloat(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CAMERA & EXPLODED VIEW */}
              {activeTab === 'camera' && (
                <div className="space-y-5">
                  {/* Chế độ tách lớp (Exploded View) */}
                  <div className="p-3.5 rounded-2xl glass-panel-subtle border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-zinc-100">Bung Lớp 7 Phần Cứng</p>
                        <p className="text-[10px] text-zinc-400 font-mono">Quan sát cấu trúc bên trong</p>
                      </div>
                      <button
                        onClick={toggleExploded}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                          isExploded
                            ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                            : 'glass-button text-zinc-300'
                        }`}
                      >
                        {isExploded ? 'Đang Bung' : 'Gộp Lại'}
                      </button>
                    </div>

                    {isExploded && (
                      <div>
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                          <span>Khoảng Cách Bung</span>
                          <span>{explosionOffset.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="3.0"
                          step="0.1"
                          value={explosionOffset}
                          onChange={(e) => setExplosionOffset(parseFloat(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Góc nhìn Camera */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      Góc Nhìn Studio Presets
                    </label>
                    <div className="space-y-1.5">
                      {cameraPresets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => setCameraPreset(preset.id)}
                          className={`w-full py-2.5 px-3 rounded-xl text-left flex items-center justify-between transition-all ${
                            cameraPreset === preset.id
                              ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                              : 'glass-panel-subtle hover:bg-white/10 text-zinc-300'
                          }`}
                        >
                          <span>{preset.label}</span>
                          <span className="text-[10px] font-mono text-zinc-400 capitalize">{preset.id}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.aside>
  );
};
