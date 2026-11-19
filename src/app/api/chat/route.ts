import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { keyboardTools } from '@/lib/ai/keyboardTools';
import { KEYBOARD_ARCHITECT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import {
  chatRequestSchema,
  MAX_CHAT_TEXT_BYTES,
  maxChatBodyBytes,
  sanitizeChatHistory,
  textPartBytes,
} from '@/lib/ai/chatPayload';
import { getSessionFromRequest } from '@/lib/auth/session';
import {
  MAX_TOTAL_PAYLOAD_BYTES,
  validateIncomingAttachments,
  type ValidatedAttachment,
} from '@/lib/security/fileGuard';
import { RATE_LIMITS, rateLimitHeaders, slidingWindowRateLimit } from '@/lib/security/rateLimit';
import { getClientIp, readJsonBody } from '@/lib/security/requestGuard';
import {
  appendChatMessage,
  createChatSession,
} from '@/lib/ai/chatHistoryService';
import type { StoredAttachmentMeta, StoredToolExecution } from '@/db/schema';

// Cho phép streaming responses lên tới 60 giây
export const maxDuration = 60;

interface ClientChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function jsonError(
  status: number,
  error: string,
  code?: string,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(code ? { error, code } : { error }), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function buildMultimodalMessages(
  history: ClientChatMessage[],
  validatedAttachments: ValidatedAttachment[]
): ModelMessage[] {
  const baseMessages: ModelMessage[] = history.map((m) => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : '',
  }));

  if (validatedAttachments.length === 0 || baseMessages.length === 0) {
    return baseMessages;
  }

  // Gắn ảnh / PDF / văn bản đã thẩm định bảo mật vào tin nhắn cuối cùng của user
  const lastIdx = baseMessages.length - 1;
  const lastMsg = baseMessages[lastIdx];
  if (lastMsg.role !== 'user') {
    return baseMessages;
  }

  const textParts: string[] = [];
  const baseText = typeof lastMsg.content === 'string' ? lastMsg.content.trim() : '';
  if (baseText) {
    textParts.push(baseText);
  }

  const multimodalParts: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; image: Uint8Array; mediaType: string }
    | { type: 'file'; data: Uint8Array; mediaType: string }
  > = [];

  for (const att of validatedAttachments) {
    if (att.kind === 'text' && att.wrappedText) {
      textParts.push(att.wrappedText);
    }
  }

  if (textParts.length > 0) {
    multimodalParts.push({ type: 'text', text: textParts.join('\n\n') });
  } else {
    multimodalParts.push({
      type: 'text',
      text: 'Hãy phân tích ảnh hoặc tài liệu bàn phím đính kèm và tư vấn cấu hình phù hợp.',
    });
  }

  for (const att of validatedAttachments) {
    if (att.kind === 'image') {
      multimodalParts.push({
        type: 'image',
        image: att.bytes,
        mediaType: att.mimeType,
      });
    } else if (att.kind === 'pdf') {
      multimodalParts.push({
        type: 'file',
        data: att.bytes,
        mediaType: att.mimeType,
      });
    }
  }

  baseMessages[lastIdx] = {
    role: 'user',
    content: multimodalParts,
  };

  return baseMessages;
}

