'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Copy, ExternalLink, Eye, GitFork, Globe, Lock, Trash2, Wrench } from 'lucide-react';
import type { KeyboardState } from '@/types/keyboard';
import { buildPhotoUrl, findBuild } from '@/lib/keyboard/builds';
import { formatRelativeTime } from '@/lib/builds/myBuildsView';
import type { MyBuild } from './MyBuildsClient';

const PLATE_LABEL: Record<KeyboardState['plateMaterial'], string> = {
  aluminum: 'Plate nhôm',
  polycarbonate: 'Plate PC',
  pom: 'Plate POM',
  fr4: 'Plate FR4',
};

const SWITCH_LABEL: Record<KeyboardState['switchType'], string> = {
  linear: 'Linear',
  tactile: 'Tactile',
  clicky: 'Clicky',
  silent_linear: 'Silent linear',
};

/** Bàn phím thu nhỏ vẽ bằng CSS theo đúng màu vỏ / keycap của bản build */
function KeyboardThumb({ config }: { config: KeyboardState }) {
  const rows = [12, 12, 11, 10];
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div
        className="w-full max-w-[240px] rounded-[10px] p-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)]"
        style={{ backgroundColor: config.caseColor }}
      >
        <div className="flex flex-col gap-[3px]">
          {rows.map((count, r) => (
            <div key={r} className="flex gap-[3px]">
              {Array.from({ length: count }, (_, k) => {
                const isEdge = k === 0 || k === count - 1;
                const isAccent = (r === 0 && k === 0) || (r === 2 && k === count - 1);
                const wide = isEdge ? 'flex-[1.5]' : r === 3 && k === 4 ? 'flex-[5]' : 'flex-1';
                return (
                  <span
                    key={k}
                    className={`${wide} aspect-square max-h-[18px] rounded-[3px]`}
                    style={{
                      backgroundColor: isAccent
                        ? config.keycapAccentColor
                        : isEdge
                          ? config.keycapModifierColor
                          : config.keycapColor,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface BuildCardProps {
  build: MyBuild;
  busy: boolean;
  onOpenInStudio: (build: MyBuild) => void;
  onToggleVisibility: (build: MyBuild) => void;
  onDelete: (build: MyBuild) => void;
}

export function BuildCard({ build, busy, onOpenInStudio, onToggleVisibility, onDelete }: BuildCardProps) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const realBuild = findBuild(build.config.buildId ?? null);
  const href = `/build/${build.slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Trình duyệt chặn clipboard -> bỏ qua
    }
  };

  return (
    <article className="group flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-ink/25">
      {/* Ảnh: mẫu phím thật thì dùng ảnh thật, còn lại vẽ theo màu đã chọn */}
      <Link href={href} className="relative block aspect-[16/9] overflow-hidden bg-surface-2" aria-label={`Xem ${build.title}`}>
        {realBuild ? (
          <Image
            src={buildPhotoUrl(realBuild)}
            alt={realBuild.name}
            fill
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
          />
        ) : (
          <KeyboardThumb config={build.config} />
        )}
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur-md ${
            build.isPublic ? 'bg-black/55 text-zinc-100' : 'bg-amber-400/90 text-black'
          }`}
        >
          {build.isPublic ? <Globe className="h-3 w-3" aria-hidden /> : <Lock className="h-3 w-3" aria-hidden />}
          {build.isPublic ? 'Công khai' : 'Riêng tư'}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight">
            <Link href={href} className="line-clamp-2 hover:underline hover:underline-offset-4">
              {build.title}
            </Link>
          </h2>
          <time dateTime={build.createdAt} className="shrink-0 pt-0.5 text-[12px] text-faint" title={new Date(build.createdAt).toLocaleString('vi-VN')}>
            {formatRelativeTime(build.createdAt)}
          </time>
        </div>

        {build.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{build.description}</p>
        )}

        <p className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted">
          <span className="rounded-md border border-line px-1.5 py-0.5">{build.config.layout}</span>
          <span className="rounded-md border border-line px-1.5 py-0.5">{PLATE_LABEL[build.config.plateMaterial] ?? build.config.plateMaterial}</span>
          <span className="rounded-md border border-line px-1.5 py-0.5">{SWITCH_LABEL[build.config.switchType] ?? build.config.switchType}</span>
          {realBuild && <span className="rounded-md border border-line px-1.5 py-0.5">{realBuild.name}</span>}
        </p>

        <p className="mt-3 flex items-center gap-3 text-[12px] text-faint">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {build.viewCount} lượt xem
          </span>
          <span className="inline-flex items-center gap-1">
            <GitFork className="h-3.5 w-3.5" aria-hidden />
            {build.forkCount} remix
          </span>
        </p>

        <div className="mt-auto pt-4">
          {confirmDelete ? (
            <div role="alertdialog" aria-label={`Xác nhận xoá ${build.title}`} className="flex items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <span className="text-[12px] text-red-200">Xoá vĩnh viễn?</span>
              <span className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                  className="rounded-md px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(build)}
                  disabled={busy}
                  className="rounded-md bg-red-500 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                >
                  {busy ? 'Đang xoá…' : 'Xoá'}
                </button>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenInStudio(build)}
                className="btn-press inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[13px] font-medium text-canvas hover:opacity-90"
              >
                <Wrench className="h-3.5 w-3.5" aria-hidden />
                Mở trong Studio
              </button>
              <IconButton label="Xem trang bản build" href={href}>
                <ExternalLink className="h-4 w-4" />
              </IconButton>
              <IconButton label={copied ? 'Đã chép link' : 'Chép link chia sẻ'} onClick={() => void copyLink()}>
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </IconButton>
              <IconButton
                label={build.isPublic ? 'Chuyển sang riêng tư' : 'Chuyển sang công khai'}
                onClick={() => onToggleVisibility(build)}
                disabled={busy}
              >
                {build.isPublic ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              </IconButton>
              <IconButton label="Xoá bản build" onClick={() => setConfirmDelete(true)} disabled={busy} danger>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

interface IconButtonProps {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  danger?: boolean;
}

function IconButton({ label, children, onClick, href, disabled, danger }: IconButtonProps) {
  const className = `btn-press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors disabled:opacity-40 ${
    danger ? 'hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300' : 'hover:bg-surface-2 hover:text-ink'
  }`;
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
