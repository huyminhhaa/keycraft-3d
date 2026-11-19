import React, { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { canViewBuild, getBuildBySlug, isBuildOwner } from '@/lib/builds/buildService';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { BuildDetailClient } from './BuildDetailClient';

interface BuildPageProps {
  params: Promise<{ slug: string }>;
}

async function BuildContent({ params }: BuildPageProps) {
  const { slug } = await params;
  const build = await getBuildBySlug(slug, true);

  // Build riêng tư: chỉ chủ sở hữu xem được, người khác thấy 404 như build không tồn tại
  const session = await getSessionFromHeaders(await headers());
  if (!build || !canViewBuild(build, session.user?.id ?? null)) {
    notFound();
  }

  return <BuildDetailClient build={build} isOwner={isBuildOwner(build, session.user?.id ?? null)} />;
}

export default function BuildPage({ params }: BuildPageProps) {
  return (
    <main className="min-h-screen bg-[#0c0d0e] text-white">
      {/* Navbar tối giản */}
      <nav className="border-b border-white/10 bg-[#0c0d0e]/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2.5 text-white hover:opacity-80 transition-opacity">
          <svg width="24" height="24" viewBox="0 0 22 22" aria-hidden className="text-cyan-400">
            <rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <rect x="5.5" y="4.5" width="11" height="10" rx="2.5" fill="currentColor" />
          </svg>
          <span className="text-base font-semibold tracking-tight">KeyCraft 3D</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/studio"
            className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-black hover:bg-cyan-400 transition-colors"
          >
            Vào Studio 3D
          </Link>
        </div>
      </nav>

      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-24 text-center text-zinc-400">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            <p className="mt-4 text-xs font-mono">Đang tải cấu hình 3D bản build...</p>
          </div>
        }
      >
        <BuildContent params={params} />
      </Suspense>
    </main>
  );
}
