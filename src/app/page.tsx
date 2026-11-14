'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/ui/Sidebar';
import { StageOverlay } from '@/components/ui/StageOverlay';

const SceneFallback: React.FC = () => (
  <div className="grid h-full w-full place-items-center">
    <p className="text-[13px] text-muted" role="status">
      Đang tải mô hình 3D
    </p>
  </div>
);

// Canvas 3D chỉ chạy phía trình duyệt (ssr: false) để tránh lỗi hydration
const KeyboardScene = dynamic(() => import('@/components/canvas/KeyboardScene'), {
  ssr: false,
  loading: () => <SceneFallback />,
});

export default function Home() {
  return (
    <main className="flex h-dvh flex-col bg-canvas lg:grid lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* Sân khấu: trên cùng ở mobile, bên phải ở desktop */}
      <section aria-label="Mô hình bàn phím 3D" className="stage relative h-[46svh] shrink-0 lg:order-2 lg:h-dvh">
        <KeyboardScene />
        <StageOverlay />
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto lg:order-1 lg:overflow-visible">
        <Sidebar />
      </div>
    </main>
  );
}
