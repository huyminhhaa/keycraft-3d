import { streamText, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { keyboardTools } from '@/lib/ai/keyboardTools';
import { KEYBOARD_ARCHITECT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { checkAIRateLimit } from '@/lib/ai/rateLimiter';

// Cho phép streaming responses lên tới 60 giây
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // 1. Áp dụng Rate Limiting chống spam theo IP qua Redis
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateLimit = await checkAIRateLimit(clientIp);
    if (!rateLimit.success) {
      return new Response(
        JSON.stringify({
          error: `Bạn đã gửi quá nhiều yêu cầu đến AI Acoustic Architect trong thời gian ngắn. Vui lòng thử lại sau ${rateLimit.resetInSeconds} giây.`,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.resetInSeconds),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetInSeconds),
          },
        }
      );
    }

    const { messages } = await req.json();

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

    const google = createGoogleGenerativeAI({
      apiKey,
    });

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

    const result = streamText({
      model: google(modelName),
      system: KEYBOARD_ARCHITECT_SYSTEM_PROMPT,
      messages,
      tools: keyboardTools,
      stopWhen: stepCountIs(8), // Cho phép mô hình suy luận đa bước
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('[AI_CHAT_ERROR]:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Đã xảy ra sự cố khi kết nối với AI Acoustic Architect.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
