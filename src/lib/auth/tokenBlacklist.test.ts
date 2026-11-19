import { describe, it, expect, beforeEach, vi } from 'vitest';

// Redis giả lập bằng Map để kiểm tra đúng lệnh SET ... EX <ttl> và EXISTS
const fakeRedis = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    online: true,
    set: vi.fn(async (key: string, value: string) => {
      if (!fakeRedis.online) throw new Error('offline');
      store.set(key, value);
      return 'OK';
    }),
    exists: vi.fn(async (key: string) => {
      if (!fakeRedis.online) throw new Error('offline');
      return store.has(key) ? 1 : 0;
    }),
  };
});

vi.mock('@/lib/redis', () => ({
  redis: fakeRedis,
  REDIS_KEYS: { TOKEN_BLACKLIST: (jti: string) => `keycraft:auth:revoked:${jti}` },
}));

import {
  isTokenRevoked,
  remainingTtlSeconds,
  resetMemoryBlacklist,
  revokeToken,
} from './tokenBlacklist';

describe('Token Blacklist (src/lib/auth/tokenBlacklist.ts)', () => {
  beforeEach(() => {
    fakeRedis.store.clear();
    fakeRedis.online = true;
    fakeRedis.set.mockClear();
    resetMemoryBlacklist();
  });

  it('remainingTtlSeconds = exp - bây giờ, không âm', () => {
    const now = 1_700_000_000_000;
    expect(remainingTtlSeconds(now / 1000 + 900, now)).toBe(900);
    expect(remainingTtlSeconds(now / 1000 - 5, now)).toBe(0);
    expect(remainingTtlSeconds(undefined, now)).toBe(0);
  });

  it('thu hồi token: ghi Redis với TTL đúng bằng thời gian sống còn lại', async () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    expect(await revokeToken('jti-abc', exp)).toBe(true);

    const [key, value, mode, ttl] = fakeRedis.set.mock.calls[0] as unknown as [string, string, string, number];
    expect(key).toBe('keycraft:auth:revoked:jti-abc');
    expect(value).toBe('1');
    expect(mode).toBe('EX');
    expect(ttl).toBeGreaterThanOrEqual(599);
    expect(ttl).toBeLessThanOrEqual(600);
  });

  it('token đã hết hạn thì không cần ghi vào danh sách đen', async () => {
    expect(await revokeToken('jti-old', Math.floor(Date.now() / 1000) - 10)).toBe(false);
    expect(fakeRedis.set).not.toHaveBeenCalled();
  });

  it('isTokenRevoked: true sau khi thu hồi, false với token khác, true khi thiếu jti', async () => {
    await revokeToken('jti-1', Math.floor(Date.now() / 1000) + 60);
    resetMemoryBlacklist(); // buộc đọc từ Redis (như instance server khác)

    expect(await isTokenRevoked('jti-1')).toBe(true);
    expect(await isTokenRevoked('jti-2')).toBe(false);
    expect(await isTokenRevoked(undefined)).toBe(true);
  });

  it('Redis sập lúc đăng xuất: bản RAM vẫn chặn token trên instance này', async () => {
    fakeRedis.online = false;
    await revokeToken('jti-ram', Math.floor(Date.now() / 1000) + 60);
    expect(await isTokenRevoked('jti-ram')).toBe(true);
  });

  it('Redis sập lúc kiểm tra token chưa thu hồi: fail-open (không đá văng người dùng)', async () => {
    fakeRedis.online = false;
    expect(await isTokenRevoked('jti-never-revoked')).toBe(false);
  });
});
