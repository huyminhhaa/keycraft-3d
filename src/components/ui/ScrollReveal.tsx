'use client';

import { useEffect } from 'react';

/** Phần tử đã vào khung nhìn chưa: ít nhất 15% diện tích, tính từ cách đáy màn hình 8% */
export const REVEAL_OBSERVER_OPTIONS: IntersectionObserverInit = { threshold: 0.15, rootMargin: '0px 0px -8% 0px' };

/**
 * Hiệu ứng trượt vào khi cuộn tới: gắn `data-reveal="left"` hoặc `"right"` lên phần tử
 * (thêm `style={{ '--reveal-delay': '120ms' }}` để so le). Mỗi phần tử chạy đúng một lần.
 *
 * Trạng thái ẩn chỉ bật khi script đã chạy (class `reveal-ready` trên <html>), nên tắt JavaScript
 * hay trình duyệt không có IntersectionObserver thì nội dung vẫn hiện đủ. Giảm chuyển động: xem globals.css.
 */
export const ScrollReveal: React.FC = () => {
  useEffect(() => {
    const root = document.documentElement;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, REVEAL_OBSERVER_OPTIONS);

    document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));
    root.classList.add('reveal-ready');

    return () => {
      observer.disconnect();
      root.classList.remove('reveal-ready');
    };
  }, []);

  return null;
};
