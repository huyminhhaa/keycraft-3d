import Redis, { RedisOptions } from 'ioredis';

// ==============================================================================
// Các tiền tố Key chuẩn trong Redis phục vụ Bảo mật & Caching
// ==============================================================================
export const REDIS_KEYS = {
  // 1. Chống Brute-force & Theo dõi đăng nhập thất bại
  AUTH_FAIL: (identifier: string) => `keycraft:auth:fails:${identifier}`,
  AUTH_LOCKOUT: (identifier: string) => `keycraft:auth:lockout:${identifier}`,

  // 2. Rate Limiting cho AI Chatbot và API
  AI_RATE_LIMIT: (ip: string) => `keycraft:ratelimit:ai:${ip}`,

  // 3. Cache danh sách Bản build thịnh hành (Trending Builds)
  TRENDING_BUILDS: 'keycraft:cache:trending_builds',
  BUILD_DETAIL: (slug: string) => `keycraft:cache:build:${slug}`,
} as const;

/**
 * Cấu hình kết nối Redis với cơ chế tự động thử lại (Exponential backoff)
 */
const getRedisOptions = (): RedisOptions => {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    };
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  };
};

const globalForRedis = globalThis as unknown as {
  redisClient: Redis | undefined;
};

export const redis =
  globalForRedis.redisClient ??
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', getRedisOptions());

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redisClient = redis;
}

export default redis;
