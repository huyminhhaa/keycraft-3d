import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIAssistant } from './useAIAssistant';
import { useKeyboardStore } from '@/store/useKeyboardStore';

describe('useAIAssistant Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useKeyboardStore.getState().resetConfig();
  });

  it('khởi tạo trạng thái mặc định chính xác', () => {
    const { result } = renderHook(() => useAIAssistant());

    expect(result.current.messages).toEqual([]);
    expect(result.current.input).toBe('');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('cập nhật input qua setInput', () => {
    const { result } = renderHook(() => useAIAssistant());

    act(() => {
      result.current.setInput('Tư vấn âm thock');
    });

    expect(result.current.input).toBe('Tư vấn âm thock');
  });

  it('không gửi request nếu input rỗng hoặc chỉ có khoảng trắng', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const { result } = renderHook(() => useAIAssistant());

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('xử lý lỗi khi server trả về HTTP 401 (chưa có API Key)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Chưa cấu hình GOOGLE_GENERATIVE_AI_API_KEY' }),
    } as Response);

    const { result } = renderHook(() => useAIAssistant());

    await act(async () => {
      await result.current.sendMessage('Chào AI');
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toContain('GOOGLE_GENERATIVE_AI_API_KEY');
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].status).toBe('error');
    expect(result.current.messages[1].content).toContain('GOOGLE_GENERATIVE_AI_API_KEY');
  });

  it('nhận stream và kích hoạt tool thay đổi trạng thái 3D store', async () => {
    const streamPayload = [
      'data: {"type":"text-delta","delta":"Tôi sẽ đổi sang plate POM."}\n\n',
      'data: {"type":"tool-input-available","toolCallId":"call-1","toolName":"updateKeyboardConfig","input":{"plateMaterial":"pom","switchType":"linear"}}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(streamPayload));
        controller.close();
      },
    });

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: readableStream,
    } as Response);

    const onToolExecuted = vi.fn();
    const { result } = renderHook(() => useAIAssistant({ onToolExecuted }));

    await act(async () => {
      await result.current.sendMessage('Đổi sang plate POM và switch linear');
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages).toHaveLength(2);

    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.role).toBe('assistant');
    expect(assistantMsg.content).toBe('Tôi sẽ đổi sang plate POM.');
    expect(assistantMsg.toolExecutions).toHaveLength(1);
    expect(assistantMsg.toolExecutions?.[0].toolName).toBe('updateKeyboardConfig');

    // Kiểm tra Zustand store đã được cập nhật tự động!
    expect(useKeyboardStore.getState().plateMaterial).toBe('pom');
    expect(useKeyboardStore.getState().switchType).toBe('linear');
    expect(onToolExecuted).toHaveBeenCalled();
  });

  it('xoá toàn bộ tin nhắn qua clearMessages', () => {
    const { result } = renderHook(() =>
      useAIAssistant({
        initialMessages: [
          { id: '1', role: 'user', content: 'test', createdAt: 123 },
        ],
      })
    );

    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toHaveLength(0);
  });
});
