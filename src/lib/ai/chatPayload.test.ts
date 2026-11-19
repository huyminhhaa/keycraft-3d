import { describe, it, expect } from 'vitest';
import {
  MAX_CHAT_TEXT_BYTES,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
  chatRequestSchema,
  maxChatBodyBytes,
  sanitizeChatHistory,
  textPartBytes,
  truncateMessage,
  type ChatHistoryMessage,
} from './chatPayload';

describe('Chat payload guard (src/lib/ai/chatPayload.ts)', () => {
  it('giới hạn đúng yêu cầu: 20 tin, 2.000 ký tự/tin, 100KB văn bản', () => {
    expect(MAX_HISTORY_MESSAGES).toBe(20);
    expect(MAX_MESSAGE_CHARS).toBe(2000);
    expect(MAX_CHAT_TEXT_BYTES).toBe(100 * 1024);
  });

  it('chỉ giữ 20 tin GẦN NHẤT', () => {
    const history: ChatHistoryMessage[] = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `tin ${i}`,
    }));
    const result = sanitizeChatHistory(history);
    expect(result).toHaveLength(20);
    expect(result[0].content).toBe('tin 5');
    expect(result[19].content).toBe('tin 24');
  });

  it('cắt mỗi tin còn 2.000 ký tự và bỏ tin rỗng', () => {
    const result = sanitizeChatHistory([
      { role: 'user', content: 'x'.repeat(5000) },
      { role: 'assistant', content: '   ' },
    ]);
    expect(result).toHaveLength(1);
    expect(Array.from(result[0].content)).toHaveLength(2001); // 2000 + dấu "…"
  });

  it('cắt theo ký tự thật, không làm vỡ emoji / chữ có dấu', () => {
    const cut = truncateMessage('🎹'.repeat(10), 3);
    expect(cut).toBe('🎹🎹🎹…');
  });

  it("schema chỉ nhận role 'user' | 'assistant'", () => {
    expect(chatRequestSchema.safeParse({ messages: [{ role: 'system', content: 'x' }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: [{ role: 'user', content: 'x' }] }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ messages: [{ role: 'user', content: 42 }] }).success).toBe(false);
  });

  it('trần body: khách 100KB; thành viên cộng thêm phần tệp base64', () => {
    expect(maxChatBodyBytes(false, 8 * 1024 * 1024)).toBe(100 * 1024);
    expect(maxChatBodyBytes(true, 8 * 1024 * 1024)).toBeGreaterThan(Math.ceil((8 * 1024 * 1024 * 4) / 3));
  });

  it('textPartBytes trừ đúng phần base64 của tệp đính kèm', () => {
    expect(textPartBytes(5000, [{ dataBase64: 'a'.repeat(4000) }])).toBe(1000);
    expect(textPartBytes(5000, undefined)).toBe(5000);
  });
});
