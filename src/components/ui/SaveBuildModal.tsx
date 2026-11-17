'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';

interface SaveBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaveBuildModal({ isOpen, onClose }: SaveBuildModalProps) {
  const keyboardState = useKeyboardStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tạo tiêu đề gợi ý thông minh từ cấu hình hiện tại
  const suggestedTitle = `KeyCraft ${keyboardState.layout} • ${keyboardState.plateMaterial.toUpperCase()} ${keyboardState.soundProfile.label}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const finalTitle = title.trim() || suggestedTitle;

    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          description: description.trim() || undefined,
          config: keyboardState,
          isPublic,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu bản build.');
      }

      setShareUrl(data.shareUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    const fullUrl = `${window.location.origin}${shareUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleResetAndClose = () => {
    setShareUrl(null);
    setTitle('');
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop mờ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleResetAndClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Hộp thoại Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0f12] p-6 shadow-2xl backdrop-blur-xl"
          >
            {/* Nút đóng */}
            <button
              onClick={handleResetAndClose}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
              aria-label="Đóng modal"
            >
              <X className="h-5 w-5" />
            </button>

            {!shareUrl ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Lưu & Chia sẻ bản build</h3>
                    <p className="text-xs text-zinc-400">Tạo liên kết chia sẻ cấu hình 3D cho cộng đồng</p>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Tên bản build
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={suggestedTitle}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Mô tả (tùy chọn)
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Chia sẻ cảm giác gõ, plate, switch hoặc lý do bạn phối màu này..."
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                </div>

                {/* Tóm tắt cấu hình hiện tại */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Layout:</span>
                    <span className="text-zinc-200 font-mono">{keyboardState.layout}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Plate / Switch:</span>
                    <span className="text-zinc-200 font-mono">
                      {keyboardState.plateMaterial.toUpperCase()} • {keyboardState.switchType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Âm sắc ước tính:</span>
                    <span className="text-cyan-400 font-medium">{keyboardState.soundProfile.label}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    Công khai trong Thư viện cộng đồng
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-400 hover:bg-white/5 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-5 py-2 text-xs font-semibold text-black hover:bg-cyan-400 transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      'Đang tạo liên kết...'
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Lưu & Tạo liên kết
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Trạng thái đã sinh link thành công */
              <div className="space-y-4 py-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Check className="h-6 w-6" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white">Đã tạo liên kết chia sẻ!</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Bất kỳ ai có đường link này đều có thể chiêm ngưỡng và remix bản build của bạn.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-left">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}${shareUrl}` : shareUrl}
                    className="w-full bg-transparent px-2 text-xs font-mono text-cyan-300 focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopy}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Đã chép
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Sao chép
                      </>
                    )}
                  </button>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-white/5 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Mở trang bản build
                  </a>
                  <button
                    onClick={handleResetAndClose}
                    className="rounded-xl bg-white/10 px-5 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors"
                  >
                    Xong
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
