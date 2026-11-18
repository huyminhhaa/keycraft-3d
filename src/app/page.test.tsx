import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LandingPage from './page';
import { soundEngine } from '@/lib/audio/soundEngine';
import { useSoundStore } from '@/store/useSoundStore';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { KEYBOARD_BUILDS } from '@/lib/keyboard/builds';
import { FEATURED_BUILDS, LANDING_STATS } from '@/lib/ui/landing';

vi.mock('@/lib/audio/soundEngine', () => ({
  soundEngine: {
    playKeySound: vi.fn(),
    playKeyUp: vi.fn(),
    loadPack: vi.fn(async () => null),
    getLoadedPackId: vi.fn(() => null),
    isMuted: vi.fn(() => false),
    getVolume: vi.fn(() => 0.7),
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    initContext: vi.fn(),
  },
}));

// Canvas WebGL không chạy trong jsdom: thay mô hình 3D bằng khung giữ chỗ
vi.mock('@/components/canvas/HeroKeyboard', () => ({ default: () => <div data-testid="hero-3d" /> }));

describe('Trang chủ', () => {
  const selectPack = vi.fn(async () => undefined);

  beforeEach(() => {
    selectPack.mockClear();
    vi.mocked(soundEngine.playKeySound).mockClear();
    useSoundStore.setState({ selectPack });
  });

  it('tiêu đề nói đúng sản phẩm: bàn phím thật trong 3D, tiếng gõ của từng mẫu', () => {
    render(<LandingPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toContain('Bàn phím cơ thật, xem trong 3D.');
    expect(heading.textContent).toContain('Nghe đúng tiếng gõ của từng mẫu.');
  });

  it('số liệu lấy từ thư viện thật: 41 mẫu, số hãng không đếm trùng hoa/thường', () => {
    expect(LANDING_STATS.builds).toBe(KEYBOARD_BUILDS.length);
    expect(LANDING_STATS.brands).toBe(19);
    render(<LandingPage />);
    expect(screen.getAllByText(String(LANDING_STATS.builds)).length).toBeGreaterThan(0);
  });

  it('nút chính dẫn vào Studio', () => {
    render(<LandingPage />);
    const links = screen.getAllByRole('link', { name: /Mở Studio/ });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => expect(link.getAttribute('href')).toBe('/studio'));
  });

  it('không còn thông tin thừa / sai: bảng công nghệ, bảo mật, tiếng tổng hợp, tần số bịa', () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? '';
    ['Công Nghệ Chuẩn Production', 'Brute-Force', 'Drizzle', 'Synth', 'Zero Latency', 'Hz', 'Deep Thock', 'Tạ đồng'].forEach((phrase) =>
      expect(text).not.toContain(phrase)
    );
  });

  it('"Nghe thử" đổi mô hình 3D sang mẫu đó và phát GÓI TIẾNG THẬT của mẫu, không phải tiếng tổng hợp', async () => {
    vi.useFakeTimers();
    render(<LandingPage />);
    const build = FEATURED_BUILDS[2];
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Nghe thử ${build.name}` }));
    });
    expect(useKeyboardStore.getState().buildId).toBe(build.id);
    expect(selectPack).toHaveBeenCalledWith(build.soundPackId);
    act(() => void vi.advanceTimersByTime(2000));
    const calls = vi.mocked(soundEngine.playKeySound).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // Gọi không kèm customConfig = phát bản thu đã nạp
    calls.forEach((call) => expect(call[1]).toBeUndefined());
    vi.useRealTimers();
  });

  it('có mô hình 3D ở hero và đủ thẻ nghe thử', () => {
    render(<LandingPage />);
    expect(screen.getByTestId('hero-3d')).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^Nghe thử / })).toHaveLength(FEATURED_BUILDS.length);
  });
});
