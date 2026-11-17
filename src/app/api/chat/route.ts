import { streamText, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { keyboardTools } from '@/lib/ai/keyboardTools';
import { KEYBOARD_ARCHITECT_SYSTEM_PROMPT } from '@/lib/ai/prompts';

// Cho phép streaming responses lên tới 60 giây
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
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
