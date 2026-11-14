'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface GlowOrbProps {
  className: string;
  color: string;
  drift: { x: number[]; y: number[] };
  duration: number;
  reduceMotion: boolean;
}

/** Một quả cầu ánh sáng nhoè cực lớn trôi chậm — lõi của ambient mesh glow. */
const GlowOrb: React.FC<GlowOrbProps> = ({ className, color, drift, duration, reduceMotion }) => (
  <motion.div
    aria-hidden
    className={`absolute rounded-full blur-3xl will-change-transform ${className}`}
    style={{ background: `radial-gradient(circle at center, ${color} 0%, transparent 68%)` }}
    animate={reduceMotion ? undefined : { x: drift.x, y: drift.y }}
    transition={{ duration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
  />
);

/**
 * Hậu cảnh điện ảnh gồm 3 tầng:
 *  - z-0  : mesh glow đa sắc (cyan, indigo, purple) phía sau Canvas 3D.
 *  - z-15 : light leak hoà trộn `screen` phủ lên Canvas để sàn studio bắt màu.
 *  - z-16/17 : vignette tối viền + film grain nhiễu hạt.
 * Toàn bộ `pointer-events-none` nên không cản thao tác xoay mô hình.
 */
export const AmbientBackdrop: React.FC = () => {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(99,102,241,0.14),transparent_70%)]" />
        <GlowOrb
          className="-left-[10vmax] -top-[18vmax] h-[60vmax] w-[60vmax] opacity-60"
          color="rgba(0, 240, 255, 0.55)"
          drift={{ x: [0, 60, -20], y: [0, 40, 10] }}
          duration={22}
          reduceMotion={reduceMotion}
        />
        <GlowOrb
          className="-right-[16vmax] top-[10vh] h-[62vmax] w-[62vmax] opacity-55"
          color="rgba(99, 102, 241, 0.6)"
          drift={{ x: [0, -50, 30], y: [0, 50, -30] }}
          duration={26}
          reduceMotion={reduceMotion}
        />
        <GlowOrb
          className="-bottom-[26vmax] left-[22vw] h-[58vmax] w-[58vmax] opacity-50"
          color="rgba(168, 85, 247, 0.55)"
          drift={{ x: [0, 40, -40], y: [0, -30, 0] }}
          duration={30}
          reduceMotion={reduceMotion}
        />
      </div>

      {/* Light leak phủ lên Canvas: sàn kim loại & mô hình bắt chút màu ambient */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[15] overflow-hidden mix-blend-screen opacity-45">
        <div className="absolute -left-[12vmax] -top-[14vmax] h-[46vmax] w-[46vmax] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.35),transparent_65%)] blur-3xl" />
        <div className="absolute -bottom-[18vmax] -right-[10vmax] h-[50vmax] w-[50vmax] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.32),transparent_65%)] blur-3xl" />
        <div className="absolute bottom-[-30vh] left-1/2 h-[60vh] w-[90vw] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.22),transparent_70%)] blur-3xl" />
      </div>

      <div aria-hidden className="vignette pointer-events-none fixed inset-0 z-[16]" />
      <div aria-hidden className="grain-overlay z-[17]" />
    </>
  );
};
