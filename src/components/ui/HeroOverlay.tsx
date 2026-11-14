'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { SPRINGS, createStaggerContainer, fadeRise } from '@/lib/ui/motion';
import { KineticHeadline } from './KineticHeadline';

/**
 * Khối hero góc trên trái — gọn để không lấn vào mô hình (CameraFraming hạ mô hình xuống bên dưới).
 * Không nhận sự kiện chuột (pointer-events-none) để không cản OrbitControls, và tự mờ đi khi
 * bung lớp để nhường chỗ cho nhãn chú thích 3D.
 */
export const HeroOverlay: React.FC = () => {
  const isExploded = useKeyboardStore((s) => s.isExploded);

  return (
    <motion.section
      aria-label="Giới thiệu KeyCraft 3D"
      className="pointer-events-none fixed left-6 top-[96px] z-20 hidden max-w-[360px] select-none lg:block xl:left-10 xl:max-w-[480px]"
      animate={{ opacity: isExploded ? 0.2 : 1, x: isExploded ? -8 : 0 }}
      transition={SPRINGS.gentle}
    >
      <motion.div initial="hidden" animate="visible" variants={createStaggerContainer(0.09, 0.05)}>
        <motion.div
          variants={fadeRise}
          className="glass-liquid inline-flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[11px]"
        >
          <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-300 ring-1 ring-inset ring-cyan-300/30">
            Lab
          </span>
          <span className="font-medium tracking-tight text-zinc-200">Precision Acoustic Studio</span>
        </motion.div>
      </motion.div>

      <KineticHeadline
        lines={[{ text: 'Điêu khắc âm thanh' }, { text: 'từng phím gõ.', accent: true }]}
        delay={0.25}
        className="mt-4 font-display text-[36px] font-semibold leading-[1.02] tracking-[-0.035em] text-white xl:text-[48px]"
      />

      {/* Transition trong variant ưu tiên hơn prop, nên trễ phụ đề bằng container stagger */}
      <motion.div initial="hidden" animate="visible" variants={createStaggerContainer(0, 0.8)}>
        <motion.p variants={fadeRise} className="mt-4 max-w-[38ch] text-[14px] leading-relaxed text-[#94a3b8]">
          Xoay, tách lớp và tinh chỉnh từng tầng phần cứng. Hồ sơ âm học đổi ngay khi bạn đổi plate hay switch.
        </motion.p>
      </motion.div>
    </motion.section>
  );
};
