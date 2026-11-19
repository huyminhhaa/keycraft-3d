'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

/** Chưa đăng nhập: giải thích ngắn + nút đăng nhập; đăng nhập xong tự tải lại danh sách */
export function SignedOutState() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openModal = useAuthStore((s) => s.openModal);

  useEffect(() => {
    if (isAuthenticated) router.refresh();
  }, [isAuthenticated, router]);

  return (
    <section className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-[22px] font-semibold tracking-tight">Bản build của tôi</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Đăng nhập để xem lại các bàn phím bạn đã lưu, mở lại trong Studio, chia sẻ hoặc xoá.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => openModal('login')}
          className="btn-press inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-[13px] font-medium text-canvas hover:opacity-90"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          Đăng nhập
        </button>
        <Link href="/studio" className="text-[13px] text-muted underline underline-offset-4 hover:text-ink">
          Vào Studio
        </Link>
      </div>
    </section>
  );
}
