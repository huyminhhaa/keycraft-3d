import { redis, REDIS_KEYS } from '@/lib/redis';

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

// In-memory fallback tracker khi Redis offline hoặc trong môi trường test
interface MemoryRateRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryRateRecord>();

/**
 * Xóa các bản ghi đã hết hạn trong memoryStore để chống tràn bộ nhớ
 */
function cleanupMemoryStore() {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (record.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Reset memory store (dùng trong unit test)
 */
export function resetMemoryRateLimiter() {
  memoryStore.clear();
}

/**
 * Kiểm tra và áp dụng Rate Limiting chống spam cho AI Chatbot và API
 * Thuật toán Fixed Window Counter kết hợp Atomic Increment
 */
export async function checkAIRateLimit(
  identifier: string,
  options?: RateLimitOptions
): Promise<RateLimitResult> {
  const maxRequests =
    options?.maxRequests ??
    (Number(process.env.AI_RATE_LIMIT_MAX_REQUESTS) || 10);

  const windowSeconds =
    options?.windowSeconds ??
    (Number(process.env.AI_RATE_LIMIT_WINDOW_SECONDS) || 60);

  const safeIdentifier = identifier.trim() || 'anonymous';
  const redisKey = REDIS_KEYS.AI_RATE_LIMIT(safeIdentifier);

  // 1. Thử áp dụng Rate Limit qua Redis (nếu Redis khả dụng)
  if (process.env.NODE_ENV !== 'test') {
    try {
      const current = await redis.incr(redisKey);

      // Nếu đây là request đầu tiên trong window, thiết lập TTL
      if (current === 1) {
        await redis.expire(redisKey, windowSeconds);
      }

      let ttl = await redis.ttl(redisKey);
      if (ttl < 0) {
        ttl = windowSeconds;
        await redis.expire(redisKey, windowSeconds);
      }

      const remaining = Math.max(0, maxRequests - current);
      const success = current <= maxRequests;

      return {
        success,
        limit: maxRequests,
        remaining,
        resetInSeconds: ttl,
      };
    } catch {
      // Redis container offline -> Tự động fallback sang Memory Rate Limiter
    }
  }

  // 2. In-Memory Fallback Rate Limiter
  cleanupMemoryStore();
  const now = Date.now();
  const existing = memoryStore.get(safeIdentifier);

  if (!existing || existing.resetAt <= now) {
    // Tạo window mới
    const resetAt = now + windowSeconds * 1000;
    memoryStore.set(safeIdentifier, { count: 1, resetAt });

    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetInSeconds: windowSeconds,
    };
  }

  // Window hiện tại còn hiệu lực
  existing.count += 1;
  const remaining = Math.max(0, maxRequests - existing.count);
  const resetInSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  const success = existing.count <= maxRequests;

  return {
    success,
    limit: maxRequests,
    remaining,
    resetInSeconds,
  };
}
