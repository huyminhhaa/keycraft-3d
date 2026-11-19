'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Send,
  Square,
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
  Maximize2,
  Minimize2,
  ScanEye,
  AlertTriangle,
} from 'lucide-react';
import { useAIAssistant, type ChatMessage, type ChatAttachmentDisplay } from '@/lib/ai/useAIAssistant';
import { AcousticWaveform } from './AcousticWaveform';
import { applyToolToStore } from '@/lib/ai/chatStream';
import { useAuthStore } from '@/store/useAuthStore';
import { useStageStore } from '@/store/useStageStore';
import { MarkdownMessage } from './MarkdownMessage';
import { ImageLightbox, formatBytes, type LightboxImage } from './ImageLightbox';

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

/** Dấu hiệu trợ lý: một keycap nhìn từ trên xuống (cùng ngôn ngữ với logo KeyCraft), đơn sắc */
const AssistantAvatar: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    aria-hidden
    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink transition-opacity ${
      active ? 'opacity-60' : ''
    }`}
  >
    <svg width="14" height="14" viewBox="0 0 22 22">
      <rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="5.5" y="4.5" width="11" height="10" rx="2.5" fill="currentColor" />
    </svg>
  </span>
);

interface AttachmentGridProps {
  attachments: ChatAttachmentDisplay[];
  analyzed: boolean;
  onOpen: (image: LightboxImage) => void;
}

/** Ảnh đính kèm dạng thẻ 16:9 bo góc + badge trạng thái; tệp khác hiện dạng chip */
const AttachmentGrid: React.FC<AttachmentGridProps> = ({ attachments, analyzed, onOpen }) => (
  <div className="mb-2 flex flex-wrap justify-end gap-2">
    {attachments.map((att, idx) =>
      att.kind === 'image' && att.previewUrl ? (
        <button
          key={`${att.name}-${idx}`}
          type="button"
          onClick={() =>
            onOpen({ src: att.previewUrl as string, name: att.name, size: att.size, mimeType: att.mimeType })
          }
          aria-label={`Phóng to ảnh ${att.name}`}
          className="group relative h-36 w-56 max-w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-lg transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/50 motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh blob cục bộ đã qua sanitizer */}
          <img src={att.previewUrl} alt={att.name} className="h-full w-full object-cover" />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />
          <span
            className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-md ${
              analyzed
                ? 'border-emerald-300/25 bg-emerald-400/15 text-emerald-200'
                : 'border-white/15 bg-black/40 text-zinc-200'
            }`}
          >
            <ScanEye className="h-3 w-3" aria-hidden />
            {analyzed ? 'Đã phân tích đa phương thức' : 'Ảnh tham khảo'}
          </span>
          <span className="absolute inset-x-2 bottom-1.5 flex items-center justify-between gap-2 text-[10px] text-zinc-200">
            <span className="truncate">{att.name}</span>
            <span className="shrink-0 font-mono opacity-80">{formatBytes(att.size)}</span>
          </span>
        </button>
      ) : (
        <div
          key={`${att.name}-${idx}`}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] text-zinc-200"
        >
          {att.kind === 'image' ? (
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          ) : (
            <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          )}
          <span className="max-w-[160px] truncate">{att.name}</span>
          <span className="font-mono text-[10px] text-zinc-500">{formatBytes(att.size)}</span>
        </div>
      )
    )}
  </div>
);

