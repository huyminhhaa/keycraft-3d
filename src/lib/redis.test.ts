import { describe, it, expect } from 'vitest';
import { REDIS_KEYS, redis } from './redis';

describe('Redis Configuration & Key Generators', () => {
  it('tạo đúng định dạng key cho tính năng chống Brute-force', () => {
    const email = 'user@example.com';
    expect(REDIS_KEYS.AUTH_FAIL(email)).toBe('keycraft:auth:fails:user@example.com');
    expect(REDIS_KEYS.AUTH_LOCKOUT(email)).toBe('keycraft:auth:lockout:user@example.com');
  });

  it('tạo đúng định dạng key cho AI Rate Limiting', () => {
    const ip = '192.168.1.1';
    expect(REDIS_KEYS.AI_RATE_LIMIT(ip)).toBe('keycraft:ratelimit:ai:192.168.1.1');
  });

  it('tạo đúng định dạng key cho Caching bản build', () => {
    expect(REDIS_KEYS.TRENDING_BUILDS).toBe('keycraft:cache:trending_builds');
    expect(REDIS_KEYS.BUILD_DETAIL('thock-75')).toBe('keycraft:cache:build:thock-75');
  });

  it('khởi tạo singleton redis client hợp lệ', () => {
    expect(redis).toBeDefined();
    expect(typeof redis.get).toBe('function');
    expect(typeof redis.set).toBe('function');
  });
});
