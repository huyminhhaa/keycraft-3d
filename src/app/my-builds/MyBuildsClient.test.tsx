import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { MyBuildsClient, type MyBuild } from './MyBuildsClient';
import { INITIAL_KEYBOARD_STATE } from '@/store/useKeyboardStore';

const config = { ...INITIAL_KEYBOARD_STATE, buildId: null };

const builds: MyBuild[] = [
  {
    slug: 'thock-den-ab12',
    title: 'Thock đen',
    description: 'POM plate',
    isPublic: true,
    viewCount: 12,
    forkCount: 1,
    createdAt: '2026-11-18T10:00:00Z',
    config,
  },
  {
    slug: 'clack-bi-mat-cd34',
    title: 'Clack bí mật',
    description: null,
    isPublic: false,
    viewCount: 0,
    forkCount: 0,
    createdAt: '2026-11-19T10:00:00Z',
    config,
  },
];

const ok = { ok: true, json: async () => ({ success: true }) } as Response;
const cardOf = (title: string) => screen.getByRole('heading', { name: title }).closest('article') as HTMLElement;

describe('MyBuildsClient (trang Bản build của tôi)', () => {
  beforeEach(() => {
    router.push.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hiện số lượng, mỗi build một thẻ, mới nhất trước', () => {
    render(<MyBuildsClient builds={builds} userName="Minh" />);
    expect(screen.getByText(/bạn có 2 bản build · 1 công khai, 1 riêng tư/)).toBeDefined();
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Clack bí mật', 'Thock đen']);
  });

  it('tìm kiếm không dấu và lọc riêng tư', () => {
    render(<MyBuildsClient builds={builds} userName="Minh" />);
    fireEvent.change(screen.getByPlaceholderText(/Tìm theo tên/), { target: { value: 'thock den' } });
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Thock đen']);

    fireEvent.change(screen.getByPlaceholderText(/Tìm theo tên/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('radio', { name: /Riêng tư/ }));
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Clack bí mật']);
  });

  it('đổi sang riêng tư: cập nhật ngay, gửi PATCH; server lỗi thì trả lại như cũ', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Thao tác quá nhanh.' }) } as Response);
    render(<MyBuildsClient builds={builds} userName="Minh" />);

    const card = cardOf('Thock đen');
    fireEvent.click(within(card).getByRole('button', { name: 'Chuyển sang riêng tư' }));
    expect(within(card).getByText('Riêng tư')).toBeDefined();
    await waitFor(() => expect(screen.getByText(/giờ là riêng tư/)).toBeDefined());
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/builds/thock-den-ab12');
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({ isPublic: false });

    // Lần 2 server từ chối -> giữ nguyên trạng thái trước đó
    fireEvent.click(within(card).getByRole('button', { name: 'Chuyển sang công khai' }));
    await waitFor(() => expect(screen.getByText('Thao tác quá nhanh.')).toBeDefined());
    expect(within(card).getByText('Riêng tư')).toBeDefined();
  });

  it('xoá cần xác nhận trên thẻ, xong thì thẻ biến mất', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(ok);
    render(<MyBuildsClient builds={builds} userName="Minh" />);

    const card = cardOf('Clack bí mật');
    fireEvent.click(within(card).getByRole('button', { name: 'Xoá bản build' }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.click(within(card).getByRole('button', { name: 'Xoá' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Clack bí mật' })).toBeNull());
    expect(fetchSpy.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('"Mở trong Studio" nạp cấu hình rồi chuyển tới /studio', () => {
    render(<MyBuildsClient builds={builds} userName="Minh" />);
    fireEvent.click(within(cardOf('Thock đen')).getByRole('button', { name: 'Mở trong Studio' }));
    expect(router.push).toHaveBeenCalledWith('/studio');
  });

  it('chưa có build nào: hướng dẫn cách lưu', () => {
    render(<MyBuildsClient builds={[]} userName="Minh" />);
    expect(screen.getByText('Chưa có bản build nào')).toBeDefined();
    expect(screen.queryByPlaceholderText(/Tìm theo tên/)).toBeNull();
  });
});
