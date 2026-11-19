import {
  resetSlidingWindowMemory,
  slidingWindowRateLimit,
} from '@/lib/security/rateLimit';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

export interface RateLimitOptions {
  maxRequests?: number;
  windowSeconds?: number;
}

/**
 * Reset bộ đếm RAM (dùng trong unit test)
 */
export function resetMemoryRateLimiter() {
  resetSlidingWindowMemory();
}

/**
 * Rate Limit cho AI Chatbot — lớp mỏng bọc Sliding Window Limiter dùng chung
 * (`src/lib/security/rateLimit.ts`), giữ nguyên giao diện cũ.
 */
export async function checkAIRateLimit(
  identifier: string,
  options?: RateLimitOptions
): Promise<RateLimitResult> {
  const limit =
    options?.maxRequests ?? (Number(process.env.AI_RATE_LIMIT_MAX_REQUESTS) || 10);
  const windowSeconds =
    options?.windowSeconds ?? (Number(process.env.AI_RATE_LIMIT_WINDOW_SECONDS) || 60);

  const result = await slidingWindowRateLimit('ai', identifier, { limit, windowSeconds });

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    resetInSeconds: result.success ? windowSeconds : result.retryAfterSeconds,
  };
}
