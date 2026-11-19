import { redis, REDIS_KEYS } from '@/lib/redis';

/**
 * Cache danh sách Trending Builds theo "số phiên bản" (cache versioning).
 *
 * Danh sách được cache theo từng trang: `trending_builds:v<phiên bản>:<limit>:<offset>`.
 * Xoá từng khoá khi có build mới/sửa/xoá là không khả thi (không biết trước limit/offset nào
 * đã được cache, SCAN thì chậm). Thay vào đó ta tăng số phiên bản: mọi khoá cũ lập tức không
 * còn ai đọc tới và tự hết hạn sau TTL 60 giây.
 */

export const TRENDING_CACHE_TTL_SECONDS = 60;

/** Phần Redis cần dùng (cho phép tiêm client giả trong unit test) */
export interface TrendingCacheStore {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
}

const redisStore: TrendingCacheStore = {
  get: (key) => redis.get(key),
  incr: (key) => redis.incr(key),
};

export function trendingCacheKey(version: string, limit: number, offset: number): string {
  return `${REDIS_KEYS.TRENDING_BUILDS}:v${version}:${limit}:${offset}`;
}

/** Khoá cache của trang trending hiện tại (đọc số phiên bản mới nhất) */
export async function currentTrendingCacheKey(
  limit: number,
  offset: number,
  store: TrendingCacheStore = redisStore
): Promise<string> {
  const version = (await store.get(REDIS_KEYS.TRENDING_VERSION)) ?? '0';
  return trendingCacheKey(version, limit, offset);
}

/** Vô hiệu hoá toàn bộ cache trending ngay lập tức. Lỗi Redis không làm hỏng thao tác chính */
export async function invalidateTrendingCache(store: TrendingCacheStore = redisStore): Promise<void> {
  try {
    await store.incr(REDIS_KEYS.TRENDING_VERSION);
  } catch {
    // Redis offline: cache cũ tự hết hạn sau TTL
  }
}
