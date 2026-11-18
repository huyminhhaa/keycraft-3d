import { describe, it, expect, beforeEach } from 'vitest';
import {
  appendChatMessage,
  clearMemoryChatSessions,
  createChatSession,
  deleteChatSession,
  deriveSessionTitle,
  getChatSessionDetail,
  listChatSessions,
} from './chatHistoryService';

describe('Cloud Chat History Service (src/lib/ai/chatHistoryService.ts)', () => {
  beforeEach(() => {
    clearMemoryChatSessions();
  });

  it('tạo tiêu đề gọn gàng từ câu hỏi đầu tiên', () => {
    expect(deriveSessionTitle('   Tư vấn bàn phím 75% thock   ')).toBe('Tư vấn bàn phím 75% thock');
    expect(deriveSessionTitle('')).toBe('Đoạn chat mới');
    expect(deriveSessionTitle('a'.repeat(100)).length).toBeLessThanOrEqual(61);
  });

  it('lưu, liệt kê, đọc lại tin nhắn kèm metadata tệp đính kèm và xóa đoạn chat', async () => {
    const userId = 'mem_user_1';
    const created = await createChatSession(userId, 'Tư vấn âm Thock với AULA F75');

    const okUser = await appendChatMessage(userId, created.id, {
      role: 'user',
      content: 'Phân tích ảnh bàn phím này giúp mình',
      attachments: [
        { name: 'aula-f75.jpg', mimeType: 'image/jpeg', size: 42000, kind: 'image' },
      ],
    });
    expect(okUser).toBe(true);

    const okAsst = await appendChatMessage(userId, created.id, {
      role: 'assistant',
      content: 'Đây là phối màu trắng xanh của AULA F75...',
    });
    expect(okAsst).toBe(true);

    const list = await listChatSessions(userId);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);

    const detail = await getChatSessionDetail(userId, created.id);
    expect(detail).not.toBeNull();
    expect(detail?.messages).toHaveLength(2);
    expect(detail?.messages[0].attachments?.[0].name).toBe('aula-f75.jpg');

    const deleted = await deleteChatSession(userId, created.id);
    expect(deleted).toBe(true);
    expect(await listChatSessions(userId)).toHaveLength(0);
  });

  it('cô lập hoàn toàn dữ liệu giữa các user (User B không thể đọc/ghi/xóa chat của User A)', async () => {
    const sessionA = await createChatSession('mem_user_A', 'Đoạn chat riêng tư của A');

    expect(await getChatSessionDetail('mem_user_B', sessionA.id)).toBeNull();
    expect(
      await appendChatMessage('mem_user_B', sessionA.id, {
        role: 'user',
        content: 'Cố gắng chèn tin nhắn trái phép',
      })
    ).toBe(false);
    expect(await deleteChatSession('mem_user_B', sessionA.id)).toBe(false);

    // Dữ liệu của A vẫn nguyên vẹn
    expect(await getChatSessionDetail('mem_user_A', sessionA.id)).not.toBeNull();
  });
});
