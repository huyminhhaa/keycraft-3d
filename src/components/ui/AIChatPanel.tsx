'use client';

import React, { useRef, useEffect } from 'react';
import { Send, Square, Sparkles, RefreshCw, Cpu, Layers } from 'lucide-react';
import { useAIAssistant } from '@/lib/ai/useAIAssistant';
import { AcousticWaveform } from './AcousticWaveform';
import { applyToolToStore } from '@/lib/ai/chatStream';

const PROMPT_SUGGESTIONS = [
  {
    id: 'thock',
    label: 'Âm Thock sâu ấm',
    prompt: 'Hãy cấu hình bàn phím để có âm Thock trầm ấm và ngân sâu nhất.',
  },
  {
    id: 'clack',
    label: 'Âm Clack đanh giòn',
    prompt: 'Hãy chọn vỏ nhôm, plate nhôm và switch clicky để tạo âm Clack đanh giòn.',
  },
  {
    id: 'exploded',
    label: 'Tách lớp linh kiện 3D',
    prompt: 'Hãy bung tách lớp 3D để tôi nhìn rõ 7 tầng phần cứng bên trong bàn phím.',
  },
  {
    id: 'silent',
    label: 'Gõ êm cho văn phòng',
    prompt: 'Tôi cần bàn phím gõ êm cho văn phòng yên tĩnh, hãy gợi ý cấu hình phù hợp.',
  },
];

export const AIChatPanel: React.FC = () => {
  const {
    messages,
    input,
    setInput,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  } = useAIAssistant();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage();
  };

  const handleSuggestionClick = (prompt: string) => {
    sendMessage(prompt);
  };

  // Hỗ trợ chế độ thử nghiệm Demo khi chưa gắn Gemini API Key
  const handleSimulateDemo = (type: 'thock' | 'clack' | 'exploded') => {
    if (type === 'thock') {
      applyToolToStore('updateKeyboardConfig', {
        layout: '75%',
        plateMaterial: 'pom',
        switchType: 'linear',
        caseColor: '#1d1d20',
      });
    } else if (type === 'clack') {
      applyToolToStore('updateKeyboardConfig', {
        layout: 'TKL',
        plateMaterial: 'aluminum',
        switchType: 'clicky',
        caseColor: '#b3141f',
      });
    } else if (type === 'exploded') {
      applyToolToStore('toggleExplodedView', {
        isExploded: true,
        explosionOffset: 1.8,
      });
    }
  };

  const isMissingKey = error?.includes('GOOGLE_GENERATIVE_AI_API_KEY');

  return (
    <div className="flex h-full flex-col">
      {/* 1. Header & Live Acoustic Telemetry */}
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ink" aria-hidden />
            <h2 className="text-[13px] font-medium text-ink">Kiến trúc sư âm học AI</h2>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearMessages}
              aria-label="Xoá cuộc trò chuyện"
              className="btn-press flex items-center gap-1 text-[11px] text-muted hover:text-ink"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Làm mới</span>
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          Yêu cầu AI tư vấn chất âm mong muốn và tự động biến đổi mô hình bàn phím 3D thời gian thực.
        </p>

        <div className="mt-3">
          <AcousticWaveform isStreaming={isStreaming} />
        </div>
      </div>

      {/* 2. Chat Stream & Message History */}
      <div
        role="log"
        aria-label="Lịch sử đối thoại với AI"
        className="scroll-thin flex-1 overflow-y-auto px-5 py-4 space-y-3.5"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-[12px] font-medium text-muted">Gợi ý câu hỏi nhanh:</p>
            <div className="grid gap-1.5">
              {PROMPT_SUGGESTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSuggestionClick(item.prompt)}
                  className="btn-press flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-left text-[12px] text-ink transition-colors hover:border-ink/50 hover:bg-surface-2"
                >
                  <span>{item.label}</span>
                  <span className="text-[11px] text-muted">Gửi →</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    isUser
                      ? 'bg-ink font-medium text-canvas'
                      : 'border border-line bg-surface text-ink'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Hiển thị danh sách Tool Execution khi AI điều khiển 3D Canvas */}
                  {msg.toolExecutions && msg.toolExecutions.length > 0 && (
                    <div className="mt-2.5 flex flex-col gap-1.5 border-t border-line/60 pt-2">
                      {msg.toolExecutions.map((exec) => (
                        <div
                          key={exec.id}
                          className="flex items-center gap-1.5 rounded bg-surface-2/80 px-2 py-1 text-[11px] text-ink"
                        >
                          {exec.toolName === 'toggleExplodedView' ? (
                            <Layers className="h-3 w-3 text-muted" aria-hidden />
                          ) : (
                            <Cpu className="h-3 w-3 text-muted" aria-hidden />
                          )}
                          <span className="font-medium">{exec.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.status === 'streaming' && !msg.content && (
                    <div className="flex items-center gap-1 py-1" aria-label="AI đang suy nghĩ">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink [animation-delay:0.2s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink [animation-delay:0.4s]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Thông báo nếu thiếu API Key kèm nút chạy thử nghiệm Demo */}
        {isMissingKey && (
          <div className="rounded-lg border border-line bg-surface-2 p-3 text-[12px] text-muted">
            <p className="font-medium text-ink">Chưa có Google Gemini API Key</p>
            <p className="mt-1 leading-relaxed">
              Thêm <code className="rounded bg-canvas px-1 py-0.5 text-ink">GOOGLE_GENERATIVE_AI_API_KEY</code> vào file <code className="rounded bg-canvas px-1 py-0.5 text-ink">.env.local</code> để mở khoá toàn bộ tính năng trò chuyện trực tiếp.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-faint">Thử đổi phím ngay:</span>
              <button
                type="button"
                onClick={() => handleSimulateDemo('thock')}
                className="btn-press rounded border border-line bg-surface px-2 py-0.5 text-[11px] text-ink hover:bg-surface-2"
              >
                Set Thock
              </button>
              <button
                type="button"
                onClick={() => handleSimulateDemo('clack')}
                className="btn-press rounded border border-line bg-surface px-2 py-0.5 text-[11px] text-ink hover:bg-surface-2"
              >
                Set Clack
              </button>
              <button
                type="button"
                onClick={() => handleSimulateDemo('exploded')}
                className="btn-press rounded border border-line bg-surface px-2 py-0.5 text-[11px] text-ink hover:bg-surface-2"
              >
                Tách lớp 3D
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-line p-3">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder="Hỏi về âm học hoặc yêu cầu cấu hình..."
            className="w-full rounded-md border border-line bg-surface py-2.5 pl-3 pr-11 text-[13px] text-ink placeholder:text-muted focus:border-ink focus:outline-none disabled:opacity-50"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              aria-label="Dừng sinh phản hồi"
              className="btn-press absolute right-1.5 flex h-7 w-7 items-center justify-center rounded bg-surface-2 text-ink hover:bg-line"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Gửi yêu cầu"
              className="btn-press absolute right-1.5 flex h-7 w-7 items-center justify-center rounded bg-ink text-canvas hover:bg-ink/90 disabled:opacity-30 disabled:hover:bg-ink"
            >
              <Send className="h-3 w-3" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
