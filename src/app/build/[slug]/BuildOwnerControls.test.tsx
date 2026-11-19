import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { BuildOwnerControls } from './BuildOwnerControls';

const props = { slug: 'ban-phim-thock-ab12', title: 'Bàn phím thock', description: 'POM plate', isPublic: true };
const okResponse = { ok: true, json: async () => ({ success: true }) } as Response;

describe('BuildOwnerControls', () => {
  beforeEach(() => {
    router.refresh.mockClear();
    router.push.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('sửa tiêu đề + chuyển riêng tư -> gửi PATCH đúng slug rồi làm mới trang', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(okResponse);
    render(<BuildOwnerControls {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    fireEvent.change(screen.getByDisplayValue('Bàn phím thock'), { target: { value: 'Tên mới' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/builds/ban-phim-thock-ab12');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ title: 'Tên mới', description: 'POM plate', isPublic: false });
  });

  it('xoá cần bấm xác nhận lần 2, xong thì về Studio', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(okResponse);
    render(<BuildOwnerControls {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Xoá' }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Xác nhận xoá bản build' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Xoá vĩnh viễn' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/studio'));
    expect(fetchSpy.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('hiện lỗi từ server (vd 403) và không rời trang', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Bạn không có quyền thay đổi bản build này.' }),
    } as Response);
    render(<BuildOwnerControls {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Xoá' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xoá vĩnh viễn' }));

    expect((await screen.findByRole('alert')).textContent).toContain('không có quyền');
    expect(router.push).not.toHaveBeenCalled();
  });
});
