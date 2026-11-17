import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ScrollReveal } from './ScrollReveal';

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

describe('ScrollReveal', () => {
  let trigger: Callback = () => undefined;
  const unobserve = vi.fn();
  const original = globalThis.IntersectionObserver;

  beforeEach(() => {
    class FakeObserver {
      constructor(callback: Callback) {
        trigger = callback;
      }
      observe = vi.fn();
      unobserve = unobserve;
      disconnect = vi.fn();
    }
    globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = original;
  });

  it('chỉ bật trạng thái ẩn khi script đã chạy, gỡ ra khi rời trang', () => {
    const { unmount } = render(<ScrollReveal />);
    expect(document.documentElement.classList.contains('reveal-ready')).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains('reveal-ready')).toBe(false);
  });

  it('phần tử vào khung nhìn thì hiện và chỉ chạy một lần', () => {
    const target = document.createElement('div');
    target.dataset.reveal = 'left';
    document.body.appendChild(target);
    render(<ScrollReveal />);

    trigger([{ target, isIntersecting: false }]);
    expect(target.classList.contains('is-revealed')).toBe(false);
    trigger([{ target, isIntersecting: true }]);
    expect(target.classList.contains('is-revealed')).toBe(true);
    expect(unobserve).toHaveBeenCalledWith(target);
    target.remove();
  });
});
