import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AIChatPanel } from './AIChatPanel';
import { useKeyboardStore } from '@/store/useKeyboardStore';

describe('AIChatPanel Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useKeyboardStore.getState().resetConfig();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('hiển thị tiêu đề và danh sách 4 gợi ý câu hỏi nhanh', () => {
    render(<AIChatPanel />);

    expect(screen.getByText('Kiến trúc sư âm học AI')).toBeDefined();
    expect(screen.getByText('Âm Thock sâu ấm')).toBeDefined();
    expect(screen.getByText('Âm Clack đanh giòn')).toBeDefined();
    expect(screen.getByText('Tách lớp linh kiện 3D')).toBeDefined();
    expect(screen.getByText('Gõ êm cho văn phòng')).toBeDefined();
  });

  it('cho phép nhập text và gửi câu hỏi qua ô input', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode('data: {"type":"text-delta","delta":"Chào bạn, tôi là AI."}\n\n'));
          controller.close();
        },
      }),
    } as Response);

    render(<AIChatPanel />);

    const input = screen.getByPlaceholderText(/Hỏi về âm học hoặc yêu cầu/);
    fireEvent.change(input, { target: { value: 'Tư vấn phím thock' } });

    const submitBtn = screen.getByRole('button', { name: 'Gửi yêu cầu' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
      expect(screen.getByText('Tư vấn phím thock')).toBeDefined();
    });
  });

  it('gửi nhanh câu hỏi khi nhấn vào chip gợi ý', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode('data: {"type":"text-delta","delta":"Đang phân tích âm thock..."}\n\n'));
          controller.close();
        },
      }),
    } as Response);

    render(<AIChatPanel />);

    const thockChip = screen.getByRole('button', { name: /Âm Thock sâu ấm/ });
    fireEvent.click(thockChip);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  it('chạy demo biến đổi 3D khi bấm nút Demo Mode khi thiếu API Key', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Chưa cấu hình GOOGLE_GENERATIVE_AI_API_KEY' }),
    } as Response);

    render(<AIChatPanel />);

    const input = screen.getByPlaceholderText(/Hỏi về âm học hoặc yêu cầu/);
    fireEvent.change(input, { target: { value: 'Alo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    await waitFor(() => {
      expect(screen.getByText('Chưa có Google Gemini API Key')).toBeDefined();
    });

    // Bấm nút Set Thock trong khối Demo
    const setThockBtn = screen.getByRole('button', { name: 'Set Thock' });
    fireEvent.click(setThockBtn);

    const state = useKeyboardStore.getState();
    expect(state.plateMaterial).toBe('pom');
    expect(state.switchType).toBe('linear');
    expect(state.layout).toBe('75%');
  });
});
