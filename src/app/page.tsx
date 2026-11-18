'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { ArrowRight, Layers, LogOut, Pause, Play, SlidersHorizontal, User, Volume2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { useSoundStore } from '@/store/useSoundStore';
import { AuthModal } from '@/components/ui/AuthModal';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { playDemo } from '@/components/ui/BuildsPanel';
import { buildBrand, buildPhotoUrl, findBuild, type KeyboardBuild } from '@/lib/keyboard/builds';
import { attachKeyboardListeners } from '@/lib/keyboard/pressedKeys';
import { FEATURED_BUILDS as FEATURED, LANDING_STATS } from '@/lib/ui/landing';

// Mô hình 3D chỉ chạy phía trình duyệt; lúc đang tải giữ chỗ để bố cục không nhảy
const HeroKeyboard = dynamic(() => import('@/components/canvas/HeroKeyboard'), {
  ssr: false,
  loading: () => <div className="h-full w-full" aria-hidden />,
});

/** Độ trễ so le cho hiệu ứng trượt vào (đọc trong globals.css qua --reveal-delay) */
const revealDelay = (ms: number): React.CSSProperties => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties;

const FEATURES = [
  {
    icon: Layers,
    title: 'Dựng theo ảnh thật',
    body: 'Vỏ, màu keycap, núm xoay, con lăn và màn hình đặt đúng chỗ như mẫu thật. Tách 7 lớp để xem plate, foam, switch của từng mẫu.',
  },
  {
    icon: Volume2,
    title: 'Tiếng gõ của chính mẫu đó',
    body: 'Mỗi mẫu có gói tiếng cắt từ video sound test: phím thường, phím cách và tiếng nhả phím, cân bằng âm lượng khi phát.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Tự phối hoặc hỏi trợ lý',
    body: 'Đổi layout, vỏ, plate, switch, màu keycap. Trợ lý AI gợi ý cấu hình theo kiểu âm bạn thích và đổi mô hình ngay.',
  },
];

/** Logo KeyCraft: một keycap nhìn từ trên xuống */
const BrandMark: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="shrink-0">
    <rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <rect x="5.5" y="4.5" width="11" height="10" rx="2.5" fill="currentColor" />
  </svg>
);

/** Mẫu đang hiện trên mô hình 3D */
const ShowcaseCaption: React.FC = () => {
  const build = findBuild(useKeyboardStore((s) => s.buildId ?? null));
  if (!build) return null;
  return (
    <p className="text-center text-[12px] text-muted" aria-live="polite">
      <span className="font-medium text-ink">{build.name}</span>
      <span className="mx-1.5 text-faint">·</span>
      {build.specs.switch}
    </p>
  );
};

