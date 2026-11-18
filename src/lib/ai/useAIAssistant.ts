'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { parseSSELines, applyToolToStore, SSEChunkEvent } from './chatStream';
import { useAuthStore } from '@/store/useAuthStore';
import {
  prepareClientAttachment,
  type PreparedAttachment,
} from '@/lib/security/clientFileSanitizer';

export interface ToolExecution {
  id: string;
  toolName: string;
  summary: string;
  input: Record<string, unknown>;
}

export interface ChatAttachmentDisplay {
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'pdf' | 'text';
  previewUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  status?: 'sending' | 'streaming' | 'done' | 'error';
  toolExecutions?: ToolExecution[];
  attachments?: ChatAttachmentDisplay[];
}

export interface ChatSessionItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface UseAIAssistantOptions {
  apiEndpoint?: string;
  initialMessages?: ChatMessage[];
  onToolExecuted?: (summary: string) => void;
}

const MAX_CLIENT_ATTACHMENTS = 3;

export function useAIAssistant(options: UseAIAssistantOptions = {}) {
  const { apiEndpoint = '/api/chat', initialMessages = [], onToolExecuted } = options;

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cloud Chat History state (chỉ kích hoạt khi đã đăng nhập)
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Multimodal Attachments state
  const [pendingAttachments, setPendingAttachments] = useState<PreparedAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshSessions = useCallback(async () => {
    if (!isAuthenticated) {
      setSessions([]);
      return;
    }
    setIsLoadingSessions(true);
    try {
      const res = await fetch('/api/chat/sessions', { credentials: 'same-origin' });
      if (res.ok) {
        const data = (await res.json()) as { sessions?: ChatSessionItem[] };
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      }
    } catch {
      // Bỏ qua lỗi mạng tạm thời
    } finally {
      setIsLoadingSessions(false);
    }
  }, [isAuthenticated]);

  // Tự động đồng bộ lịch sử chat từ server khi user đăng nhập (async subscription, không setState đồng bộ trong effect)
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    let cancelled = false;

    const loadSessions = async () => {
      try {
        const res = await fetch('/api/chat/sessions', { credentials: 'same-origin' });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { sessions?: ChatSessionItem[] };
        if (!cancelled) {
          setSessions(Array.isArray(data.sessions) ? data.sessions : []);
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời
      }
    };

    void loadSessions();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

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
    setActiveSessionId(null);
    setPendingAttachments([]);
    setAttachmentError(null);
    setError(null);
  }, [stopStreaming]);

  const selectSession = useCallback(
    async (sessionId: string) => {
      if (!isAuthenticated) return;
      stopStreaming();
      setError(null);
      setAttachmentError(null);
      try {
        const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
          credentials: 'same-origin',
        });
        if (!res.ok) {
          setError('Không thể tải lại đoạn chat này.');
          return;
        }
        const data = (await res.json()) as {
          session?: {
            id: string;
            messages: Array<{
              id: string;
              role: 'user' | 'assistant';
              content: string;
              attachments?: ChatAttachmentDisplay[];
              toolExecutions?: ToolExecution[];
              createdAt: number;
            }>;
          };
        };
        if (data.session) {
          setActiveSessionId(data.session.id);
          setMessages(
            data.session.messages.map((m) => ({
              ...m,
              status: 'done',
            }))
          );
        }
      } catch {
        setError('Lỗi kết nối khi tải lịch sử trò chuyện.');
      }
    },
    [isAuthenticated, stopStreaming]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!isAuthenticated) return;
      try {
        const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
        if (res.ok) {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          if (activeSessionId === sessionId) {
            setActiveSessionId(null);
            setMessages([]);
          }
        }
      } catch {
        setError('Không thể xóa đoạn chat này.');
      }
    },
    [isAuthenticated, activeSessionId]
  );

  const addAttachments = useCallback(
    async (files: FileList | File[]) => {
      setAttachmentError(null);
      const list = Array.from(files);
      if (list.length === 0) return;

      if (pendingAttachments.length + list.length > MAX_CLIENT_ATTACHMENTS) {
        setAttachmentError(`Chỉ được đính kèm tối đa ${MAX_CLIENT_ATTACHMENTS} tệp cho mỗi tin nhắn.`);
        return;
      }

      const prepared: PreparedAttachment[] = [];
      for (const file of list) {
        try {
          const item = await prepareClientAttachment(file);
          prepared.push(item);
        } catch (err) {
          setAttachmentError(err instanceof Error ? err.message : 'Tệp không hợp lệ.');
        }
      }

      if (prepared.length > 0) {
        setPendingAttachments((prev) => [...prev, ...prepared].slice(0, MAX_CLIENT_ATTACHMENTS));
      }
    },
    [pendingAttachments.length]
  );

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachmentError(null);
  }, []);

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const textToSend = (overrideText ?? input).trim();
      const attachmentsToSend = overrideText ? [] : pendingAttachments;

      if ((!textToSend && attachmentsToSend.length === 0) || isStreaming) return;

      setError(null);
      setAttachmentError(null);
      setInput('');
      if (attachmentsToSend.length > 0) {
        setPendingAttachments([]);
      }

      const userMessageId = `user-${Date.now()}`;
      const assistantMessageId = `asst-${Date.now() + 1}`;

      const displayAttachments: ChatAttachmentDisplay[] = attachmentsToSend.map((a) => ({
        name: a.name,
        mimeType: a.mimeType,
        size: a.size,
        kind: a.kind,
        previewUrl: a.previewUrl,
      }));

      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content: textToSend || (attachmentsToSend.length > 0 ? 'Phân tích tệp đính kèm giúp tôi.' : ''),
        createdAt: Date.now(),
        attachments: displayAttachments.length > 0 ? displayAttachments : undefined,
      };

      const initialAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'streaming',
        toolExecutions: [],
      };

      setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const payloadMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const payloadBody: Record<string, unknown> = {
          messages: payloadMessages,
        };

        if (isAuthenticated && activeSessionId) {
          payloadBody.sessionId = activeSessionId;
        }

        if (attachmentsToSend.length > 0) {
          payloadBody.attachments = attachmentsToSend.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            dataBase64: a.dataBase64,
          }));
        }

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBody),
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

        // Lưu sessionId mới do server cấp (khi user đã đăng nhập)
        const returnedSessionId = response.headers?.get('X-Chat-Session-Id');
        if (returnedSessionId && isAuthenticated) {
          setActiveSessionId(returnedSessionId);
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

            if (event.type === 'error' && typeof event.errorText === 'string') {
              setError(event.errorText);
            }
          });
        }

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

        // Cập nhật danh sách lịch sử chat sau khi stream xong
        if (isAuthenticated && returnedSessionId) {
          void refreshSessions();
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
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
    [
      activeSessionId,
      apiEndpoint,
      input,
      isAuthenticated,
      isStreaming,
      messages,
      onToolExecuted,
      pendingAttachments,
      refreshSessions,
    ]
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
    // ChatGPT / Gemini Cloud History & Multimodal
    isCloudMode: isAuthenticated,
    sessions: isAuthenticated ? sessions : [],
    activeSessionId: isAuthenticated ? activeSessionId : null,
    isLoadingSessions,
    selectSession,
    deleteSession,
    refreshSessions,
    pendingAttachments: isAuthenticated ? pendingAttachments : [],
    attachmentError: isAuthenticated ? attachmentError : null,
    addAttachments,
    removeAttachment,
  };
}
