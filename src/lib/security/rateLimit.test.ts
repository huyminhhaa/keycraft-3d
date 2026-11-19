import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RATE_LIMITS,
  SLIDING_WINDOW_LUA,
  rateLimitHeaders,
  resetSlidingWindowMemory,
  slidingWindowRateLimit,
  type RateLimitStore,
} from './rateLimit';

describe('Sliding Window Rate Limiter (src/lib/security/rateLimit.ts)', () => {
  beforeEach(() => {
    resetSlidingWindowMemory();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hạn mức đúng yêu cầu: đăng ký 5/10 phút, lưu build 10/phút, chat 15 & 5/phút', () => {
    expect(RATE_LIMITS.register).toEqual({ limit: 5, windowSeconds: 600 });
    expect(RATE_LIMITS.buildCreate).toEqual({ limit: 10, windowSeconds: 60 });
    expect(RATE_LIMITS.chatMember).toEqual({ limit: 15, windowSeconds: 60 });
    expect(RATE_LIMITS.chatGuest).toEqual({ limit: 5, windowSeconds: 60 });
  });

  it('cho phép đúng `limit` request rồi chặn, kèm Retry-After > 0', async () => {
    const opts = { limit: 3, windowSeconds: 60 };
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await slidingWindowRateLimit('test', '10.0.0.1', opts, null));
    }

    expect(results.map((r) => r.success)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
    expect(results[3].retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('cửa sổ TRƯỢT: request cũ rơi khỏi cửa sổ thì mở lại đúng 1 lượt (không reset cả loạt)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
    const opts = { limit: 2, windowSeconds: 10 };

    await slidingWindowRateLimit('slide', 'ip', opts, null); // t = 0s
    vi.setSystemTime(new Date('2026-11-19T10:00:06Z'));
    await slidingWindowRateLimit('slide', 'ip', opts, null); // t = 6s
    expect((await slidingWindowRateLimit('slide', 'ip', opts, null)).success).toBe(false);

    // t = 11s: request ở 0s đã ra khỏi cửa sổ 10s, request ở 6s vẫn còn -> chỉ 1 lượt mới
    vi.setSystemTime(new Date('2026-11-19T10:00:11Z'));
    expect((await slidingWindowRateLimit('slide', 'ip', opts, null)).success).toBe(true);
    expect((await slidingWindowRateLimit('slide', 'ip', opts, null)).success).toBe(false);
  });

  it('tách biệt theo scope và identifier', async () => {
    const opts = { limit: 1, windowSeconds: 60 };
    await slidingWindowRateLimit('register', '1.1.1.1', opts, null);
    expect((await slidingWindowRateLimit('register', '1.1.1.1', opts, null)).success).toBe(false);
    expect((await slidingWindowRateLimit('register', '2.2.2.2', opts, null)).success).toBe(true);
    expect((await slidingWindowRateLimit('chat', '1.1.1.1', opts, null)).success).toBe(true);
  });

  it('dùng Redis qua script Lua nguyên tử với đúng key và tham số', async () => {
    const evalScript = vi.fn<RateLimitStore['evalScript']>().mockResolvedValue([1, 1, 0]);
    const result = await slidingWindowRateLimit('chat', 'user:42', { limit: 15, windowSeconds: 60 }, { evalScript });

    expect(result).toEqual({ success: true, limit: 15, remaining: 14, retryAfterSeconds: 0 });
    const [script, keys, args] = evalScript.mock.calls[0];
    expect(script).toBe(SLIDING_WINDOW_LUA);
    expect(keys).toEqual(['keycraft:ratelimit:chat:user:42']);
    expect(args[1]).toBe(60_000); // cửa sổ tính bằng ms
    expect(args[2]).toBe(15);
  });

  it('đọc đúng phản hồi "bị chặn" từ Redis (retry tính bằng ms -> giây làm tròn lên)', async () => {
    const store: RateLimitStore = { evalScript: vi.fn().mockResolvedValue([0, 5, 12_300]) };
    const result = await slidingWindowRateLimit('chat', 'ip', { limit: 5, windowSeconds: 60 }, store);
    expect(result).toEqual({ success: false, limit: 5, remaining: 0, retryAfterSeconds: 13 });
  });

  it('Redis lỗi -> tự rơi xuống bộ đếm RAM, vẫn chặn được', async () => {
    const store: RateLimitStore = { evalScript: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    const opts = { limit: 1, windowSeconds: 60 };
    expect((await slidingWindowRateLimit('x', 'ip', opts, store)).success).toBe(true);
    expect((await slidingWindowRateLimit('x', 'ip', opts, store)).success).toBe(false);
  });

  it('rateLimitHeaders sinh header chuẩn cho phản hồi 429', () => {
    expect(
      rateLimitHeaders({ success: false, limit: 5, remaining: 0, retryAfterSeconds: 30 })
    ).toEqual({ 'Retry-After': '30', 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '0' });
  });
});
