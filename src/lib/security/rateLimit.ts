import { redis, REDIS_KEYS } from '@/lib/redis';

/**
 * Sliding Window Rate Limiter (Redis sorted set + Lua, fallback RAM).
 *
 * Mỗi request là một phần tử trong sorted set, điểm = thời điểm (ms). Mỗi lần gọi:
 *  1. Xoá các phần tử cũ hơn `now - window`
 *  2. Đếm phần tử còn lại; nếu < limit thì thêm request mới
 * Toàn bộ chạy trong một script Lua nên là nguyên tử (atomic) trên Redis/Upstash,
 * hai request đồng thời không thể cùng "lọt" qua ở lượt cuối.
 */

export interface SlidingWindowOptions {
  /** Số request tối đa trong một cửa sổ */
  limit: number;
  /** Độ dài cửa sổ trượt (giây) */
  windowSeconds: number;
}

export interface SlidingWindowResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Số giây đến khi có thêm 1 lượt (0 nếu còn lượt) */
  retryAfterSeconds: number;
}

/** Tối thiểu phần Redis cần có (cho phép tiêm client giả trong unit test) */
export interface RateLimitStore {
  evalScript(script: string, keys: string[], args: Array<string | number>): Promise<unknown>;
}

/** Hạn mức chuẩn của từng endpoint */
export const RATE_LIMITS = {
  register: { limit: 5, windowSeconds: 600 },
  buildCreate: { limit: 10, windowSeconds: 60 },
  buildMutate: { limit: 30, windowSeconds: 60 },
  chatMember: { limit: 15, windowSeconds: 60 },
  chatGuest: { limit: 5, windowSeconds: 60 },
  captchaVerify: { limit: 10, windowSeconds: 60 },
} as const satisfies Record<string, SlidingWindowOptions>;

export const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return {1, count + 1, 0}
end
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local retry = window
if oldest[2] then retry = tonumber(oldest[2]) + window - now end
return {0, count, retry}
`.trim();

const redisStore: RateLimitStore = {
  evalScript: (script, keys, args) => redis.eval(script, keys.length, ...keys, ...args),
};

// ------------------------------------------------------------------------------
// Fallback RAM khi Redis offline (mỗi instance server một bộ đếm riêng)
// ------------------------------------------------------------------------------
const memoryWindows = new Map<string, number[]>();
const MEMORY_MAX_KEYS = 10_000;

export function resetSlidingWindowMemory(): void {
  memoryWindows.clear();
}

function memorySlidingWindow(key: string, opts: SlidingWindowOptions, now: number): SlidingWindowResult {
  const windowMs = opts.windowSeconds * 1000;
  const hits = (memoryWindows.get(key) ?? []).filter((t) => t > now - windowMs);

  if (hits.length < opts.limit) {
    hits.push(now);
    memoryWindows.set(key, hits);
    if (memoryWindows.size > MEMORY_MAX_KEYS) pruneMemory(now, windowMs);
    return { success: true, limit: opts.limit, remaining: opts.limit - hits.length, retryAfterSeconds: 0 };
  }

  memoryWindows.set(key, hits);
  const retryMs = hits[0] + windowMs - now;
  return {
    success: false,
    limit: opts.limit,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
  };
}

function pruneMemory(now: number, windowMs: number): void {
  for (const [key, hits] of memoryWindows) {
    if (hits.every((t) => t <= now - windowMs)) memoryWindows.delete(key);
  }
  // Vẫn quá tải (bị spam key ngẫu nhiên) -> bỏ các key cũ nhất
  while (memoryWindows.size > MEMORY_MAX_KEYS) {
    const first = memoryWindows.keys().next();
    if (first.done) break;
    memoryWindows.delete(first.value);
  }
}

function parseLuaReply(reply: unknown): [number, number, number] | null {
  if (!Array.isArray(reply) || reply.length < 3) return null;
  const nums = reply.slice(0, 3).map((v) => Number(v));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return [nums[0], nums[1], nums[2]];
}

/**
 * Kiểm tra + ghi nhận một request.
 * @param scope nhóm hạn mức (vd: `register`, `chat`)
 * @param identifier IP hoặc `user:<id>`
 * @param store mặc định Redis; `null` = chỉ dùng RAM (môi trường test)
 */
export async function slidingWindowRateLimit(
  scope: string,
  identifier: string,
  opts: SlidingWindowOptions,
  store: RateLimitStore | null = process.env.NODE_ENV === 'test' ? null : redisStore
): Promise<SlidingWindowResult> {
  const id = identifier.trim() || 'anonymous';
  const key = REDIS_KEYS.RATE_LIMIT(scope, id);
  const now = Date.now();

  if (store) {
    try {
      const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
      const reply = parseLuaReply(
        await store.evalScript(SLIDING_WINDOW_LUA, [key], [now, opts.windowSeconds * 1000, opts.limit, member])
      );
      if (reply) {
        const [allowed, count, retryMs] = reply;
        return {
          success: allowed === 1,
          limit: opts.limit,
          remaining: Math.max(0, opts.limit - count),
          retryAfterSeconds: allowed === 1 ? 0 : Math.max(1, Math.ceil(retryMs / 1000)),
        };
      }
    } catch {
      // Redis offline -> rơi xuống bộ đếm RAM
    }
  }

  return memorySlidingWindow(key, opts, now);
}

/** Header chuẩn cho phản hồi 429 */
export function rateLimitHeaders(result: SlidingWindowResult): Record<string, string> {
  return {
    'Retry-After': String(result.retryAfterSeconds),
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
  };
}
