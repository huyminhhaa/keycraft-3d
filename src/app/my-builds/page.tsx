import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { listUserBuilds } from '@/lib/builds/buildService';
import { AuthModal } from '@/components/ui/AuthModal';
import { MyBuildsClient, type MyBuild } from './MyBuildsClient';
import { SignedOutState } from './SignedOutState';

export const metadata: Metadata = {
  title: 'Bản build của tôi — KeyCraft',
  description: 'Quản lý các bản build bàn phím đã lưu: mở lại trong Studio, chia sẻ, đổi công khai/riêng tư, xoá.',
};

/** Phần phụ thuộc phiên đăng nhập (đọc cookie) -> render theo từng request bên trong Suspense */
async function MyBuildsContent() {
  const session = await getSessionFromHeaders(await headers());
  if (!session.authenticated || !session.user) {
    return <SignedOutState />;
  }

  const builds = await listUserBuilds(session.user.id);
  const items: MyBuild[] = builds.map((b) => ({
    slug: b.slug,
    title: b.title,
    description: b.description,
    isPublic: b.isPublic,
    viewCount: b.viewCount,
    forkCount: b.forkCount,
    createdAt: new Date(b.createdAt).toISOString(),
    config: b.config,
  }));

  return <MyBuildsClient builds={items} userName={session.user.name} />;
}

function LoadingGrid() {
  return (
    <div aria-busy="true" aria-label="Đang tải bản build" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-2xl border border-line bg-surface" />
      ))}
    </div>
  );
}

export default function MyBuildsPage() {
  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <nav className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-ink transition-opacity hover:opacity-80">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
              <rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <rect x="5.5" y="4.5" width="11" height="10" rx="2.5" fill="currentColor" />
            </svg>
            <span className="text-[14px] font-semibold tracking-tight">KeyCraft</span>
          </Link>
          <Link
            href="/studio"
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2"
          >
            Về Studio
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <Suspense fallback={<LoadingGrid />}>
          <MyBuildsContent />
        </Suspense>
      </div>

      <AuthModal />
    </main>
  );
}