export async function POST(req: Request) {
  try {
    // 1. Xác định chế độ Khách (Temporary Chat) vs Đã đăng nhập (Cloud History + Multimodal)
    const session = await getSessionFromRequest(req);
    const authUser = session.authenticated ? session.user : null;

    // 2. Rate Limiting (Sliding Window qua Redis): thành viên 15 tin/phút, khách 5 tin/phút
    const rateLimit = await slidingWindowRateLimit(
      'chat',
      authUser ? `user:${authUser.id}` : getClientIp(req),
      authUser ? RATE_LIMITS.chatMember : RATE_LIMITS.chatGuest
    );
    if (!rateLimit.success) {
      return jsonError(
        429,
        `Bạn đã gửi quá nhiều yêu cầu đến AI Acoustic Architect trong thời gian ngắn. Vui lòng thử lại sau ${rateLimit.retryAfterSeconds} giây.`,
        undefined,
        rateLimitHeaders(rateLimit)
      );
    }

    // 3. Giới hạn kích thước body: văn bản tối đa 100KB (+ phần tệp cho thành viên)
    const bodyResult = await readJsonBody(req, maxChatBodyBytes(Boolean(authUser), MAX_TOTAL_PAYLOAD_BYTES));
    if (!bodyResult.ok) {
      return jsonError(bodyResult.status, bodyResult.error);
    }

    const parsedBody = chatRequestSchema.safeParse(bodyResult.data);
    if (!parsedBody.success) {
      return jsonError(400, 'Định dạng tin nhắn gửi lên không hợp lệ.', 'INVALID_CHAT_PAYLOAD');
    }
    const body = parsedBody.data;
    const incomingAttachments = body.attachments;

    if (textPartBytes(bodyResult.bytes, incomingAttachments) > MAX_CHAT_TEXT_BYTES) {
      return jsonError(413, 'Nội dung tin nhắn vượt quá giới hạn 100KB.', 'PAYLOAD_TOO_LARGE');
    }

    // 4. Chỉ 20 tin gần nhất, mỗi tin tối đa 2.000 ký tự được gửi lên Gemini
    const rawMessages = sanitizeChatHistory(body.messages);

    // 5. Cổng bảo vệ tệp đính kèm: Khách chưa đăng nhập không được upload file/ảnh
    const hasAttachments = Array.isArray(incomingAttachments) && incomingAttachments.length > 0;
    if (hasAttachments && !authUser) {
      return new Response(
        JSON.stringify({
          error:
            'Vui lòng đăng nhập bằng Google (hoặc tài khoản KeyCraft) để gửi ảnh/tệp cho AI phân tích và lưu lịch sử trò chuyện.',
          code: 'AUTH_REQUIRED_FOR_ATTACHMENTS',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. Quét 7 lớp bảo mật tệp đính kèm (Magic Bytes, Anti-XSS SVG, Pixel Bomb, PDF JS, Prompt Injection)
    const attachmentValidation = validateIncomingAttachments(incomingAttachments);
    if (!attachmentValidation.ok) {
      return new Response(
        JSON.stringify({
          error: attachmentValidation.error,
          code: attachmentValidation.code,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const validatedAttachments = attachmentValidation.attachments;
    const safeAttachmentMetas: StoredAttachmentMeta[] = validatedAttachments.map((att) => ({
      name: att.name,
      mimeType: att.mimeType,
      size: att.size,
      kind: att.kind,
    }));

    // 5. Kiểm tra Gemini API Key
    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return new Response(
        JSON.stringify({
          error:
            'Chưa cấu hình GOOGLE_GENERATIVE_AI_API_KEY. Vui lòng thêm Gemini API Key vào file .env.local để kích hoạt AI Architect.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. Nếu người dùng đã đăng nhập -> Tạo/gắn phiên chat và lưu tin nhắn người dùng lên DB (Cloud History)
    let activeSessionId: string | null = null;
    const lastUserMessage = [...rawMessages].reverse().find((m) => m.role === 'user');

    if (authUser && lastUserMessage) {
      if (body.sessionId && typeof body.sessionId === 'string') {
        activeSessionId = body.sessionId;
      } else {
        const titleSeed =
          lastUserMessage.content.trim() ||
          (safeAttachmentMetas[0] ? `Phân tích ${safeAttachmentMetas[0].name}` : 'Đoạn chat mới');
        const created = await createChatSession(authUser.id, titleSeed);
        activeSessionId = created.id;
      }

      const appended = await appendChatMessage(authUser.id, activeSessionId, {
        role: 'user',
        content: lastUserMessage.content,
        attachments: safeAttachmentMetas,
      });

      // Nếu sessionId truyền lên không thuộc về user này -> tạo session mới an toàn
      if (!appended) {
        const fallbackSession = await createChatSession(
          authUser.id,
          lastUserMessage.content || 'Đoạn chat mới'
        );
        activeSessionId = fallbackSession.id;
        await appendChatMessage(authUser.id, activeSessionId, {
          role: 'user',
          content: lastUserMessage.content,
          attachments: safeAttachmentMetas,
        });
      }
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const modelMessages = buildMultimodalMessages(rawMessages, validatedAttachments);

    const sessionIdForSave = activeSessionId;
    const userIdForSave = authUser?.id ?? null;

    const result = streamText({
      model: google(modelName),
      system: KEYBOARD_ARCHITECT_SYSTEM_PROMPT,
      messages: modelMessages,
      tools: keyboardTools,
      stopWhen: stepCountIs(8),
      onFinish: async ({ text, steps }) => {
        if (!userIdForSave || !sessionIdForSave) return;

        const toolExecutions: StoredToolExecution[] = [];
        for (const step of steps ?? []) {
          for (const call of step.toolCalls ?? []) {
            const rawInput =
              'input' in call && call.input && typeof call.input === 'object'
                ? (call.input as Record<string, unknown>)
                : {};
            toolExecutions.push({
              id: call.toolCallId,
              toolName: call.toolName,
              summary: `Đã thực thi ${call.toolName}`,
              input: rawInput,
            });
          }
        }

        if (text.trim() || toolExecutions.length > 0) {
          await appendChatMessage(userIdForSave, sessionIdForSave, {
            role: 'assistant',
            content: text,
            toolExecutions,
          });
        }
      },
    });

    const response = result.toUIMessageStreamResponse();
    response.headers.set('X-Chat-Mode', authUser ? 'cloud' : 'temporary');
    if (activeSessionId) {
      response.headers.set('X-Chat-Session-Id', activeSessionId);
    }
    if (session.refreshedAccessCookie) {
      response.headers.append('Set-Cookie', session.refreshedAccessCookie);
    }
    return response;
  } catch (error) {
    // Không trả error.message ra ngoài (có thể lộ chi tiết DB / SDK / đường dẫn nội bộ)
    console.error('[AI_CHAT_ERROR]:', error);
    return jsonError(500, 'Đã xảy ra sự cố khi kết nối với AI Acoustic Architect.');
  }
}
