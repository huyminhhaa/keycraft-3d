'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import type { KeyboardState } from '@/types/keyboard';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import {
  countByVisibility,
  filterAndSortBuilds,
  type BuildSort,
  type MyBuildItem,
  type VisibilityFilter,
} from '@/lib/builds/myBuildsView';
import { BuildCard } from './BuildCard';

export interface MyBuild extends MyBuildItem {
  createdAt: string;
  config: KeyboardState;
}

interface MyBuildsClientProps {
  builds: MyBuild[];
  userName: string;
}

const FILTERS: Array<{ id: VisibilityFilter; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'public', label: 'Công khai' },
  { id: 'private', label: 'Riêng tư' },
];

const SORTS: Array<{ id: BuildSort; label: string }> = [
  { id: 'newest', label: 'Mới nhất' },
  { id: 'oldest', label: 'Cũ nhất' },
  { id: 'views', label: 'Nhiều lượt xem' },
  { id: 'name', label: 'Tên A–Z' },
];

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  return typeof data.error === 'string' ? data.error : fallback;
}

export function MyBuildsClient({ builds: initialBuilds, userName }: MyBuildsClientProps) {
  const router = useRouter();
  const applyAIConfig = useKeyboardStore((s) => s.applyAIConfig);
  const [builds, setBuilds] = useState(initialBuilds);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');
  const [sort, setSort] = useState<BuildSort>('newest');
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const counts = useMemo(() => countByVisibility(builds), [builds]);
  const visible = useMemo(
    () => filterAndSortBuilds(builds, { query, visibility, sort }),
    [builds, query, visibility, sort]
  );

  const openInStudio = (build: MyBuild) => {
    applyAIConfig(build.config);
    router.push('/studio');
  };

  const toggleVisibility = async (build: MyBuild) => {
    const next = !build.isPublic;
    setBusySlug(build.slug);
    setNotice(null);
    // Cập nhật lạc quan, hỏng thì trả lại
    setBuilds((list) => list.map((b) => (b.slug === build.slug ? { ...b, isPublic: next } : b)));
    try {
      const res = await fetch(`/api/builds/${encodeURIComponent(build.slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Không đổi được chế độ hiển thị.'));
      setNotice({ tone: 'info', text: `"${build.title}" giờ là ${next ? 'công khai' : 'riêng tư'}.` });
    } catch (error) {
      setBuilds((list) => list.map((b) => (b.slug === build.slug ? { ...b, isPublic: build.isPublic } : b)));
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Lỗi kết nối.' });
    } finally {
      setBusySlug(null);
    }
  };

  const deleteBuild = async (build: MyBuild) => {
    setBusySlug(build.slug);
    setNotice(null);
    try {
      const res = await fetch(`/api/builds/${encodeURIComponent(build.slug)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(await readError(res, 'Không xoá được bản build.'));
      setBuilds((list) => list.filter((b) => b.slug !== build.slug));
      setNotice({ tone: 'info', text: `Đã xoá "${build.title}".` });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Lỗi kết nối.' });
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight">Bản build của tôi</h1>
          <p className="mt-1 text-[14px] text-muted">
            {builds.length > 0
              ? `${userName}, bạn có ${builds.length} bản build · ${counts.public} công khai, ${counts.private} riêng tư.`
              : `Chào ${userName}, bạn chưa lưu bản build nào.`}
          </p>
        </div>
        <Link
          href="/studio"
          className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-canvas hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Tạo bản build mới
        </Link>
      </header>

      {builds.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="relative block md:w-80">
            <span className="sr-only">Tìm bản build</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc mô tả…"
              className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-9 text-[14px] text-ink placeholder:text-faint focus:border-ink/50 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Xoá ô tìm kiếm"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Lọc theo chế độ hiển thị" className="flex rounded-lg border border-line bg-surface p-0.5">
              {FILTERS.map((f) => {
                const active = visibility === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setVisibility(f.id)}
                    className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                      active ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {f.label} <span className="text-faint">{counts[f.id]}</span>
                  </button>
                );
              })}
            </div>

            <label className="flex items-center gap-2 text-[13px] text-muted">
              <span className="sr-only md:not-sr-only">Sắp xếp</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as BuildSort)}
                className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] text-ink focus:border-ink/50 focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      <p aria-live="polite" className="min-h-[1.5rem] pt-3 text-[13px]">
        {notice && <span className={notice.tone === 'error' ? 'text-red-300' : 'text-muted'}>{notice.text}</span>}
      </p>

      {builds.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-[15px] font-medium">Chưa có bản build nào</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
            Vào Studio, chỉnh bàn phím theo ý bạn rồi bấm <span className="text-ink">Lưu &amp; Chia sẻ</span> ở góc dưới thanh
            cấu hình. Bản build sẽ xuất hiện ở đây.
          </p>
          <Link
            href="/studio"
            className="btn-press mt-5 inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-[13px] font-medium text-canvas hover:opacity-90"
          >
            Mở Studio
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-line px-6 py-12 text-center text-[14px] text-muted">
          Không có bản build nào khớp bộ lọc.{' '}
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setVisibility('all');
            }}
            className="text-ink underline underline-offset-4"
          >
            Xoá bộ lọc
          </button>
        </div>
      ) : (
        <ul className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((build) => (
            <li key={build.slug} className="flex">
              <BuildCard
                build={build}
                busy={busySlug === build.slug}
                onOpenInStudio={openInStudio}
                onToggleVisibility={(b) => void toggleVisibility(b)}
                onDelete={(b) => void deleteBuild(b)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
