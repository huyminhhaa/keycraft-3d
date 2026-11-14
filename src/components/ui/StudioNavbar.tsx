'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Layers, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';

export const StudioNavbar: React.FC = () => {
  const isExploded = useKeyboardStore((s) => s.isExploded);
  const toggleExploded = useKeyboardStore((s) => s.toggleExploded);
  const resetConfig = useKeyboardStore((s) => s.resetConfig);
  const soundProfile = useKeyboardStore((s) => s.soundProfile);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-4 sm:px-8 pt-4 pb-2 pointer-events-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">
        {/* Brand Logo & Live Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel border border-white/10 shadow-lg">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.5)]">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold tracking-tight text-sm text-zinc-100">
              KeyCraft <span className="text-cyan-400 font-mono">3D</span>
            </span>
          </div>

          {/* Pill Badge phong cách MotionSites.ai */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full glass-panel-subtle border border-white/5 text-[11px] text-zinc-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span>Studio v1.3 • Live Interactive</span>
          </div>
        </div>

        {/* Quick Actions Toolbar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Huy hiệu âm học thu gọn */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel-subtle border border-white/5 text-xs text-zinc-300">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-[11px] text-cyan-300">
              {soundProfile.label}
            </span>
          </div>

          {/* Nút bật/tắt Tách lớp (Exploded View) */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={toggleExploded}
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
              isExploded
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                : 'glass-button text-zinc-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isExploded ? 'Gộp Lại' : 'Tách Lớp 7 Phím'}</span>
          </motion.button>

          {/* Nút Reset bản dựng */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetConfig}
            title="Khôi phục cấu hình mặc định"
            className="p-2 rounded-xl glass-button text-zinc-400 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
    </header>
  );
};
