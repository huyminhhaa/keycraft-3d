import { z } from 'zod';

/**
 * Chống cạn quota Gemini & DoS cho /api/chat (dùng chung client + server, không import gì của Node):
 * - Phần văn bản của body tối đa 100KB
 * - Chỉ gửi 20 tin nhắn gần nhất lên Gemini, mỗi tin tối đa 2.000 ký tự
 */
const KB = 1024;
export const MAX_CHAT_TEXT_BYTES = 100 * KB;
export const MAX_HISTORY_MESSAGES = 20;
export const MAX_MESSAGE_CHARS = 2_000;
/** Mảng messages gửi lên quá dài thì từ chối luôn (client hợp lệ chỉ gửi <= 20) */
const MAX_INCOMING_MESSAGES = 200;

/**
 * Trần byte của toàn bộ body. Khách không được gửi tệp nên chỉ có 100KB văn bản;
 * thành viên được thêm phần tệp đính kèm base64 (base64 phình 4/3 so với byte gốc).
 */
export function maxChatBodyBytes(isMember: boolean, maxAttachmentBytes: number): number {
  if (!isMember) return MAX_CHAT_TEXT_BYTES;
  return MAX_CHAT_TEXT_BYTES + Math.ceil((maxAttachmentBytes * 4) / 3) + 4 * KB;
}

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']), // chặn client tự chèn role 'system' để ghi đè chỉ dẫn
  content: z.string(),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).max(MAX_INCOMING_MESSAGES).default([]),
  sessionId: z.string().max(64).nullable().optional(),
  attachments: z.unknown().optional(),
});

export type ChatHistoryMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Cắt gọn một tin nhắn (theo code point, không cắt đôi emoji/ký tự ghép) */
export function truncateMessage(content: string, maxChars = MAX_MESSAGE_CHARS): string {
  const chars = Array.from(content);
  if (chars.length <= maxChars) return content;
  return `${chars.slice(0, maxChars).join('')}…`;
}

/** Giữ 20 tin gần nhất, cắt mỗi tin còn 2.000 ký tự, bỏ tin rỗng */
export function sanitizeChatHistory(
  messages: ChatHistoryMessage[],
  maxMessages = MAX_HISTORY_MESSAGES,
  maxChars = MAX_MESSAGE_CHARS
): ChatHistoryMessage[] {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .slice(-maxMessages)
    .map((m) => ({ role: m.role, content: truncateMessage(m.content, maxChars) }));
}

/** Byte của phần văn bản = tổng byte body trừ đi chuỗi base64 của tệp đính kèm */
export function textPartBytes(totalBytes: number, attachments: unknown): number {
  if (!Array.isArray(attachments)) return totalBytes;
  let attachmentBytes = 0;
  for (const att of attachments) {
    if (att && typeof att === 'object' && 'dataBase64' in att) {
      const data = (att as { dataBase64: unknown }).dataBase64;
      if (typeof data === 'string') attachmentBytes += data.length;
    }
  }
  return totalBytes - attachmentBytes;
}
