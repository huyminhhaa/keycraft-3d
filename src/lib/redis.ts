import Redis, { RedisOptions } from 'ioredis';

// ==============================================================================
// Các tiền tố Key chuẩn trong Redis phục vụ Bảo mật & Caching
// ==============================================================================
export const REDIS_KEYS = {
  // 1. Chống Brute-force & Theo dõi đăng nhập thất bại
  AUTH_FAIL: (identifier: string) => `keycraft:auth:fails:${identifier}`,
  AUTH_LOCKOUT: (identifier: string) => `keycraft:auth:lockout:${identifier}`,

  // Chống Password Spraying: theo dõi theo IP (số lần sai + tập email đã thử)
  AUTH_IP_FAIL: (ip: string) => `keycraft:auth:ipfails:${ip}`,
  AUTH_IP_ACCOUNTS: (ip: string) => `keycraft:auth:ipaccounts:${ip}`,
  AUTH_IP_LOCKOUT: (ip: string) => `keycraft:auth:iplockout:${ip}`,

  // CAPTCHA dùng 1 lần: đề đã giải (chống đổi 1 đề lấy nhiều vé) + vé nonce sau khi giải
  CAPTCHA_USED: (challengeId: string) => `keycraft:captcha:used:${challengeId}`,
  CAPTCHA_TOKEN: (nonce: string) => `keycraft:captcha:token:${nonce}`,

  // Danh sách đen JWT đã đăng xuất (theo jti)
  TOKEN_BLACKLIST: (jti: string) => `keycraft:auth:revoked:${jti}`,

  // 2. Rate Limiting cho AI Chatbot và API (Sliding Window, sorted set)
  AI_RATE_LIMIT: (ip: string) => `keycraft:ratelimit:ai:${ip}`,
  RATE_LIMIT: (scope: string, id: string) => `keycraft:ratelimit:${scope}:${id}`,

  // 3. Cache danh sách Bản build thịnh hành (Trending Builds)
  TRENDING_BUILDS: 'keycraft:cache:trending_builds',
  // Số phiên bản cache trending: tăng lên là mọi trang trending đã cache hết hiệu lực
  TRENDING_VERSION: 'keycraft:cache:trending_builds:version',
  BUILD_DETAIL: (slug: string) => `keycraft:cache:build:${slug}`,
} as const;

/**
 * Cấu hình kết nối Redis với cơ chế tự động thử lại (Exponential backoff)
 */
const getRedisOptions = (): RedisOptions => {
  const isTest = process.env.NODE_ENV === 'test';

  const baseOptions: RedisOptions = {
    lazyConnect: true,
    enableOfflineQueue: false, // Tránh treo request khi Redis offline
    connectTimeout: 500,
    maxRetriesPerRequest: isTest ? 1 : 2,
    retryStrategy: isTest ? () => null : (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
  };

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return baseOptions;
  }

  return {
    ...baseOptions,
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
};

const globalForRedis = globalThis as unknown as {
  redisClient: Redis | undefined;
};

export const redis =
  globalForRedis.redisClient ??
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', getRedisOptions());

// Lắng nghe lỗi ioredis để tránh uncaught error event trong console
redis.on('error', () => {
  // Silent fallback khi Redis container chưa bật
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redisClient = redis;
}

export default redis;
