'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers, RotateCcw, Volume2 } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { SPRINGS } from '@/lib/ui/motion';

/** Logo dạng keycap: khối vuông bo góc với ánh sáng đỉnh và chữ K. */
const KeycapMark: React.FC = () => (
  <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-b from-zinc-700 to-zinc-900 ring-1 ring-inset ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_16px_rgba(0,0,0,0.6)]">
    <span className="font-display text-[13px] font-bold text-white">K</span>
    <span className="absolute -bottom-px left-1/2 h-px w-5 -translate-x-1/2 bg-cyan-300 shadow-[0_0_10px_2px_rgba(0,240,255,0.7)]" />
  </span>
);

export const StudioNavbar: React.FC = () => {
  const isExploded = useKeyboardStore((s) => s.isExploded);
  const toggleExploded = useKeyboardStore((s) => s.toggleExploded);
  const resetConfig = useKeyboardStore((s) => s.resetConfig);
  const soundLabel = useKeyboardStore((s) => s.soundProfile.label);

  return (
    <motion.header
      initial={{ opacity: 0, y: -18, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={SPRINGS.smooth}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-5"
    >
      <nav aria-label="Studio" className="flex items-center justify-between gap-3">
        {/* Thương hiệu + trạng thái */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="glass-liquid flex items-center gap-2.5 rounded-full py-1 pl-1 pr-4">
            <KeycapMark />
            <span className="font-display text-[15px] font-semibold tracking-tight text-white">
              KeyCraft <span className="font-mono text-[12px] font-medium text-slate-400">3D</span>
            </span>
          </div>

          <div className="glass-liquid hidden items-center gap-2 rounded-full px-3 py-1.5 text-[11px] text-[#94a3b8] sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
            </span>
            <span>Studio v2.0 · Live</span>
          </div>
        </div>

        {/* Thanh hành động */}
        <div className="glass-liquid pointer-events-auto flex items-center gap-1 rounded-full p-1">
          <div className="hidden items-center gap-1.5 overflow-hidden px-3 text-[11px] md:flex">
            <Volume2 className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={soundLabel}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={SPRINGS.snappy}
                className="whitespace-nowrap font-mono text-zinc-300"
              >
                {soundLabel}
              </motion.span>
            </AnimatePresence>
          </div>

          <span aria-hidden className="mx-0.5 hidden h-5 w-px bg-white/10 md:block" />

          <motion.button
            type="button"
            aria-pressed={isExploded}
            aria-label={isExploded ? 'Gộp Lại' : 'Tách Lớp 7 Phím'}
            onClick={toggleExploded}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRINGS.snappy}
            className={`relative isolate flex items-center gap-2 overflow-hidden rounded-full px-3.5 py-2 text-[12px] font-medium transition-colors sm:px-4 ${
              isExploded ? 'text-slate-950' : 'text-zinc-200 hover:text-white'
            }`}
          >
            <motion.span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-cyan-300 via-cyan-400 to-indigo-400 shadow-[0_0_28px_rgba(0,240,255,0.5)]"
              initial={false}
              animate={{ opacity: isExploded ? 1 : 0, scale: isExploded ? 1 : 0.85 }}
              transition={SPRINGS.smooth}
            />
            {!isExploded && <span aria-hidden className="absolute inset-0 -z-10 rounded-full bg-white/[0.05] ring-1 ring-inset ring-white/10" />}
            <motion.span animate={{ rotate: isExploded ? 180 : 0 }} transition={SPRINGS.smooth} className="grid place-items-center">
              <Layers className="h-3.5 w-3.5" aria-hidden />
            </motion.span>
            <span aria-hidden className="hidden sm:inline">
              {isExploded ? 'Gộp Lại' : 'Tách Lớp 7 Phím'}
            </span>
          </motion.button>

          <motion.button
            type="button"
            onClick={resetConfig}
            aria-label="Khôi phục cấu hình mặc định"
            title="Khôi phục cấu hình mặc định"
            whileHover={{ rotate: -90 }}
            whileTap={{ scale: 0.9 }}
            transition={SPRINGS.snappy}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </motion.button>
        </div>
      </nav>
    </motion.header>
  );
};
