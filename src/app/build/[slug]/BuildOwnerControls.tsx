'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Lock, Globe, X } from 'lucide-react';

interface BuildOwnerControlsProps {
  slug: string;
  title: string;
  description: string | null;
  isPublic: boolean;
}

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 500;

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  return typeof data.error === 'string' ? data.error : fallback;
}

/**
 * Nút Sửa / Xoá chỉ hiện cho chủ sở hữu bản build (server đã kiểm tra quyền khi render trang;
 * API PATCH/DELETE vẫn tự kiểm tra lại, UI này không phải lớp bảo vệ).
 */
export function BuildOwnerControls({ slug, title, description, isPublic }: BuildOwnerControlsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'edit' | 'confirm-delete'>('idle');
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description ?? '');
  const [draftPublic, setDraftPublic] = useState(isPublic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = `/api/builds/${encodeURIComponent(slug)}`;

  const openEdit = () => {
    setDraftTitle(title);
    setDraftDescription(description ?? '');
    setDraftPublic(isPublic);
    setError(null);
    setMode('edit');
  };

  const handleSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (draftTitle.trim().length < 2) {
      setError('Tiêu đề cần ít nhất 2 ký tự.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: draftTitle.trim(),
          description: draftDescription.trim() || null,
          isPublic: draftPublic,
        }),
      });
      if (!res.ok) {
        setError(await readError(res, 'Không lưu được thay đổi.'));
        return;
      }
      setMode('idle');
      router.refresh();
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) {
        setError(await readError(res, 'Không xoá được bản build.'));
        return;
      }
      router.push('/my-builds');
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-zinc-400">
          {isPublic ? <Globe className="h-3.5 w-3.5" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />}
          <span>
            Bản build của bạn · {isPublic ? 'Công khai, ai có link đều xem được' : 'Riêng tư, chỉ bạn xem được'}
          </span>
        </p>

        {mode === 'idle' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openEdit}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/10"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Sửa
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('confirm-delete');
              }}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/25 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Xoá
            </button>
          </div>
        )}

        {mode === 'confirm-delete' && (
          <div role="alertdialog" aria-label="Xác nhận xoá bản build" className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-300">Xoá vĩnh viễn bản build này?</span>
            <button
              type="button"
              onClick={() => setMode('idle')}
              disabled={busy}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50"
            >
              {busy ? 'Đang xoá…' : 'Xoá vĩnh viễn'}
            </button>
          </div>
        )}
      </div>

      {mode === 'edit' && (
        <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <label className="block">
            <span className="mb-1 flex justify-between text-xs text-zinc-400">
              <span>Tiêu đề</span>
              <span className="font-mono">{draftTitle.length}/{TITLE_MAX}</span>
            </span>
            <input
              type="text"
              value={draftTitle}
              maxLength={TITLE_MAX}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex justify-between text-xs text-zinc-400">
              <span>Mô tả</span>
              <span className="font-mono">{draftDescription.length}/{DESCRIPTION_MAX}</span>
            </span>
            <textarea
              value={draftDescription}
              maxLength={DESCRIPTION_MAX}
              rows={3}
              onChange={(e) => setDraftDescription(e.target.value)}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={draftPublic}
              onChange={(e) => setDraftPublic(e.target.checked)}
              className="h-4 w-4 accent-cyan-500"
            />
            Công khai (hiện trong danh sách thịnh hành, ai có link đều xem được)
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode('idle')}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Huỷ
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
