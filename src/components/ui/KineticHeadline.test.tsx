import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { KineticHeadline } from './KineticHeadline';
import { HeroOverlay } from './HeroOverlay';
import { useKeyboardStore } from '@/store/useKeyboardStore';

describe('KineticHeadline', () => {
  it('đặt câu đầy đủ làm accessible name của h1', () => {
    render(<KineticHeadline lines={[{ text: 'Điêu khắc âm thanh' }, { text: 'từng phím gõ.', accent: true }]} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.getAttribute('aria-label')).toBe('Điêu khắc âm thanh từng phím gõ.');
  });

  it('tách mỗi từ thành một mặt nạ riêng và tô gradient cho dòng accent', () => {
    const { container } = render(
      <KineticHeadline lines={[{ text: 'Một hai' }, { text: 'ba', accent: true }]} />
    );
    const words = container.querySelectorAll('h1 > span > span > span');
    expect(Array.from(words).map((w) => w.textContent)).toEqual(['Một', 'hai', 'ba']);
    expect(container.querySelectorAll('.text-gradient-aurora')).toHaveLength(1);
  });
});

describe('HeroOverlay', () => {
  beforeEach(() => {
    useKeyboardStore.getState().resetConfig();
  });

  it('hiển thị badge, tiêu đề và phụ đề', () => {
    render(<HeroOverlay />);
    expect(screen.getByText('Precision Acoustic Studio')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('aria-label')).toMatch(/từng phím gõ/);
    expect(screen.getByText(/Hồ sơ âm học đổi ngay/)).toBeDefined();
  });
});
