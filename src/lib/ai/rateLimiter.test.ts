import { describe, it, expect, beforeEach } from 'vitest';
import { checkAIRateLimit, resetMemoryRateLimiter } from './rateLimiter';

describe('AI Rate Limiter (src/lib/ai/rateLimiter.ts)', () => {
  beforeEach(() => {
    resetMemoryRateLimiter();
  });

  it('cho phép các request trong giới hạn maxRequests', async () => {
    const ip = '192.168.1.100';
    const res1 = await checkAIRateLimit(ip, { maxRequests: 3, windowSeconds: 60 });

    expect(res1.success).toBe(true);
    expect(res1.limit).toBe(3);
    expect(res1.remaining).toBe(2);
    expect(res1.resetInSeconds).toBeGreaterThan(0);

    const res2 = await checkAIRateLimit(ip, { maxRequests: 3, windowSeconds: 60 });
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = await checkAIRateLimit(ip, { maxRequests: 3, windowSeconds: 60 });
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('chặn và trả về success = false khi vượt quá giới hạn', async () => {
    const ip = '192.168.1.101';
    for (let i = 0; i < 2; i++) {
      await checkAIRateLimit(ip, { maxRequests: 2, windowSeconds: 60 });
    }

    // Request thứ 3 vượt quá maxRequests = 2
    const blockedRes = await checkAIRateLimit(ip, { maxRequests: 2, windowSeconds: 60 });
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.resetInSeconds).toBeGreaterThan(0);
  });

  it('tách biệt hạn ngạch giữa các địa chỉ IP khác nhau', async () => {
    const ipA = '10.0.0.1';
    const ipB = '10.0.0.2';

    // IP A dùng hết 2 lượt
    await checkAIRateLimit(ipA, { maxRequests: 2, windowSeconds: 60 });
    await checkAIRateLimit(ipA, { maxRequests: 2, windowSeconds: 60 });
    const blockedA = await checkAIRateLimit(ipA, { maxRequests: 2, windowSeconds: 60 });
    expect(blockedA.success).toBe(false);

    // IP B vẫn còn nguyên hạn ngạch
    const allowedB = await checkAIRateLimit(ipB, { maxRequests: 2, windowSeconds: 60 });
    expect(allowedB.success).toBe(true);
    expect(allowedB.remaining).toBe(1);
  });

  it('tự động reset hạn ngạch khi cửa sổ thời gian hết hạn', async () => {
    const ip = '10.0.0.3';
    // Đặt window ngắn 1 giây
    await checkAIRateLimit(ip, { maxRequests: 1, windowSeconds: 1 });
    const blocked = await checkAIRateLimit(ip, { maxRequests: 1, windowSeconds: 1 });
    expect(blocked.success).toBe(false);

    // Chờ 1.1 giây để window hết hạn
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const resAfterExpiry = await checkAIRateLimit(ip, { maxRequests: 1, windowSeconds: 1 });
    expect(resAfterExpiry.success).toBe(true);
    expect(resAfterExpiry.remaining).toBe(0);
  });
});