interface ListenCardProps {
  build: KeyboardBuild;
  index: number;
  state: 'idle' | 'loading' | 'playing';
  onListen: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const ListenCard: React.FC<ListenCardProps> = ({ build, index, state, onListen }) => (
  // Trượt vào lần lượt khi cuộn tới
  <li
    className="overflow-hidden rounded-2xl border border-line bg-surface"
    data-reveal={index % 2 ? 'right' : 'left'}
    style={revealDelay((index % 3) * 70)}
  >
    <div className="relative aspect-[16/10] bg-canvas">
      <Image src={buildPhotoUrl(build)} alt={build.name} fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
    </div>
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{buildBrand(build)}</p>
        <p className="truncate text-[15px] font-semibold text-ink">{build.name.split(' ').slice(1).join(' ')}</p>
        <p className="mt-0.5 truncate text-[12px] text-muted">
          {build.specs.switch} · plate {build.specs.plate}
        </p>
      </div>
      <button
        type="button"
        onClick={onListen}
        aria-label={`Nghe thử ${build.name}`}
        aria-pressed={state !== 'idle'}
        className={`btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
          state === 'idle' ? 'border-line text-ink hover:border-ink/60' : 'border-ink bg-ink text-canvas'
        }`}
      >
        {state === 'loading' ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        ) : state === 'playing' ? (
          <Pause className="h-4 w-4" aria-hidden />
        ) : (
          <Play className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  </li>
);

export default function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openModal = useAuthStore((s) => s.openModal);
  const logout = useAuthStore((s) => s.logout);

  const [listening, setListening] = useState<{ id: string; state: 'loading' | 'playing' } | null>(null);
  const [typing, setTyping] = useState(false);
  const stopDemo = useRef<(() => void) | null>(null);
  const token = useRef(0);

  // Đã chọn một mẫu để nghe: gõ trên bàn phím thật cũng ra tiếng của mẫu đó
  useEffect(() => (typing ? attachKeyboardListeners(window) : undefined), [typing]);
  useEffect(() => () => stopDemo.current?.(), []);

  const listen = async (build: KeyboardBuild, event: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    if (event.detail > 0) event.currentTarget.blur();
    stopDemo.current?.();
    stopDemo.current = null;
    const mine = ++token.current;
    // Bấm lại mẫu đang phát: dừng
    if (listening?.id === build.id && listening.state === 'playing') {
      setListening(null);
      return;
    }
    setListening({ id: build.id, state: 'loading' });
    useKeyboardStore.getState().applyBuild(build.id);
    await useSoundStore.getState().selectPack(build.soundPackId);
    if (mine !== token.current) return;
    setListening({ id: build.id, state: 'playing' });
    setTyping(true);
    stopDemo.current = playDemo();
    window.setTimeout(() => {
      if (mine === token.current) setListening(null);
    }, 2200);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <ScrollReveal />

      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-ink">
            <BrandMark />
            <span className="text-[15px] font-semibold tracking-tight">KeyCraft</span>
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] text-muted md:flex" aria-label="Mục trên trang">
            <a href="#nghe-thu" className="transition-colors hover:text-ink">
              Nghe thử
            </a>
            <a href="#tinh-nang" className="transition-colors hover:text-ink">
              Tính năng
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <span className="hidden text-[12px] text-muted sm:inline">{user.name}</span>
                <button
                  type="button"
                  onClick={() => logout()}
                  aria-label="Đăng xuất"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:text-ink"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openModal('login')}
                className="flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] text-ink transition-colors hover:border-ink/60"
              >
                <User className="h-3 w-3" aria-hidden />
                Đăng nhập
              </button>
            )}
            <Link
              href="/studio"
              className="btn-press flex h-8 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12px] font-semibold text-canvas"
            >
              Mở Studio
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero: lời giới thiệu + mô hình 3D thật luân phiên các mẫu */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute right-[-10%] top-1/2 h-[620px] w-[820px] -translate-y-1/2 rounded-full opacity-70 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.07), transparent)' }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-5 pb-12 pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-4 lg:px-8 lg:py-20">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted"
            >
              Studio bàn phím cơ 3D
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="mt-4 text-[38px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[54px]"
            >
              Bàn phím cơ thật, xem trong 3D.
              <span className="block text-muted">Nghe đúng tiếng gõ của từng mẫu.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="mt-5 max-w-md text-[15px] leading-relaxed text-muted"
            >
              {LANDING_STATS.builds} mẫu từ {LANDING_STATS.brands} hãng, dựng lại theo ảnh thật đến từng lớp linh kiện. Mỗi mẫu
              phát bản thu tiếng gõ của chính nó.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                href="/studio"
                className="btn-press flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas"
              >
                Mở Studio
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href="#nghe-thu"
                className="btn-press flex h-11 items-center gap-2 rounded-full border border-line px-6 text-[14px] font-medium text-ink transition-colors hover:border-ink/60"
              >
                <Volume2 className="h-4 w-4" aria-hidden />
                Nghe thử
              </a>
            </motion.div>
            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-10 grid max-w-sm grid-cols-3 gap-4 border-t border-line pt-6"
            >
              {[
                [LANDING_STATS.builds, 'mẫu phím'],
                [LANDING_STATS.brands, 'hãng'],
                [LANDING_STATS.layers, 'lớp linh kiện'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-[26px] font-semibold tracking-tight text-ink">{value}</dd>
                  <dd className="text-[12px] text-muted">{label}</dd>
                </div>
              ))}
            </motion.dl>
          </div>

          <div>
            <div className="relative h-[300px] sm:h-[400px] lg:h-[520px]">
              <HeroKeyboard cycling={!typing} />
            </div>
            <ShowcaseCaption />
          </div>
        </div>
      </section>

      {/* Nghe thử bản thu thật */}
      <section id="nghe-thu" className="scroll-mt-16 border-b border-line px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl" data-reveal="left">
            <h2 className="text-[30px] font-semibold tracking-tight text-ink sm:text-[38px]">Nghe tiếng gõ thật</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Mỗi mẫu phát đoạn gõ thử từ bản thu của chính nó, mô hình 3D phía trên đổi theo. Sau đó cứ gõ trên bàn phím
              của bạn để nghe tiếp.
            </p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED.map((build, i) => (
              <ListenCard
                key={build.id}
                build={build}
                index={i}
                state={listening?.id === build.id ? listening.state : 'idle'}
                onListen={(event) => void listen(build, event)}
              />
            ))}
          </ul>
          <p className="mt-6 text-[13px] text-muted" data-reveal="right">
            Còn {LANDING_STATS.builds - FEATURED.length} mẫu khác trong{' '}
            <Link href="/studio" className="text-ink underline-offset-4 hover:underline">
              Studio
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Ba điều làm nên KeyCraft */}
      <section id="tinh-nang" className="scroll-mt-16 border-b border-line px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3 md:gap-8">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <div key={title} data-reveal={i % 2 ? 'right' : 'left'} style={revealDelay(i * 80)}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <h3 className="mt-5 text-[18px] font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-24 text-center lg:px-8">
        <h2 className="text-[30px] font-semibold tracking-tight text-ink sm:text-[40px]" data-reveal="left">
          Chọn mẫu đầu tiên của bạn.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-muted" data-reveal="right" style={revealDelay(80)}>
          Xoay, tách lớp, đổi màu và gõ thử ngay trên trình duyệt.
        </p>
        <div className="mt-8 flex justify-center" data-reveal="left" style={revealDelay(160)}>
          <Link
            href="/studio"
            className="btn-press flex h-12 items-center gap-2 rounded-full bg-ink px-7 text-[15px] font-semibold text-canvas"
          >
            Mở Studio
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-[12px] text-muted sm:flex-row">
          <span className="flex items-center gap-2 text-ink">
            <BrandMark />
            <span className="font-semibold">KeyCraft</span>
          </span>
          <span>© 2026 KeyCraft</span>
          <Link href="/studio" className="transition-colors hover:text-ink">
            Studio
          </Link>
        </div>
      </footer>

      <AuthModal />
    </div>
  );
}
