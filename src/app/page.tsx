'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { StudioNavbar } from '@/components/ui/StudioNavbar';
import { StudioControls } from '@/components/ui/StudioControls';
import { AcousticBadge } from '@/components/ui/AcousticBadge';
import { MousePointer, Eye, Volume2 } from 'lucide-react';

// Dynamic import Canvas 3D với SSR = false để tránh lỗi Hydration trong Next.js App Router
const KeyboardScene = dynamic(
  () => import('@/components/canvas/KeyboardScene'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#09090b]">
        <div className="w-10 h-10 rounded-full border-2 border-t-cyan-400 border-r-indigo-500 border-b-transparent border-l-transparent animate-spin mb-3" />
        <p className="text-xs font-mono uppercase tracking-widest text-zinc-400">
          Loading 3D Studio Engine...
        </p>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#09090b]">
      {/* ------------------------------------------------------------------ */}
      {/* Ambient Lighting & Mesh Gradients (Phong cách MotionSites.ai)      */}
      {/* ------------------------------------------------------------------ */}
      <div className="absolute inset-0 bg-noise opacity-40 pointer-events-none z-0" />
      <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute top-1/3 -right-20 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="absolute -bottom-20 left-1/3 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* ------------------------------------------------------------------ */}
      {/* Floating Glassmorphism Navbar                                      */}
      {/* ------------------------------------------------------------------ */}
      <StudioNavbar />

      {/* ------------------------------------------------------------------ */}
      {/* Hero Headline Overlay (Góc trên trái tinh tế)                     */}
      {/* ------------------------------------------------------------------ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-24 left-6 sm:left-10 z-20 pointer-events-none max-w-sm hidden sm:block"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel-subtle border border-white/5 text-[11px] font-mono text-cyan-400 mb-3">
          <span>PRECISION ACOUSTIC LAB</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
          Next-Gen <br />
          <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Mechanical Studio
          </span>
        </h1>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
          Tương tác 3D đa góc độ, mô phỏng phản xạ âm thanh realtime và kiến tạo bản phím cơ độc bản.
        </p>
      </motion.div>

      {/* ------------------------------------------------------------------ */}
      {/* Không Gian 3D Chính (Full-screen Canvas)                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="absolute inset-0 z-10 w-full h-full">
        <KeyboardScene />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* UI Lớp nổi: Telemetry âm học & Bảng điều khiển Studio              */}
      {/* ------------------------------------------------------------------ */}
      <AcousticBadge />
      <StudioControls />

      {/* ------------------------------------------------------------------ */}
      {/* Hướng dẫn tương tác chuột dưới đáy màn hình                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none hidden md:flex items-center gap-4 px-4 py-2 rounded-full glass-panel-subtle border border-white/5 text-[11px] text-zinc-400 font-mono">
        <span className="flex items-center gap-1.5">
          <MousePointer className="w-3 h-3 text-cyan-400" /> Chuột trái: Xoay
        </span>
        <span className="w-1 h-1 rounded-full bg-zinc-600" />
        <span className="flex items-center gap-1.5">
          <Eye className="w-3 h-3 text-indigo-400" /> Cuộn: Phóng to / Thu nhỏ
        </span>
        <span className="w-1 h-1 rounded-full bg-zinc-600" />
        <span className="flex items-center gap-1.5">
          <Volume2 className="w-3 h-3 text-purple-400" /> Đổi plate để nghe âm khác
        </span>
      </div>
    </main>
  );
}
