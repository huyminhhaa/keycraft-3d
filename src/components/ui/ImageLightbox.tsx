'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X, ImageIcon } from 'lucide-react';

export interface LightboxImage {
  src: string;
  name: string;
  size: number;
  mimeType: string;
}

interface ImageLightboxProps {
  image: LightboxImage | null;
  onClose: () => void;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const subscribeNoop = () => () => undefined;

/**
 * Xem ảnh đính kèm toàn màn hình. Render qua portal vào <body>: panel chat nằm trong vùng
 * có transform/overflow nên `position: fixed` bên trong sẽ bị cắt theo khung panel.
 */
export const ImageLightbox: React.FC<ImageLightboxProps> = ({ image, onClose }) => {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  // Chỉ có document ở client; server snapshot = false nên không lệch hydration
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);

  useEffect(() => {
    if (!image) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previousFocus?.focus?.();
    };
  }, [image, onClose]);

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {image && (
        <motion.div
          key="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Xem ảnh ${image.name}`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          onClick={onClose}
        >
          <motion.figure
            className="relative flex max-h-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl"
            initial={reduceMotion ? false : { scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { scale: 0.97, y: 4 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh blob/data cục bộ, next/image không tối ưu được */}
            <img
              src={image.src}
              alt={image.name}
              className="max-h-[78vh] w-auto object-contain"
            />
            <figcaption className="flex items-center gap-3 border-t border-white/10 px-4 py-3 text-[12px] text-zinc-400">
              <ImageIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium text-zinc-200">{image.name}</span>
              <span className="shrink-0 font-mono text-[11px]">{image.mimeType}</span>
              <span className="shrink-0 font-mono text-[11px]">{formatBytes(image.size)}</span>
            </figcaption>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Đóng xem ảnh"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/60 text-zinc-200 backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.figure>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
