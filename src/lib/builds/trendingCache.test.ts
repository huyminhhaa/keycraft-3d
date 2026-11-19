import { describe, it, expect, vi } from 'vitest';
import {
  currentTrendingCacheKey,
  invalidateTrendingCache,
  trendingCacheKey,
  type TrendingCacheStore,
} from './trendingCache';

/** Redis giả: chỉ cần GET/INCR trên một Map */
function fakeStore(): TrendingCacheStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    incr: async (key) => {
      const next = Number(data.get(key) ?? '0') + 1;
      data.set(key, String(next));
      return next;
    },
  };
}

describe('Trending cache versioning (src/lib/builds/trendingCache.ts)', () => {
  it('khoá cache chứa phiên bản + limit + offset', () => {
    expect(trendingCacheKey('3', 12, 24)).toBe('keycraft:cache:trending_builds:v3:12:24');
  });

  it('chưa có phiên bản nào -> dùng v0', async () => {
    expect(await currentTrendingCacheKey(12, 0, fakeStore())).toBe('keycraft:cache:trending_builds:v0:12:0');
  });

  it('invalidate làm MỌI trang đã cache đổi khoá ngay lập tức (không cần biết limit/offset)', async () => {
    const store = fakeStore();
    const before = [
      await currentTrendingCacheKey(12, 0, store),
      await currentTrendingCacheKey(50, 100, store),
    ];

    await invalidateTrendingCache(store);

    const after = [
      await currentTrendingCacheKey(12, 0, store),
      await currentTrendingCacheKey(50, 100, store),
    ];
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[0]).toContain(':v1:');
  });

  it('Redis lỗi khi invalidate không làm hỏng thao tác chính (xoá/sửa build)', async () => {
    const broken: TrendingCacheStore = {
      get: vi.fn().mockRejectedValue(new Error('offline')),
      incr: vi.fn().mockRejectedValue(new Error('offline')),
    };
    await expect(invalidateTrendingCache(broken)).resolves.toBeUndefined();
  });
});
