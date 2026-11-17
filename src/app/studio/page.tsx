'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSoundStore } from '@/store/useSoundStore';
import { Sidebar } from '@/components/ui/Sidebar';
import { StageOverlay } from '@/components/ui/StageOverlay';
import { AuthModal } from '@/components/ui/AuthModal';
import { useStageStore } from '@/store/useStageStore';

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

export default function StudioPage() {
  const sidebarOpen = useStageStore((s) => s.sidebarOpen);

  // Tải sẵn gói tiếng gõ thật để lần gõ đầu tiên đã có tiếng
  useEffect(() => {
    void useSoundStore.getState().loadIndex();
  }, []);

  return (
    <main
      className={`flex h-dvh flex-col bg-canvas lg:grid ${
        sidebarOpen ? 'lg:grid-cols-[360px_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)]'
      }`}
    >
      {/* Sân khấu: trên cùng ở mobile, bên phải ở desktop */}
      <section aria-label="Mô hình bàn phím 3D" className="stage relative h-[46svh] shrink-0 lg:order-2 lg:h-dvh">
        <KeyboardScene />
        <StageOverlay />
      </section>

      {/* Thu gọn chỉ áp dụng desktop; trên mobile thanh cấu hình luôn nằm dưới sân khấu */}
      <div className={`min-h-0 flex-1 overflow-y-auto lg:order-1 lg:overflow-visible ${sidebarOpen ? '' : 'lg:hidden'}`}>
        <Sidebar />
      </div>

      <AuthModal />
    </main>
  );
}
