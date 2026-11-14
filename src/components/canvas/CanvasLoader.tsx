'use client';

import React from 'react';
import { Html, useProgress } from '@react-three/drei';

export const CanvasLoader: React.FC = () => {
  const { progress } = useProgress();

  return (
    <Html center>
      <div className="flex flex-col items-center justify-center min-w-[240px] px-6 py-5 rounded-2xl glass-panel text-center select-none shadow-2xl border border-white/10">
        <div className="relative w-12 h-12 mb-3">
          {/* Vòng xoay neon phát sáng */}
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
          <div className="absolute inset-0 rounded-full border-2 border-t-cyan-400 border-r-indigo-500 border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-b-purple-400 border-l-cyan-400 border-t-transparent border-r-transparent animate-spin [animation-duration:1.5s]" />
        </div>
        <p className="text-xs font-semibold tracking-wider uppercase text-zinc-300">
          KeyCraft 3D Studio
        </p>
        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
          {progress > 0 ? `${progress.toFixed(0)}% Loaded` : 'Calibrating Shaders...'}
        </p>
      </div>
    </Html>
  );
};
