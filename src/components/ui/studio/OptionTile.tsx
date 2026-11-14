'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { SPRINGS } from '@/lib/ui/motion';

export type Tone = 'cyan' | 'indigo' | 'purple';

const TONE_ACTIVE: Record<Tone, string> = {
  cyan: 'bg-cyan-400/[0.12] ring-cyan-300/40 shadow-[0_0_28px_-8px_rgba(0,240,255,0.65)]',
  indigo: 'bg-indigo-400/[0.14] ring-indigo-300/40 shadow-[0_0_28px_-8px_rgba(99,102,241,0.7)]',
  purple: 'bg-purple-400/[0.13] ring-purple-300/40 shadow-[0_0_28px_-8px_rgba(168,85,247,0.7)]',
};

const TONE_DOT: Record<Tone, string> = {
  cyan: 'bg-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.9)]',
  indigo: 'bg-indigo-300 shadow-[0_0_8px_rgba(129,140,248,0.9)]',
  purple: 'bg-purple-300 shadow-[0_0_8px_rgba(192,132,252,0.9)]',
};

interface OptionTileProps {
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
  /** Tên nhóm: viên sáng "active" trượt bằng shared layout animation trong cùng nhóm */
  group: string;
  tone?: Tone;
  mono?: boolean;
  className?: string;
}

/**
 * Ô lựa chọn: viên nền sáng của mục đang chọn dùng `layoutId` nên khi đổi lựa chọn
 * nó trượt bằng lò xo sang ô mới thay vì nhảy cụt.
 */
export const OptionTile: React.FC<OptionTileProps> = ({
  label,
  hint,
  selected,
  onSelect,
  group,
  tone = 'cyan',
  mono = false,
  className = '',
}) => (
  <motion.button
    type="button"
    aria-pressed={selected}
    onClick={onSelect}
    whileHover={{ y: -1.5 }}
    whileTap={{ scale: 0.97 }}
    transition={SPRINGS.snappy}
    className={`relative isolate flex min-w-0 items-start justify-between gap-2 overflow-hidden rounded-xl bg-white/[0.02] px-3 py-2.5 text-left ring-1 ring-inset ring-white/[0.06] transition-colors hover:bg-white/[0.05] ${className}`}
  >
    {selected && (
      <motion.span
        layoutId={`${group}-active`}
        transition={SPRINGS.smooth}
        className={`absolute inset-0 -z-10 rounded-xl ring-1 ring-inset ${TONE_ACTIVE[tone]}`}
      />
    )}
    <span className="min-w-0">
      <span
        className={`block truncate text-[12.5px] font-medium tracking-tight ${mono ? 'font-mono' : ''} ${
          selected ? 'text-white' : 'text-zinc-300'
        }`}
      >
        {label}
      </span>
      {hint && <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">{hint}</span>}
    </span>
    <span
      aria-hidden
      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full transition-opacity ${TONE_DOT[tone]} ${
        selected ? 'opacity-100' : 'opacity-0'
      }`}
    />
  </motion.button>
);
