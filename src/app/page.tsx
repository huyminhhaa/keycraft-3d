'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Layers,
  Sparkles,
  Volume2,
  ShieldCheck,
  ArrowRight,
  User,
  LogOut,
  Play,
} from 'lucide-react';
import { soundEngine } from '@/lib/audio/soundEngine';
import { useAuthStore } from '@/store/useAuthStore';
import { AuthModal } from '@/components/ui/AuthModal';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

/** Độ trễ so le cho hiệu ứng trượt vào (đọc trong globals.css qua --reveal-delay) */
const revealDelay = (ms: number): React.CSSProperties => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties;

/** Logo KeyCraft: một keycap nhìn từ trên xuống */
const BrandMark: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 22 22" aria-hidden className="shrink-0">
    <rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <rect x="5.5" y="4.5" width="11" height="10" rx="2.5" fill="currentColor" />
  </svg>
);

const SOUND_PRESETS = [
  {
    id: 'pom-linear',
    name: 'Deep Thock',
    desc: 'Plate POM + Switch Linear',
    badge: 'Trầm & Đầm',
    plate: 'pom' as const,
    switchType: 'linear' as const,
  },
  {
    id: 'alu-clack',
    name: 'Crisp Clack',
    desc: 'Plate Nhôm + Switch Linear',
    badge: 'Đanh & Nảy',
    plate: 'aluminum' as const,
    switchType: 'linear' as const,
  },
  {
    id: 'clicky',
    name: 'Sharp Clicky',
    desc: 'Plate FR4 + Switch Clicky',
    badge: 'Lá đồng nảy',
    plate: 'fr4' as const,
    switchType: 'clicky' as const,
  },
  {
    id: 'silent',
    name: 'Silent Whisper',
    desc: 'Plate PC + Silent Linear',
    badge: 'Gõ êm ru',
    plate: 'polycarbonate' as const,
    switchType: 'silent_linear' as const,
  },
];

const TECH_BADGES = [
  { name: 'Next.js 16', role: 'App Router & Turbopack' },
  { name: 'React Three Fiber', role: 'Three.js 3D Viewport' },
  { name: 'Web Audio API', role: 'Bản thu phím thật' },
  { name: 'Google Gemini', role: 'Agentic Tool Calling' },
  { name: 'PostgreSQL 17', role: 'pgvector RAG Embeddings' },
  { name: 'Redis 7', role: 'Brute-force Shield & Cache' },
  { name: 'Drizzle ORM', role: 'Strict Type-Safe Schema' },
  { name: 'Framer Motion', role: 'Kinetic Interactions' },
];

