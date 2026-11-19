import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageLightbox, formatBytes } from './ImageLightbox';

const image = { src: 'blob:http://localhost/abc', name: 'aula-f75.jpg', size: 245_760, mimeType: 'image/jpeg' };

describe('ImageLightbox', () => {
  it('không hiển thị khi chưa chọn ảnh', () => {
    render(<ImageLightbox image={null} onClose={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hiện ảnh toàn màn hình kèm tên, loại và dung lượng tệp', () => {
    render(<ImageLightbox image={image} onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Xem ảnh aula-f75.jpg' })).toBeDefined();
    expect(screen.getByAltText('aula-f75.jpg')).toBeDefined();
    expect(screen.getByText('image/jpeg')).toBeDefined();
    expect(screen.getByText('240.0 KB')).toBeDefined();
  });

  it('đóng bằng nút X, phím Escape hoặc bấm ra nền', () => {
    const onClose = vi.fn();
    render(<ImageLightbox image={image} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Đóng xem ảnh' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
