'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  Send,
  Square,
  Sparkles,
  RefreshCw,
  Cpu,
  Layers,
  Paperclip,
  History,
  Plus,
  Trash2,
  X,
  FileText,
  Image as ImageIcon,
  Lock,
} from 'lucide-react';
import { useAIAssistant } from '@/lib/ai/useAIAssistant';
import { AcousticWaveform } from './AcousticWaveform';
import { applyToolToStore } from '@/lib/ai/chatStream';
import { useAuthStore } from '@/store/useAuthStore';

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

const ACCEPTED_FILE_TYPES = '.jpg,.jpeg,.png,.webp,.pdf,.txt,.md,.json,.csv';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
    isCloudMode,
    sessions,
    activeSessionId,
    isLoadingSessions,
    selectSession,
    deleteSession,
    pendingAttachments,
    attachmentError,
    addAttachments,
    removeAttachment,
  } = useAIAssistant();

  const openAuthModal = useAuthStore((s) => s.openModal);
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && pendingAttachments.length === 0) || isStreaming) return;
    void sendMessage();
  };

  const handleSuggestionClick = (prompt: string) => {
    void sendMessage(prompt);
  };

  const handleAttachmentButtonClick = () => {
    if (!isCloudMode) {
      openAuthModal(
        'login',
        'Đăng nhập bằng Google hoặc tài khoản KeyCraft để gửi ảnh/tệp phân tích và lưu lịch sử trò chuyện.'
      );
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void addAttachments(e.target.files);
      e.target.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!isCloudMode) return;
    const files: File[] = [];
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void addAttachments(files);
    }
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
  const canSend = Boolean(input.trim() || pendingAttachments.length > 0);

  return (
    <div className="flex h-full flex-col">
      {/* 1. Header & Live Acoustic Telemetry */}
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ink" aria-hidden />
            <h2 className="text-[13px] font-medium text-ink">Kiến trúc sư âm học AI</h2>
          </div>

          <div className="flex items-center gap-1.5">
            {isCloudMode && (
              <>
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  aria-label="Lịch sử trò chuyện"
                  className={`btn-press flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors ${
                    showHistory
                      ? 'border-ink bg-ink text-canvas'
                      : 'border-line bg-surface text-muted hover:text-ink'
                  }`}
                >
                  <History className="h-3 w-3" />
                  <span>Lịch sử ({sessions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setShowHistory(false);
                  }}
                  aria-label="Đoạn chat mới"
                  title="Đoạn chat mới"
                  className="btn-press flex items-center gap-1 rounded border border-line bg-surface px-2 py-1 text-[11px] text-muted hover:text-ink"
                >
                  <Plus className="h-3 w-3" />
                  <span>Mới</span>
                </button>
              </>
            )}

            {!isCloudMode && messages.length > 0 && (
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
        </div>

        {/* Khách: nhắc đăng nhập để lưu lịch sử. Đã đăng nhập thì không hiện thẻ trạng thái */}
        {!isCloudMode && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-line bg-surface-2/70 px-2.5 py-1.5 text-[11px] text-muted">
            <span className="leading-snug">
              Đoạn chat tạm thời · Đăng nhập để lưu lịch sử & gửi ảnh/tệp
            </span>
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="btn-press shrink-0 rounded bg-ink px-2 py-0.5 text-[11px] font-medium text-canvas hover:opacity-90"
            >
              Đăng nhập
            </button>
          </div>
        )}

        {/* Drawer lịch sử đoạn chat đã lưu trên PostgreSQL */}
        {isCloudMode && showHistory && (
          <div className="mt-2.5 max-h-44 overflow-y-auto rounded-lg border border-line bg-canvas p-1.5 scroll-thin">
            {isLoadingSessions ? (
              <p className="px-2 py-3 text-center text-[11px] text-muted">Đang tải lịch sử...</p>
            ) : sessions.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-muted">
                Chưa có đoạn chat nào được lưu. Hãy gửi câu hỏi đầu tiên!
              </p>
            ) : (
              <ul className="space-y-1">
                {sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <li
                      key={s.id}
                      className={`group flex items-center justify-between gap-1 rounded px-2 py-1.5 text-[12px] transition-colors ${
                        isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:bg-surface hover:text-ink'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          void selectSession(s.id);
                          setShowHistory(false);
                        }}
                        className="flex-1 truncate text-left"
                        title={s.title}
                      >
                        {s.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteSession(s.id)}
                        aria-label={`Xóa đoạn chat ${s.title}`}
                        className="shrink-0 rounded p-1 text-faint opacity-70 hover:bg-red-500/15 hover:text-red-400 hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

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
                  {/* Hiển thị ảnh/tệp đính kèm trong tin nhắn */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {msg.attachments.map((att, idx) =>
                        att.kind === 'image' && att.previewUrl ? (
                          <div
                            key={`${att.name}-${idx}`}
                            className="overflow-hidden rounded-md border border-black/15"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={att.previewUrl}
                              alt={att.name}
                              className="max-h-28 max-w-[160px] object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            key={`${att.name}-${idx}`}
                            className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] ${
                              isUser
                                ? 'bg-canvas/15 text-canvas'
                                : 'border border-line bg-surface-2 text-ink'
                            }`}
                          >
                            {att.kind === 'image' ? (
                              <ImageIcon className="h-3 w-3 shrink-0" />
                            ) : (
                              <FileText className="h-3 w-3 shrink-0" />
                            )}
                            <span className="max-w-[130px] truncate">{att.name}</span>
                            <span className="opacity-70">{formatBytes(att.size)}</span>
                          </div>
                        )
                      )}
                    </div>
                  )}

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

      {/* 3. Input Form + Multimodal Attachment Tray */}
      <form onSubmit={handleSubmit} className="border-t border-line p-3">
        {/* Cảnh báo lỗi file từ Client Guard */}
        {attachmentError && (
          <div className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400">
            {attachmentError}
          </div>
        )}

        {/* Xem trước ảnh/tệp đang chờ gửi */}
        {pendingAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pendingAttachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-ink"
              >
                {att.kind === 'image' && att.previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    className="h-6 w-6 rounded object-cover"
                  />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-muted" />
                )}
                <span className="max-w-[110px] truncate">{att.name}</span>
                <span className="text-[10px] text-faint">{formatBytes(att.size)}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  aria-label={`Gỡ ${att.name}`}
                  className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileChange}
          className="hidden"
          aria-label="Chọn ảnh hoặc tệp đính kèm"
        />

        <div className="relative flex items-center">
          <button
            type="button"
            onClick={handleAttachmentButtonClick}
            disabled={isStreaming}
            aria-label={isCloudMode ? 'Đính kèm ảnh hoặc tệp' : 'Đăng nhập để đính kèm ảnh hoặc tệp'}
            title={
              isCloudMode
                ? 'Đính kèm ảnh (JPG/PNG/WebP) hoặc tệp (PDF/TXT/JSON/MD/CSV, tối đa 4MB)'
                : 'Đăng nhập để gửi ảnh/tệp phân tích'
            }
            className="btn-press absolute left-1.5 flex h-7 w-7 items-center justify-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            {isCloudMode ? <Paperclip className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            disabled={isStreaming}
            placeholder={
              isCloudMode
                ? 'Hỏi AI, dán ảnh bàn phím (Ctrl+V) hoặc gửi file...'
                : 'Hỏi về âm học hoặc yêu cầu cấu hình...'
            }
            className="w-full rounded-md border border-line bg-surface py-2.5 pl-10 pr-11 text-[13px] text-ink placeholder:text-muted focus:border-ink focus:outline-none disabled:opacity-50"
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
              disabled={!canSend}
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