export default function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openModal = useAuthStore((s) => s.openModal);
  const logout = useAuthStore((s) => s.logout);

  const [activeSound, setActiveSound] = useState<string | null>(null);

  const playDemoSound = (preset: (typeof SOUND_PRESETS)[number]) => {
    setActiveSound(preset.id);
    soundEngine.playKeySound('Space', {
      plateMaterial: preset.plate,
      switchType: preset.switchType,
    });
    setTimeout(() => setActiveSound(null), 300);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-accent/30 selection:text-ink">
      <ScrollReveal />
      {/* -------------------------------------------------------------------------- */}
      {/* 1. NAVBAR                                                                  */}
      {/* -------------------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-ink hover:opacity-90 transition-opacity">
            <BrandMark />
            <span className="text-[16px] font-semibold tracking-tight">KeyCraft 3D</span>
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] font-medium text-muted md:flex">
            <a href="#features" className="hover:text-ink transition-colors">
              Tính năng
            </a>
            <a href="#audio" className="hover:text-ink transition-colors">
              Âm học Web Audio
            </a>
            <a href="#ai" className="hover:text-ink transition-colors">
              Trợ lý AI
            </a>
            <a href="#architecture" className="hover:text-ink transition-colors">
              Kiến trúc
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1.5 pr-3 text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-[12px] font-medium">{user.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                  className="rounded-full border border-line p-1.5 text-muted hover:border-ink hover:text-ink transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openModal('login')}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:border-ink transition-colors"
              >
                <User className="h-3 w-3" />
                <span>Đăng nhập</span>
              </button>
            )}

            <Link
              href="/studio"
              className="btn-press flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-canvas shadow transition-opacity hover:opacity-95"
            >
              <span>Vào Studio 3D</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------------------- */}
      {/* 2. HERO SECTION                                                            */}
      {/* -------------------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-line px-5 py-20 lg:px-8 lg:py-28">
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[600px] rounded-full bg-radial from-white/10 to-transparent blur-3xl opacity-60" />

        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1 text-[12px] font-medium text-muted"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Interactive Custom Keyboard Studio & AI Acoustic Architect</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-[36px] font-semibold tracking-tight text-ink sm:text-[54px] sm:leading-[1.12]"
          >
            Kiến tạo Bàn phím cơ 3D.
            <br />
            <span className="text-muted">Định hình Âm học Đỉnh cao.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-[17px]"
          >
            Studio tùy biến bàn phím cơ tương tác thời gian thực: mô phỏng 7 tầng linh kiện phần cứng, tổng hợp âm thanh
            gõ phím Web Audio không độ trễ, và điều khiển trực quan bằng Trợ lý AI thế hệ mới.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3.5"
          >
            <Link
              href="/studio"
              className="btn-press flex items-center gap-2 rounded-lg bg-ink px-6 py-3 text-[14px] font-semibold text-canvas shadow-lg transition-transform hover:scale-[1.02]"
            >
              <span>Trải nghiệm 3D Studio</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#audio"
              className="btn-press flex items-center gap-2 rounded-lg border border-line bg-surface px-6 py-3 text-[14px] font-medium text-ink transition-colors hover:border-ink"
            >
              <Volume2 className="h-4 w-4" />
              <span>Nghe thử âm thanh</span>
            </a>
          </motion.div>

          {/* Interactive Hero Sound Teaser Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mx-auto mt-14 max-w-xl rounded-xl border border-line bg-surface p-4 shadow-xl text-left"
          >
            <div className="mb-3 flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 font-medium text-ink">
                <Volume2 className="h-3.5 w-3.5 text-accent" />
                <span>Bấm nghe thử âm thanh phím cơ (Web Audio Synth 0ms)</span>
              </span>
              <span className="text-[11px] text-muted">Zero Latency</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SOUND_PRESETS.map((preset) => {
                const isPlaying = activeSound === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => playDemoSound(preset)}
                    className={`btn-press group relative flex flex-col rounded-lg border p-2.5 transition-all ${
                      isPlaying
                        ? 'border-ink bg-ink/10 scale-95 shadow-md'
                        : 'border-line bg-canvas hover:border-ink/60'
                    }`}
                  >
                    <span className="text-[11px] font-medium text-muted group-hover:text-ink">{preset.badge}</span>
                    <span className="mt-1 text-[13px] font-semibold text-ink">{preset.name}</span>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-faint">
                      <Play className="h-2.5 w-2.5 fill-current" />
                      <span>Bấm nghe</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* -------------------------------------------------------------------------- */}
      {/* 3. BENTO GRID FEATURES                                                     */}
      {/* -------------------------------------------------------------------------- */}
      <section id="features" className="border-b border-line px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center" data-reveal="left">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Bento Grid Features</h2>
            <p className="mt-2 text-[28px] font-semibold tracking-tight text-ink sm:text-[36px]">
              Kỹ nghệ Phần cứng & Trải nghiệm Siêu thực
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Card 1: 3D Exploded View (Khối lớn 2 cột) */}
            <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-7 md:col-span-2" data-reveal="left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-canvas text-ink">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-[20px] font-semibold text-ink">Mô phỏng 7 tầng cấu trúc & Tách lớp 3D</h3>
              <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-muted">
                Khám phá trọn vẹn từng lớp linh kiện cơ học: Vỏ trên CNC, Keycaps Cherry profile, Switch hotswap 5 chân,
                Plate nhôm/POM, Foam Poron tiêu âm, Mạch PCB và Tạ đồng chải xước. Bung tách lớp mượt mà bằng vật lý quán
                tính và xuất file .glb sang Blender.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-muted">
                <span className="rounded border border-line bg-canvas px-2.5 py-1">Top Case</span>
                <span className="rounded border border-line bg-canvas px-2.5 py-1">Keycaps</span>
                <span className="rounded border border-line bg-canvas px-2.5 py-1">Switches</span>
                <span className="rounded border border-line bg-canvas px-2.5 py-1">Switch Plate</span>
                <span className="rounded border border-line bg-canvas px-2.5 py-1">Poron Foam</span>
                <span className="rounded border border-line bg-canvas px-2.5 py-1">PCB</span>
                <span className="rounded border border-line bg-canvas px-2.5 py-1">Bottom Case</span>
              </div>
            </div>

            {/* Card 2: Web Audio Synthesizer */}
            <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-7" data-reveal="right" style={revealDelay(90)}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-canvas text-ink">
                <Volume2 className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-[20px] font-semibold text-ink">Tiếng gõ thu từ phím thật</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                Mỗi build phát đúng bản thu của chính nó, cắt từ video sound test thành từng tiếng gõ. Web Audio phát lại
                ngay khi bạn gõ, mỗi lần một biến thể khác nhau.
              </p>
              <div className="mt-6 text-[12px] font-medium text-accent">
                16 biến thể mỗi build, không lặp tiếng vừa phát
              </div>
            </div>

            {/* Card 3: AI Acoustic Architect */}
            <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-7" data-reveal="left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-canvas text-ink">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-[20px] font-semibold text-ink">Trợ lý AI Kiến trúc sư</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                Tích hợp Google Gemini thông minh. Tự động lắng nghe gu âm thanh (Deep Thock, Crisp Clack, Creamy) và trực
                tiếp điều khiển mô hình 3D biến đổi ngay trước mắt bạn.
              </p>
              <div className="mt-6 text-[12px] font-medium text-accent">Agentic Tool Calling • SSE Streaming</div>
            </div>

            {/* Card 4: Enterprise Security & Auth (Khối 2 cột) */}
            <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-7 md:col-span-2" data-reveal="right" style={revealDelay(90)}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-canvas text-ink">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-[20px] font-semibold text-ink">Bảo Mật Enterprise & Lá Chắn Brute-Force</h3>
              <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-muted">
                Kiến trúc xác thực kép với Access Token (15m) & Refresh Token (7d) đóng gói trong httpOnly secure
                cookies chống XSS. Hệ thống Brute-force Shield theo dõi lượt dò mật khẩu qua Redis, tự động kích hoạt
                thử thách Signed CAPTCHA HMAC khi phát hiện bất thường.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-muted">
                <span className="rounded border border-line bg-canvas px-2.5 py-1">JWT (jose)</span>
                <span className="rounded border border-line bg-canvas px-2.5 py-1">bcryptjs (12 rounds)</span>
                <span className="rounded border border-line bg-canvas px-2.5 py-1">Redis Tracker</span>
                <span className="rounded border border-line bg-canvas px-2.5 py-1">Signed CAPTCHA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------------- */}
      {/* 4. ACOUSTIC SHOWCASE SECTION                                               */}
      {/* -------------------------------------------------------------------------- */}
      <section id="audio" className="border-b border-line px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center" data-reveal="right">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Acoustic Physics Simulation</h2>
            <p className="mt-2 text-[28px] font-semibold tracking-tight text-ink sm:text-[36px]">
              Vật Lý Âm Học: Từ Plate Nhôm Đến Plate POM
            </p>
            <p className="mx-auto mt-3 max-w-xl text-[14px] text-muted">
              Mỗi chất liệu tấm định vị (Plate) và cấu trúc vỏ tạo ra một dấu vân âm thanh riêng biệt. Hãy nghe và cảm
              nhận sự khác nhau giữa các trường phái:
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface p-5" data-reveal="left" style={revealDelay(0)}>
              <span className="text-[12px] font-semibold text-accent">Plate Nhôm (Aluminum)</span>
              <h4 className="mt-1 text-[17px] font-bold text-ink">Crisp Clack</h4>
              <p className="mt-2 text-[13px] text-muted">Tần số cao (~680Hz), đỉnh lọc Q nhọn. Âm đanh, rõ từng phím gõ.</p>
              <button
                type="button"
                onClick={() =>
                  soundEngine.playKeySound('KeyA', { plateMaterial: 'aluminum', switchType: 'linear' })
                }
                className="btn-press mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-canvas py-2 text-[12px] font-medium text-ink hover:border-ink"
              >
                <Play className="h-3 w-3" />
                <span>Gõ thử phím Nhôm</span>
              </button>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5" data-reveal="right" style={revealDelay(80)}>
              <span className="text-[12px] font-semibold text-accent">Plate FR4</span>
              <h4 className="mt-1 text-[17px] font-bold text-ink">Balanced Pop</h4>
              <p className="mt-2 text-[13px] text-muted">Tần số cân bằng (~520Hz). Âm giòn giã, độ nảy vừa phải, tự nhiên.</p>
              <button
                type="button"
                onClick={() =>
                  soundEngine.playKeySound('KeyA', { plateMaterial: 'fr4', switchType: 'linear' })
                }
                className="btn-press mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-canvas py-2 text-[12px] font-medium text-ink hover:border-ink"
              >
                <Play className="h-3 w-3" />
                <span>Gõ thử phím FR4</span>
              </button>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5" data-reveal="left" style={revealDelay(160)}>
              <span className="text-[12px] font-semibold text-accent">Plate POM</span>
              <h4 className="mt-1 text-[17px] font-bold text-ink">Deep Thock</h4>
              <p className="mt-2 text-[13px] text-muted">Tần số trầm (~340Hz). Chất âm trầm, dày, ngân vang ấm áp.</p>
              <button
                type="button"
                onClick={() =>
                  soundEngine.playKeySound('KeyA', { plateMaterial: 'pom', switchType: 'linear' })
                }
                className="btn-press mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-canvas py-2 text-[12px] font-medium text-ink hover:border-ink"
              >
                <Play className="h-3 w-3" />
                <span>Gõ thử phím POM</span>
              </button>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5" data-reveal="right" style={revealDelay(240)}>
              <span className="text-[12px] font-semibold text-accent">Polycarbonate</span>
              <h4 className="mt-1 text-[17px] font-bold text-ink">Muted Whisper</h4>
              <p className="mt-2 text-[13px] text-muted">Tần số cực trầm (~290Hz). Êm tai, mềm mại, phù hợp không gian yên tĩnh.</p>
              <button
                type="button"
                onClick={() =>
                  soundEngine.playKeySound('KeyA', { plateMaterial: 'polycarbonate', switchType: 'silent_linear' })
                }
                className="btn-press mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-canvas py-2 text-[12px] font-medium text-ink hover:border-ink"
              >
                <Play className="h-3 w-3" />
                <span>Gõ thử phím PC</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------------- */}
      {/* 5. TECH STACK & TELEMETRY                                                  */}
      {/* -------------------------------------------------------------------------- */}
      <section id="architecture" className="border-b border-line px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center" data-reveal="left">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Fullstack Architecture</h2>
            <p className="mt-2 text-[28px] font-semibold tracking-tight text-ink sm:text-[36px]">
              Công Nghệ Chuẩn Production
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TECH_BADGES.map((item, i) => (
              <div key={item.name} className="rounded-xl border border-line bg-surface p-4 text-center" data-reveal={i % 2 === 0 ? 'left' : 'right'} style={revealDelay((i % 4) * 60)}>
                <span className="block text-[14px] font-semibold text-ink">{item.name}</span>
                <span className="mt-1 block text-[11px] text-muted">{item.role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------------- */}
      {/* 6. CALL TO ACTION & FOOTER                                                 */}
      {/* -------------------------------------------------------------------------- */}
      <section className="px-5 py-24 text-center lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-[32px] font-bold tracking-tight text-ink sm:text-[42px]" data-reveal="left">
            Sẵn sàng chế tác chiếc bàn phím chân ái của bạn?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-muted" data-reveal="right" style={revealDelay(90)}>
            Mở Studio 3D ngay bây giờ, thử các phối màu độc bản, lắng nghe âm thanh gõ phím thời gian thực và trò chuyện cùng Trợ lý AI.
          </p>
          <div className="mt-8 flex justify-center gap-3" data-reveal="left" style={revealDelay(180)}>
            <Link
              href="/studio"
              className="btn-press flex items-center gap-2 rounded-lg bg-ink px-8 py-3.5 text-[15px] font-semibold text-canvas shadow-xl transition-transform hover:scale-[1.02]"
            >
              <span>Bắt đầu trải nghiệm Studio 3D</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line px-5 py-8 text-center text-[12px] text-muted lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-ink">
            <BrandMark />
            <span className="font-semibold">KeyCraft 3D Studio</span>
          </div>
          <p>© 2026 KeyCraft 3D. Interactive Custom Mechanical Keyboard Studio & AI Acoustic Architect.</p>
          <div className="flex gap-4">
            <Link href="/studio" className="hover:text-ink transition-colors">
              Studio 3D
            </Link>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </footer>

      {/* Modal đăng nhập / đăng ký */}
      <AuthModal />
    </div>
  );
}
