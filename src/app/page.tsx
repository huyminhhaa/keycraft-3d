'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { MotionConfig, motion } from 'framer-motion';
import { Mouse, Move3d, MousePointer2 } from 'lucide-react';
import { AmbientBackdrop } from '@/components/ui/AmbientBackdrop';
import { HeroOverlay } from '@/components/ui/HeroOverlay';
import { StudioNavbar } from '@/components/ui/StudioNavbar';
import { StudioControls } from '@/components/ui/StudioControls';
import { AcousticBadge } from '@/components/ui/AcousticBadge';
import { EASE_OUT_EXPO } from '@/lib/ui/motion';

/** Fallback khi bundle 3D còn đang tải (trước cả Suspense trong Canvas). */
const SceneFallback: React.FC = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="glass-liquid flex items-center gap-3 rounded-full py-2 pl-2 pr-4">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-transparent border-r-indigo-400 border-t-cyan-300" />
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#94a3b8]">Đang khởi động 3D Studio</span>
    </div>
  </div>
);

// Dynamic import Canvas 3D với SSR = false để tránh lỗi Hydration trong Next.js App Router
const KeyboardScene = dynamic(() => import('@/components/canvas/KeyboardScene'), {
  ssr: false,
  loading: () => <SceneFallback />,
});

const HINTS = [
  { icon: MousePointer2, text: 'Kéo để xoay' },
  { icon: Mouse, text: 'Cuộn để phóng to' },
  { icon: Move3d, text: 'Chuột phải để dời khung' },
];

export default function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <main className="relative h-dvh w-screen overflow-hidden bg-background">
        <AmbientBackdrop />

        {/*
          Canvas 3D toàn màn hình là tâm điểm. Việc canh mô hình vào vùng trống
          (tránh panel phải / bottom sheet) do CameraFraming xử lý bằng lens shift.
        */}
        <div className="absolute inset-0 z-10">
          <KeyboardScene />
        </div>

        <StudioNavbar />
        <HeroOverlay />
        <AcousticBadge />
        <StudioControls />

        {/* Gợi ý thao tác: nằm ngay bên phải thẻ Acoustic Telemetry, không chồng lên nó */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2, ease: EASE_OUT_EXPO }}
          className="pointer-events-none fixed bottom-6 left-[392px] z-20 hidden xl:block"
        >
          <div className="glass-liquid flex items-center gap-4 rounded-full px-4 py-2 text-[11px] text-[#94a3b8]">
            {HINTS.map((hint, index) => {
              const Icon = hint.icon;
              return (
                <React.Fragment key={hint.text}>
                  {index > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-white/15" />}
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Icon className="h-3.5 w-3.5 text-cyan-300/80" aria-hidden />
                    {hint.text}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </motion.div>
      </main>
    </MotionConfig>
  );
}
