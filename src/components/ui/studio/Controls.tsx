'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { SPRINGS } from '@/lib/ui/motion';

interface GlowToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

/** Công tắc bật/tắt: núm trắng trượt bằng lò xo, rãnh phát sáng cyan khi bật. */
export const GlowToggle: React.FC<GlowToggleProps> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 ring-1 ring-inset transition-colors duration-300 ${
      checked
        ? 'justify-end bg-cyan-400/80 ring-cyan-200/50 shadow-[0_0_18px_rgba(0,240,255,0.45)]'
        : 'justify-start bg-white/[0.06] ring-white/10'
    }`}
  >
    <motion.span
      layout
      transition={SPRINGS.snappy}
      className="h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
    />
  </button>
);

interface LuxeRangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Chuỗi hiển thị giá trị bên phải nhãn */
  display: string;
}

/** Thanh trượt với track gradient tô theo phần trăm qua biến CSS `--fill`. */
export const LuxeRange: React.FC<LuxeRangeProps> = ({ label, value, min, max, step, onChange, display }) => {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[10.5px]">
        <span className="text-[#94a3b8]">{label}</span>
        <span className="font-mono tabular-nums text-zinc-200">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="range-luxe"
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
      />
    </label>
  );
};
