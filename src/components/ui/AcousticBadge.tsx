'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';

export const AcousticBadge: React.FC = () => {
  const soundProfile = useKeyboardStore((s) => s.soundProfile);
  const plateMaterial = useKeyboardStore((s) => s.plateMaterial);
  const switchType = useKeyboardStore((s) => s.switchType);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-6 left-6 z-30 hidden lg:block pointer-events-auto"
    >
      <div className="w-72 p-4 rounded-2xl glass-panel border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        {/* Header với Icon sóng âm phát quang */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">
                Acoustic Telemetry
              </p>
              <h4 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                {soundProfile.label}
              </h4>
            </div>
          </div>

          {/* Equalizer Waveform động phong cách MotionSites */}
          <div className="flex items-end gap-1 h-5 px-1.5 py-1 rounded bg-black/40 border border-white/5">
            {[0.4, 0.8, 0.5, 0.9, 0.6].map((height, idx) => (
              <motion.div
                key={idx}
                animate={{
                  height: ['20%', `${height * 100}%`, '30%'],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.8 + idx * 0.15,
                  ease: 'easeInOut',
                }}
                className="w-1 bg-gradient-to-t from-cyan-500 to-indigo-400 rounded-full"
              />
            ))}
          </div>
        </div>

        {/* Thông số kỹ thuật âm học */}
        <div className="grid grid-cols-3 gap-2 pt-3 text-center">
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[9px] uppercase font-mono text-zinc-400">Pitch</p>
            <p className="text-xs font-bold font-mono text-cyan-300">
              {soundProfile.pitchMultiplier}x
            </p>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[9px] uppercase font-mono text-zinc-400">Resonance</p>
            <p className="text-xs font-bold font-mono text-indigo-300">
              {soundProfile.resonance}
            </p>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[9px] uppercase font-mono text-zinc-400">Damping</p>
            <p className="text-xs font-bold font-mono text-purple-300">
              {soundProfile.damping}
            </p>
          </div>
        </div>

        {/* Footer chi tiết cấu hình phần cứng */}
        <div className="mt-3 pt-2 flex items-center justify-between text-[10px] text-zinc-400 font-mono border-t border-white/5">
          <span>Plate: <span className="text-zinc-200 capitalize">{plateMaterial}</span></span>
          <span>Switch: <span className="text-zinc-200 capitalize">{switchType.replace('_', ' ')}</span></span>
        </div>
      </div>
    </motion.div>
  );
};
