'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { RotateCcw, User, LogOut, Share2 } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { useStageStore, SidebarTab } from '@/store/useStageStore';
import { useAuthStore } from '@/store/useAuthStore';
import { BuildsPanel } from './BuildsPanel';
import { DesignPanel } from './DesignPanel';
import { SoundPanel } from './SoundPanel';
import { AIChatPanel } from './AIChatPanel';
import { SaveBuildModal } from './SaveBuildModal';

const TABS: { id: SidebarTab; label: string }[] = [
  { id: 'builds', label: 'Mẫu phím' },
  { id: 'design', label: 'Thiết kế' },
  { id: 'sound', label: 'Âm thanh' },
  { id: 'ai', label: 'Trợ lý AI' },
];

/** Logo: một keycap nhìn từ trên xuống. */
const BrandMark: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
    <rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <rect x="5.5" y="4.5" width="11" height="10" rx="2.5" fill="currentColor" />
  </svg>
);

export const Sidebar: React.FC = () => {
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const tab = useStageStore((s) => s.activeTab);
  const setTab = useStageStore((s) => s.setActiveTab);
  const resetConfig = useKeyboardStore((s) => s.resetConfig);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openModal = useAuthStore((s) => s.openModal);
  const logout = useAuthStore((s) => s.logout);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <aside id="config-sidebar" aria-label="Cấu hình bàn phím" className="flex min-h-0 flex-col border-line bg-canvas lg:h-dvh lg:border-r">
      <header className="px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            title="Về trang chủ KeyCraft"
            className="flex items-center gap-2 text-ink hover:opacity-80 transition-opacity"
          >
            <BrandMark />
            <span className="text-[14px] font-semibold tracking-tight">KeyCraft</span>
          </Link>

          {/* Auth status trigger */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <div
                title={user.email}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-1.5 pr-2.5 text-xs text-ink/90"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[100px] truncate text-[11px] font-medium">{user.name}</span>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                title="Đăng xuất"
                aria-label="Đăng xuất"
                className="rounded-full border border-white/5 p-1.5 text-muted hover:border-white/10 hover:bg-white/5 hover:text-ink transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openModal('login')}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-ink/90 shadow-sm transition-all hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
            >
              <User className="h-3 w-3" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
        <h1 className="mt-5 text-[20px] font-semibold leading-tight tracking-tight text-ink">
          Bàn phím cơ 3D tự cấu hình
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Chọn bố cục, vỏ, keycap và switch. Gõ trên bàn phím của bạn để thấy từng phím nhấn xuống.
        </p>
      </header>

      <div role="tablist" aria-label="Nhóm tuỳ chọn" className="flex border-b border-line px-5">
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={active}
              aria-controls={`panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`relative mr-6 min-h-11 text-[13px] font-medium transition-colors ${
                active ? 'text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {item.label}
              {active && (
                <motion.span
                  layoutId="sidebar-tab-indicator"
                  transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-ink"
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="scroll-thin min-h-0 flex-1 lg:overflow-y-auto"
      >
        <div key={tab} className="panel-fade h-full">
          {tab === 'builds' && <BuildsPanel />}
          {tab === 'design' && <DesignPanel />}
          {tab === 'sound' && <SoundPanel />}
          {tab === 'ai' && <AIChatPanel />}
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-line px-5 py-3">
        <button
          type="button"
          onClick={resetConfig}
          className="btn-press inline-flex min-h-11 items-center gap-2 rounded-md text-[13px] text-muted hover:text-ink lg:min-h-9"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Đặt lại cấu hình
        </button>

        <button
          type="button"
          onClick={() => setIsSaveModalOpen(true)}
          className="btn-press inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[12px] font-medium text-cyan-400 hover:bg-cyan-500/20 transition-all lg:min-h-9"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Lưu & Chia sẻ</span>
        </button>
      </footer>

      <SaveBuildModal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} />
    </aside>
  );
};
