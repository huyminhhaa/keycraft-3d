import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SaveBuildModal } from './SaveBuildModal';

describe('SaveBuildModal (src/components/ui/SaveBuildModal.tsx)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('không render khi isOpen = false', () => {
    const { container } = render(<SaveBuildModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('render đầy đủ form khi isOpen = true', () => {
    render(<SaveBuildModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Lưu & Chia sẻ bản build')).toBeDefined();
    expect(screen.getByPlaceholderText(/KeyCraft/)).toBeDefined();
    expect(screen.getByRole('button', { name: /Lưu & Tạo liên kết/ })).toBeDefined();
  });

  it('gửi POST /api/builds và hiển thị link chia sẻ khi submit thành công', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        shareUrl: '/build/ban-phim-deep-thock-1234',
        build: { title: 'Bản Phím Custom' },
      }),
    });

    render(<SaveBuildModal isOpen={true} onClose={vi.fn()} />);

    const titleInput = screen.getByPlaceholderText(/KeyCraft/);
    fireEvent.change(titleInput, { target: { value: 'Bàn Phím Deep Thock Cực Phẩm' } });

    const submitBtn = screen.getByRole('button', { name: /Lưu & Tạo liên kết/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Đã tạo liên kết chia sẻ!')).toBeDefined();
    });

    expect(screen.getByDisplayValue(/ban-phim-deep-thock-1234/)).toBeDefined();
  });

  it('gọi onClose khi nhấn nút đóng', () => {
    const handleClose = vi.fn();
    render(<SaveBuildModal isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByLabelText('Đóng modal');
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