interface MessageBubbleProps {
  msg: ChatMessage;
  analyzed: boolean;
  onOpenImage: (image: LightboxImage) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, analyzed, onOpenImage }) => {
  const reduceMotion = useReducedMotion();
  const isUser = msg.role === 'user';
  const isError = msg.status === 'error';
  const isThinking = msg.status === 'streaming' && !msg.content;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && <AssistantAvatar active={msg.status === 'streaming'} />}

      {/* Tin AI chiếm hết bề rộng còn lại (đọc thoải mái ở chế độ Focus); tin người dùng co theo nội dung */}
      <div className={`flex min-w-0 flex-col ${isUser ? 'max-w-[85%] items-end' : 'flex-1 items-start'}`}>
        {msg.attachments && msg.attachments.length > 0 && (
          <AttachmentGrid attachments={msg.attachments} analyzed={analyzed} onOpen={onOpenImage} />
        )}

        <div
          className={
            isUser
              ? 'rounded-2xl rounded-tr-sm border border-white/10 bg-zinc-800/60 px-3.5 py-2.5 text-[13px] leading-relaxed text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_8px_24px_-12px_rgba(0,0,0,0.6)]'
              : isError
                ? 'rounded-2xl rounded-tl-sm border border-red-400/25 bg-red-500/[0.08] px-3.5 py-2.5 text-[13px] leading-relaxed text-red-200'
                : 'w-full rounded-2xl rounded-tl-sm border border-line bg-surface/70 px-4 py-3 text-zinc-200'
          }
        >
          {isUser ? (
            // Tin của người dùng hiện nguyên văn: không diễn giải Markdown từ input người dùng
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : isError ? (
            <p className="flex items-start gap-2 whitespace-pre-wrap break-words">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{msg.content}</span>
            </p>
          ) : (
            msg.content && <MarkdownMessage content={msg.content} />
          )}

          {/* Danh sách Tool Execution khi AI điều khiển 3D Canvas */}
          {msg.toolExecutions && msg.toolExecutions.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-2.5">
              {msg.toolExecutions.map((exec) => (
                <div
                  key={exec.id}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11px] text-ink"
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

          {isThinking && (
            <div className="flex items-center gap-1 py-1" aria-label="AI đang suy nghĩ">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:0.4s]" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

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
  const chatWide = useStageStore((s) => s.chatWide);
  const toggleChatWide = useStageStore((s) => s.toggleChatWide);
  const [showHistory, setShowHistory] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  const closeLightbox = useCallback(() => setLightboxImage(null), []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
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

  /** Ảnh của tin người dùng đã được AI trả lời xong -> badge "Đã phân tích đa phương thức" */
  const isAnalyzed = (index: number): boolean => {
    const next = messages[index + 1];
    return Boolean(next && next.role === 'assistant' && next.status === 'done' && next.content);
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* 1. Header & Live Acoustic Telemetry */}
      <div className="relative border-b border-line px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">Kiến trúc sư âm học</h2>
            <p className="mt-1 text-[12px] leading-snug text-muted">
              Hỏi về switch, plate, tiếng gõ. Cấu hình đổi ngay trên mô hình.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {isCloudMode && (
              <>
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  aria-label="Lịch sử trò chuyện"
                  aria-expanded={showHistory}
                  className={`btn-press flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                    showHistory
                      ? 'border-ink/40 bg-surface-2 text-ink'
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
                  className="btn-press flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-muted hover:text-ink"
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
                title="Làm mới cuộc trò chuyện"
                className="btn-press flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:text-ink"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Chuyển Standard (440px) <-> Focus (640px); chỉ có ý nghĩa trên desktop */}
            <button
              type="button"
              onClick={toggleChatWide}
              aria-pressed={chatWide}
              aria-label={chatWide ? 'Thu gọn khung chat' : 'Mở rộng khung chat'}
              title={chatWide ? 'Thu gọn (Standard)' : 'Mở rộng (Focus)'}
              className="btn-press hidden h-7 w-7 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:text-ink lg:flex"
            >
              {chatWide ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Khách: nhắc đăng nhập để lưu lịch sử. Đã đăng nhập thì không hiện thẻ trạng thái */}
        {!isCloudMode && (
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-[12px] text-faint">
            <span>Đoạn chat này không được lưu.</span>
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="btn-press font-medium text-ink underline decoration-line underline-offset-[3px] hover:decoration-ink"
            >
              Đăng nhập
            </button>
            <span>để giữ lịch sử và gửi ảnh, tệp.</span>
          </p>
        )}

        {/* Drawer lịch sử đoạn chat đã lưu trên PostgreSQL */}
        {isCloudMode && showHistory && (
          <div className="scroll-thin mt-3 max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-1.5 backdrop-blur-md">
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
                      className={`group flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-[12px] transition-colors ${
                        isActive ? 'bg-white/10 text-ink' : 'text-muted hover:bg-white/[0.05] hover:text-ink'
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
        aria-live="polite"
        className="chat-scroll relative flex-1 space-y-4 overflow-y-auto px-4 py-5"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-[12px] font-medium text-muted">Gợi ý câu hỏi nhanh:</p>
            <div className="grid gap-2">
              {PROMPT_SUGGESTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSuggestionClick(item.prompt)}
                  className="btn-press flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-[12.5px] text-ink backdrop-blur-md transition-colors hover:border-ink/40 hover:bg-surface-2"
                >
                  <span>{item.label}</span>
                  <span className="text-[11px] text-muted">Gửi →</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              analyzed={msg.role === 'user' && isAnalyzed(index)}
              onOpenImage={setLightboxImage}
            />
          ))
        )}

        {/* Thông báo nếu thiếu API Key kèm nút chạy thử nghiệm Demo */}
        {isMissingKey && (
          <div className="rounded-xl border border-line bg-surface p-3.5 text-[12px] text-muted backdrop-blur-md">
            <p className="font-medium text-ink">Chưa có Google Gemini API Key</p>
            <p className="mt-1 leading-relaxed">
              Thêm <code className="rounded bg-canvas px-1 py-0.5 text-ink">GOOGLE_GENERATIVE_AI_API_KEY</code> vào file <code className="rounded bg-canvas px-1 py-0.5 text-ink">.env.local</code> để mở khoá toàn bộ tính năng trò chuyện trực tiếp.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-faint">Thử đổi phím ngay:</span>
              <button
                type="button"
                onClick={() => handleSimulateDemo('thock')}
                className="btn-press rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-ink hover:bg-white/10"
              >
                Set Thock
              </button>
              <button
                type="button"
                onClick={() => handleSimulateDemo('clack')}
                className="btn-press rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-ink hover:bg-white/10"
              >
                Set Clack
              </button>
              <button
                type="button"
                onClick={() => handleSimulateDemo('exploded')}
                className="btn-press rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-ink hover:bg-white/10"
              >
                Tách lớp 3D
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Input Form + Multimodal Attachment Tray */}
      <form onSubmit={handleSubmit} className="relative border-t border-line p-3">
        {/* Cảnh báo lỗi file từ Client Guard */}
        {attachmentError && (
          <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
            {attachmentError}
          </div>
        )}

        {/* Xem trước ảnh/tệp đang chờ gửi */}
        {pendingAttachments.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {pendingAttachments.map((att) => (
              <div
                key={att.id}
                className="group relative flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-2 text-[11px] text-ink backdrop-blur-md"
              >
                {att.kind === 'image' && att.previewUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxImage({
                        src: att.previewUrl as string,
                        name: att.name,
                        size: att.size,
                        mimeType: att.mimeType,
                      })
                    }
                    aria-label={`Xem trước ${att.name}`}
                    className="overflow-hidden rounded-lg border border-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- ảnh blob cục bộ đã qua sanitizer */}
                    <img src={att.previewUrl} alt={att.name} className="h-10 w-14 object-cover" />
                  </button>
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                    <FileText className="h-4 w-4 text-muted" />
                  </span>
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="max-w-[140px] truncate font-medium">{att.name}</span>
                  <span className="font-mono text-[10px] text-faint">{formatBytes(att.size)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  aria-label={`Gỡ ${att.name}`}
                  className="rounded-md p-1 text-muted hover:bg-white/10 hover:text-ink"
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
            className="btn-press absolute left-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-40"
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
            maxLength={2000}
            placeholder={
              isCloudMode
                ? 'Hỏi AI, dán ảnh bàn phím (Ctrl+V) hoặc gửi file...'
                : 'Hỏi về âm học hoặc yêu cầu cấu hình...'
            }
            className="w-full rounded-xl border border-line bg-surface py-3 pl-11 pr-12 text-[13px] text-ink transition-colors placeholder:text-muted focus:border-ink/50 focus:outline-none disabled:opacity-50"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              aria-label="Dừng sinh phản hồi"
              className="btn-press absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-ink hover:bg-white/15"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Gửi yêu cầu"
              className="btn-press absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-canvas hover:bg-ink/90 disabled:opacity-30 disabled:hover:bg-ink"
            >
              <Send className="h-3 w-3" />
            </button>
          )}
        </div>
      </form>

      <ImageLightbox image={lightboxImage} onClose={closeLightbox} />
    </div>
  );
};
