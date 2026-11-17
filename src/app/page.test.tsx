import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingPage from './page';
import { soundEngine } from '@/lib/audio/soundEngine';

vi.mock('@/lib/audio/soundEngine', () => ({
  soundEngine: {
    playKeySound: vi.fn(),
    isMuted: vi.fn(() => false),
    getVolume: vi.fn(() => 0.7),
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    initContext: vi.fn(),
  },
}));

describe('LandingPage (Home Page)', () => {
  it('render giao diện trang chủ không lỗi và có tiêu đề H1', () => {
    render(<LandingPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeDefined();
    expect(heading.textContent).toContain('Kiến tạo Bàn phím cơ 3D');
  });

  it('hiển thị nút CTA điều hướng vào Studio 3D', () => {
    render(<LandingPage />);
    const studioLinks = screen.getAllByRole('link', { name: /Studio 3D/i });
    expect(studioLinks.length).toBeGreaterThan(0);
    expect(studioLinks[0].getAttribute('href')).toBe('/studio');
  });

  it('kích hoạt phát âm thanh khi bấm nút demo phím', () => {
    render(<LandingPage />);
    const testButton = screen.getAllByText('Deep Thock')[0];
    fireEvent.click(testButton);

    expect(soundEngine.playKeySound).toHaveBeenCalled();
  });

  it('hiển thị đầy đủ các khối tính năng Bento Grid', () => {
    render(<LandingPage />);
    expect(screen.getByText('Mô phỏng 7 tầng cấu trúc & Tách lớp 3D')).toBeDefined();
    expect(screen.getByText('Tiếng gõ thu từ phím thật')).toBeDefined();
    expect(screen.getByText('Trợ lý AI Kiến trúc sư')).toBeDefined();
    expect(screen.getByText('Bảo Mật Enterprise & Lá Chắn Brute-Force')).toBeDefined();
  });
});
