'use client';

import React from 'react';
import { Html, useProgress } from '@react-three/drei';

export const CanvasLoader: React.FC = () => {
  const { progress } = useProgress();
  const percent = Math.round(progress);

  return (
    <Html center>
      <div className="glass-liquid flex min-w-[240px] select-none flex-col items-center rounded-3xl px-6 py-5 text-center">
        <div className="relative mb-4 h-12 w-12">
          <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-indigo-400 border-t-cyan-300" />
          <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-purple-400 border-l-cyan-300 [animation-direction:reverse] [animation-duration:1.6s]" />
        </div>
        <p className="font-display text-[13px] font-semibold tracking-tight text-white">KeyCraft 3D Studio</p>
        <p className="mt-0.5 font-mono text-[10.5px] text-[#94a3b8]">
          {percent > 0 ? `${percent}% đã nạp` : 'Đang hiệu chỉnh shader…'}
        </p>
        <div className="mt-3 h-[3px] w-36 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400 transition-[width] duration-300"
            style={{ width: `${Math.max(8, percent)}%` }}
          />
        </div>
      </div>
    </Html>
  );
};
