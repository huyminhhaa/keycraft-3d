import { randomUUID } from 'node:crypto';
import { and, desc, eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import {
  chatMessages,
  chatSessions,
  type StoredAttachmentMeta,
  type StoredToolExecution,
} from '@/db/schema';

export interface ChatSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: StoredAttachmentMeta[];
  toolExecutions?: StoredToolExecution[];
  createdAt: number;
}

export interface ChatSessionDetail extends ChatSessionSummary {
  messages: PersistedChatMessage[];
}

interface MemorySessionRecord {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: PersistedChatMessage[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string): boolean => UUID_REGEX.test(value);

// Fallback In-Memory Store cho unit test hoặc khi DB tạm thời chưa kết nối
const memorySessions = new Map<string, MemorySessionRecord>();

export function clearMemoryChatSessions(): void {
  memorySessions.clear();
}

export function deriveSessionTitle(rawPrompt: string): string {
  const cleaned = rawPrompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Đoạn chat mới';
  return cleaned.length > 60 ? `${cleaned.slice(0, 60)}…` : cleaned;
}

/**
 * Liệt kê danh sách các đoạn chat đã lưu của người dùng (mới nhất lên trên)
 */
export async function listChatSessions(userId: string): Promise<ChatSessionSummary[]> {
  if (isUuid(userId)) {
    try {
      const rows = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.userId, userId))
        .orderBy(desc(chatSessions.updatedAt))
        .limit(30);

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    } catch {
      // Fallback sang bộ nhớ tạm
    }
  }

  return Array.from(memorySessions.values())
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 30)
    .map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
}

/**
 * Tạo đoạn chat mới gắn chặt với userId
 */
export async function createChatSession(userId: string, title: string): Promise<ChatSessionSummary> {
  const safeTitle = deriveSessionTitle(title);

  if (isUuid(userId)) {
    try {
      const inserted = await db
        .insert(chatSessions)
        .values({
          userId,
          title: safeTitle,
        })
        .returning();

      if (inserted[0]) {
        return {
          id: inserted[0].id,
          title: inserted[0].title,
          createdAt: inserted[0].createdAt.toISOString(),
          updatedAt: inserted[0].updatedAt.toISOString(),
        };
      }
    } catch {
      // Fallback sang bộ nhớ tạm
    }
  }

  const now = new Date();
  const id = randomUUID();
  memorySessions.set(id, {
    id,
    userId,
    title: safeTitle,
    createdAt: now,
    updatedAt: now,
    messages: [],
  });

  return {
    id,
    title: safeTitle,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * Lấy chi tiết 1 đoạn chat + toàn bộ tin nhắn (kiểm tra chặt quyền sở hữu userId)
 */
export async function getChatSessionDetail(
  userId: string,
  sessionId: string
): Promise<ChatSessionDetail | null> {
  if (isUuid(userId) && isUuid(sessionId)) {
    try {
      const found = await db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
        .limit(1);

      if (found[0]) {
        const msgRows = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.sessionId, sessionId))
          .orderBy(asc(chatMessages.createdAt));

        return {
          id: found[0].id,
          title: found[0].title,
          createdAt: found[0].createdAt.toISOString(),
          updatedAt: found[0].updatedAt.toISOString(),
          messages: msgRows.map((m) => ({
            id: m.id,
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
            attachments: m.attachments ?? [],
            toolExecutions: m.toolExecutions ?? [],
            createdAt: m.createdAt.getTime(),
          })),
        };
      }
      return null;
    } catch {
      // Fallback sang bộ nhớ tạm
    }
  }

  const mem = memorySessions.get(sessionId);
  if (!mem || mem.userId !== userId) return null;

  return {
    id: mem.id,
    title: mem.title,
    createdAt: mem.createdAt.toISOString(),
    updatedAt: mem.updatedAt.toISOString(),
    messages: [...mem.messages],
  };
}

/**
 * Ghi thêm tin nhắn vào đoạn chat (chỉ lưu metadata tệp an toàn, không lưu binary)
 */
export async function appendChatMessage(
  userId: string,
  sessionId: string,
  message: {
    role: 'user' | 'assistant';
    content: string;
    attachments?: StoredAttachmentMeta[];
    toolExecutions?: StoredToolExecution[];
  }
): Promise<boolean> {
  if (isUuid(userId) && isUuid(sessionId)) {
    try {
      const ownerCheck = await db
        .select({ id: chatSessions.id })
        .from(chatSessions)
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
        .limit(1);

      if (!ownerCheck[0]) return false;

      await db.insert(chatMessages).values({
        sessionId,
        role: message.role,
        content: message.content,
        attachments: message.attachments ?? [],
        toolExecutions: message.toolExecutions ?? [],
      });

      await db
        .update(chatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, sessionId));

      return true;
    } catch {
      // Fallback sang bộ nhớ tạm
    }
  }

  const mem = memorySessions.get(sessionId);
  if (!mem || mem.userId !== userId) return false;

  mem.messages.push({
    id: randomUUID(),
    role: message.role,
    content: message.content,
    attachments: message.attachments ?? [],
    toolExecutions: message.toolExecutions ?? [],
    createdAt: Date.now(),
  });
  mem.updatedAt = new Date();
  return true;
}

/**
 * Xóa đoạn chat (kiểm tra chặt quyền sở hữu userId)
 */
export async function deleteChatSession(userId: string, sessionId: string): Promise<boolean> {
  if (isUuid(userId) && isUuid(sessionId)) {
    try {
      const deleted = await db
        .delete(chatSessions)
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
        .returning({ id: chatSessions.id });

      return deleted.length > 0;
    } catch {
      // Fallback sang bộ nhớ tạm
    }
  }

  const mem = memorySessions.get(sessionId);
  if (!mem || mem.userId !== userId) return false;
  memorySessions.delete(sessionId);
  return true;
}
