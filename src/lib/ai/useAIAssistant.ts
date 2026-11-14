'use client';

import { useState, useRef, useCallback } from 'react';
import { parseSSELines, applyToolToStore, SSEChunkEvent } from './chatStream';

export interface ToolExecution {
  id: string;
  toolName: string;
  summary: string;
  input: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  status?: 'sending' | 'streaming' | 'done' | 'error';
  toolExecutions?: ToolExecution[];
}

export interface UseAIAssistantOptions {
  apiEndpoint?: string;
  initialMessages?: ChatMessage[];
  onToolExecuted?: (summary: string) => void;
}

export function useAIAssistant(options: UseAIAssistantOptions = {}) {
  const { apiEndpoint = '/api/chat', initialMessages = [], onToolExecuted } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setError(null);
  }, [stopStreaming]);

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const textToSend = (overrideText ?? input).trim();
      if (!textToSend || isStreaming) return;

      setError(null);
      setInput('');

      const userMessageId = `user-${Date.now()}`;
      const assistantMessageId = `asst-${Date.now() + 1}`;

      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content: textToSend,
        createdAt: Date.now(),
      };

      const initialAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'streaming',
        toolExecutions: [],
      };

      // Cập nhật tin nhắn hiển thị ngay lập tức
      setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Chuẩn bị danh sách tin nhắn gửi lên API
        const payloadMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: payloadMessages }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error || `Lỗi kết nối (${response.status}): Không thể hoàn tất yêu cầu.`;

          setError(errorMessage);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: errorMessage,
                    status: 'error',
                  }
                : m
            )
          );
          setIsStreaming(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Không thể đọc dữ liệu phản hồi dạng stream từ server.');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let assistantContent = '';
        const currentToolExecutions: ToolExecution[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          buffer = parseSSELines(buffer, (event: SSEChunkEvent) => {
            // 1. Nhận nội dung văn bản đang stream
            if (event.type === 'text-delta' && typeof event.delta === 'string') {
              assistantContent += event.delta;

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content: assistantContent,
                        status: 'streaming',
                      }
                    : m
                )
              );
            }

            // 2. Nhận lệnh gọi công cụ từ AI -> Áp dụng ngay vào Zustand Store
            if (
              event.type === 'tool-input-available' &&
              typeof event.toolName === 'string' &&
              event.input &&
              typeof event.input === 'object'
            ) {
              const toolInput = event.input as Record<string, unknown>;
              const result = applyToolToStore(event.toolName, toolInput);

              const execution: ToolExecution = {
                id: (event.toolCallId as string) || `tool-${Date.now()}`,
                toolName: event.toolName,
                summary: result.summary,
                input: toolInput,
              };

              currentToolExecutions.push(execution);
              onToolExecuted?.(result.summary);

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        toolExecutions: [...currentToolExecutions],
                      }
                    : m
                )
              );
            }

            // 3. Xử lý lỗi trả về trong stream
            if (event.type === 'error' && typeof event.errorText === 'string') {
              setError(event.errorText);
            }
          });
        }

        // Hoàn tất stream thành công
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: assistantContent || 'Đã hoàn tất cấu hình theo yêu cầu của bạn.',
                  status: 'done',
                  toolExecutions: currentToolExecutions,
                }
              : m
          )
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Người dùng chủ động huỷ stream
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    status: 'done',
                  }
                : m
            )
          );
        } else {
          const msg =
            err instanceof Error ? err.message : 'Đã xảy ra sự cố không xác định khi kết nối với AI.';
          setError(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: msg,
                    status: 'error',
                  }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [apiEndpoint, input, isStreaming, messages, onToolExecuted]
  );

  return {
    messages,
    input,
    setInput,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  };
}
