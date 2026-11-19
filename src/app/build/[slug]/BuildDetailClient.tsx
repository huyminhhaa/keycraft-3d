'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Eye, GitFork, Volume2, Copy, Check, Wrench, Calendar, Sparkles } from 'lucide-react';
import type { Build } from '@/db/schema';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { soundEngine } from '@/lib/audio/soundEngine';
import { BuildOwnerControls } from './BuildOwnerControls';

// Dynamic import Canvas 3D (tắt SSR)
const KeyboardScene = dynamic(
  () => import('@/components/canvas/KeyboardScene').then((mod) => mod.KeyboardScene),
  { ssr: false }
);

interface BuildDetailClientProps {
  build: Build;
  /** Người đang xem là chủ sở hữu (server tính từ JWT) -> hiện nút Sửa / Xoá */
  isOwner?: boolean;
}

export function BuildDetailClient({ build, isOwner = false }: BuildDetailClientProps) {
  const router = useRouter();
  const applyAIConfig = useKeyboardStore((s) => s.applyAIConfig);
  const [isCopied, setIsCopied] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  // Đồng bộ cấu hình bản build vào Zustand store khi mở trang
  useEffect(() => {
    if (build.config) {
      applyAIConfig(build.config);
    }
  }, [build.config, applyAIConfig]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleRemix = () => {
    if (build.config) {
      applyAIConfig(build.config);
    }
    router.push('/studio');
  };

  const playSound = (keyCode: string) => {
    setPlayingKey(keyCode);
    soundEngine.playKeySound(keyCode, {
      plateMaterial: build.config.plateMaterial,
      switchType: build.config.switchType,
    });
    setTimeout(() => setPlayingKey(null), 250);
  };

  const formattedDate = new Date(build.createdAt).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      {/* Khối Header & Telemetry */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-400">
              {build.config.layout} Layout
            </span>
            <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-medium text-zinc-300">
              Plate {build.config.plateMaterial.toUpperCase()}
            </span>
            <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-medium text-zinc-300">
              Switch {build.config.switchType}
            </span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
              {build.config.soundProfile?.label || 'Chất âm tùy chỉnh'}
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">{build.title}</h1>
          {build.description && (
            <p className="mt-2 text-sm text-zinc-400 max-w-2xl leading-relaxed">{build.description}</p>
          )}

          <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-zinc-400" />
              {build.viewCount} lượt xem
            </span>
            <span className="flex items-center gap-1.5">
              <GitFork className="h-3.5 w-3.5 text-zinc-400" />
              {build.forkCount} remix
            </span>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-zinc-200 hover:bg-white/10 transition-colors"
          >
            {isCopied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Đã sao chép liên kết</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Sao chép liên kết</span>
              </>
            )}
          </button>

          <button
            onClick={handleRemix}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-black hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
          >
            <Wrench className="h-4 w-4" />
            <span>Remix trong Studio</span>
          </button>
        </div>
      </div>

      {isOwner && (
        <BuildOwnerControls
          slug={build.slug}
          title={build.title}
          description={build.description}
          isPublic={build.isPublic}
        />
      )}

      {/* Grid: 3D Stage + Thông số âm học */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Khung 3D tương tác (Chiếm 2 cột) */}
        <div className="lg:col-span-2 relative h-[520px] rounded-2xl border border-white/10 bg-[#070809] overflow-hidden shadow-2xl">
          <KeyboardScene />

          <div className="absolute bottom-4 left-4 rounded-xl border border-white/10 bg-black/60 px-3.5 py-1.5 text-[11px] text-zinc-400 backdrop-blur-md">
            Chuột trái: Xoay 360° • Chuột phải: Di chuyển • Con lăn: Phóng to
          </div>
        </div>

        {/* Cột thông số & Nghe thử âm thanh (Chiếm 1 cột) */}
        <div className="flex flex-col gap-6">
          {/* Card nghe thử âm thanh */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Volume2 className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-white">Nghe thử âm thanh vật lý</h2>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Tổng hợp âm thanh thời gian thực (Zero-latency Web Audio API) dựa trên vật liệu Plate{' '}
              <span className="text-cyan-400 font-medium">{build.config.plateMaterial.toUpperCase()}</span> và Switch{' '}
              <span className="text-cyan-400 font-medium">{build.config.switchType}</span>.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => playSound('KeyA')}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 transition-all ${
                  playingKey === 'KeyA'
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 scale-95'
                    : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                }`}
              >
                <span className="text-sm font-bold font-mono">Phím A</span>
                <span className="text-[10px] text-zinc-400 mt-0.5">Tiếng gõ phím nhỏ</span>
              </button>

              <button
                onClick={() => playSound('Space')}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 transition-all ${
                  playingKey === 'Space'
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 scale-95'
                    : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                }`}
              >
                <span className="text-sm font-bold font-mono">Spacebar</span>
                <span className="text-[10px] text-zinc-400 mt-0.5">Tiếng đập buồng rỗng</span>
              </button>
            </div>
          </div>

          {/* Card thông số cấu hình */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl flex-1">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              Chi tiết linh kiện phần cứng
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-zinc-400">Vỏ Case:</span>
                <span className="font-medium text-white capitalize">{build.config.caseMaterial}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-zinc-400">Màu vỏ:</span>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: build.config.caseColor }} />
                  <span className="font-mono text-zinc-300">{build.config.caseColor}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-zinc-400">Màu Keycap chính:</span>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: build.config.keycapColor }} />
                  <span className="font-mono text-zinc-300">{build.config.keycapColor}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-zinc-400">Đèn gầm RGB:</span>
                <span className="font-medium text-white">{build.config.underglowEnabled ? 'Bật' : 'Tắt'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-400">Mô hình:</span>
                <span className="font-mono text-zinc-400 text-[11px]">{build.config.modelId}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
