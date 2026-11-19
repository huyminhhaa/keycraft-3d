import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { builds, type Build, type NewBuild } from '@/db/schema';
import { redis, REDIS_KEYS } from '@/lib/redis';
import type { KeyboardState } from '@/types/keyboard';
import {
  currentTrendingCacheKey,
  invalidateTrendingCache,
  TRENDING_CACHE_TTL_SECONDS,
} from './trendingCache';

export interface CreateBuildInput {
  title: string;
  description?: string | null;
  config: KeyboardState;
  userId?: string | null;
  isPublic?: boolean;
}

// In-memory fallback repository khi PostgreSQL offline hoặc trong môi trường test.
// Gắn vào globalThis: ở `next dev`, route API và trang được đóng gói thành các module riêng,
// mỗi bên một Map thì build vừa lưu qua API sẽ không hiện trên trang.
const globalForBuilds = globalThis as unknown as { keycraftMemoryBuilds?: Map<string, Build> };
const memoryBuilds = (globalForBuilds.keycraftMemoryBuilds ??= new Map<string, Build>());

/**
 * Reset memory store (dùng trong test)
 */
export function resetMemoryBuilds() {
  memoryBuilds.clear();
}

/**
 * Chuyển đổi tiêu đề thành chuỗi slug thân thiện với URL (SEO-friendly)
 * Hỗ trợ chuyển đổi toàn bộ ký tự tiếng Việt có dấu sang không dấu
 */
export function slugify(text: string): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Xóa dấu tiếng Việt
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '') // Xóa ký tự đặc biệt
    .trim()
    .replace(/\s+/g, '-'); // Thay khoảng trắng bằng dấu gạch ngang

  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${normalized || 'custom-keyboard'}-${randomSuffix}`;
}

/**
 * Lưu một bản build mới vào cơ sở dữ liệu và xóa cache Trending Builds
 */
export async function createBuild(input: CreateBuildInput): Promise<Build> {
  const slug = slugify(input.title);

  const newBuildData: NewBuild = {
    slug,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    userId: input.userId || null,
    config: input.config,
    isPublic: input.isPublic ?? true,
    viewCount: 0,
    forkCount: 0,
  };

  let savedBuild: Build;

  if (process.env.NODE_ENV !== 'test') {
    try {
      const [inserted] = await db.insert(builds).values(newBuildData).returning();
      savedBuild = inserted;

      // Làm mới danh sách trending (tăng số phiên bản cache)
      await invalidateTrendingCache();

      return savedBuild;
    } catch {
      // Fallback sang in-memory store nếu Database container offline
    }
  }

  // Fallback in-memory
  const mockId = `build-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  savedBuild = {
    id: mockId,
    slug,
    title: newBuildData.title,
    description: newBuildData.description ?? null,
    userId: newBuildData.userId ?? null,
    config: newBuildData.config,
    viewCount: 0,
    forkCount: 0,
    isPublic: newBuildData.isPublic ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  memoryBuilds.set(slug, savedBuild);
  return savedBuild;
}

/**
 * Lấy danh sách các bản build thịnh hành (Trending Builds)
 * Áp dụng Redis Cache-Aside Pattern (TTL 60 giây)
 */
export async function getTrendingBuilds(limit = 12, offset = 0): Promise<Build[]> {
  // Khoá cache gắn số phiên bản hiện tại; null = Redis offline -> bỏ qua cache
  let cacheKey: string | null = null;

  // 1. Thử lấy từ Redis Cache (Cache Hit)
  if (process.env.NODE_ENV !== 'test') {
    try {
      cacheKey = await currentTrendingCacheKey(limit, offset);
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as Build[];
      }
    } catch {
      // Redis offline -> Bỏ qua và truy vấn DB trực tiếp
    }
  }

  // 2. Truy vấn Database (Cache Miss)
  let result: Build[] = [];

  if (process.env.NODE_ENV !== 'test') {
    try {
      result = await db
        .select()
        .from(builds)
        .where(eq(builds.isPublic, true))
        .orderBy(desc(builds.viewCount), desc(builds.createdAt))
        .limit(limit)
        .offset(offset);

      // Ghi kết quả vào Redis Cache với TTL 60s
      if (cacheKey) {
        try {
          await redis.setex(cacheKey, TRENDING_CACHE_TTL_SECONDS, JSON.stringify(result));
        } catch {
          // Silent cache error
        }
      }

      return result;
    } catch {
      // Database offline -> Fallback sang memoryBuilds
    }
  }

  // 3. In-memory Fallback
  result = Array.from(memoryBuilds.values())
    .filter((b) => b.isPublic)
    .sort((a, b) => b.viewCount - a.viewCount || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(offset, offset + limit);

  return result;
}

/**
 * Lấy thông tin chi tiết một bản build theo slug và tự động tăng lượt xem
 */
export async function getBuildBySlug(
  slug: string,
  incrementView = true
): Promise<Build | null> {
  const cacheKey = REDIS_KEYS.BUILD_DETAIL(slug);

  if (process.env.NODE_ENV !== 'test') {
    try {
      // 1. Tăng viewCount nếu incrementView = true
      if (incrementView) {
        await db
          .update(builds)
          .set({
            viewCount: sql`${builds.viewCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(builds.slug, slug));
      }

      // 2. Đọc bản build mới nhất
      const [record] = await db
        .select()
        .from(builds)
        .where(eq(builds.slug, slug))
        .limit(1);

      if (record) {
        // Cập nhật Redis Cache với TTL 300s (5 phút)
        try {
          await redis.setex(cacheKey, 300, JSON.stringify(record));
        } catch {
          // Silent cache error
        }
        return record;
      }
      return null;
    } catch {
      // Database offline -> Fallback in-memory
    }
  }

  // Fallback in-memory
  const record = memoryBuilds.get(slug);
  if (!record) return null;

  if (incrementView) {
    record.viewCount += 1;
    record.updatedAt = new Date();
  }

  return { ...record };
}

/**
 * Mọi bản build của một người dùng (cả công khai lẫn riêng tư), mới nhất trước.
 * Chỉ gọi với userId lấy từ phiên đăng nhập phía server — không bao giờ từ input của client.
 */
export async function listUserBuilds(userId: string, limit = 200): Promise<Build[]> {
  if (process.env.NODE_ENV !== 'test') {
    try {
      return await db
        .select()
        .from(builds)
        .where(eq(builds.userId, userId))
        .orderBy(desc(builds.createdAt))
        .limit(limit);
    } catch {
      // Database offline -> Fallback in-memory
    }
  }

  return Array.from(memoryBuilds.values())
    .filter((b) => b.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((b) => ({ ...b }));
}

// ==============================================================================
// Phân quyền theo đối tượng (chống IDOR / Broken Object-Level Authorization)
// ==============================================================================

/** Ai được xem bản build: công khai -> mọi người; riêng tư -> chỉ chủ sở hữu */
export function canViewBuild(build: Pick<Build, 'isPublic' | 'userId'>, viewerId: string | null): boolean {
  return build.isPublic || (build.userId !== null && build.userId === viewerId);
}

/** Chỉ chủ sở hữu mới được sửa/xoá. Build ẩn danh (userId null) thì không ai sửa được */
export function isBuildOwner(build: Pick<Build, 'userId'>, userId: string | null): boolean {
  return Boolean(userId) && build.userId !== null && build.userId === userId;
}

export interface UpdateBuildInput {
  title?: string;
  description?: string | null;
  config?: KeyboardState;
  isPublic?: boolean;
}

export type BuildMutationResult =
  | { status: 'ok'; build: Build }
  | { status: 'not_found' }
  | { status: 'forbidden' };

async function invalidateBuildCache(slug: string): Promise<void> {
  try {
    await redis.del(REDIS_KEYS.BUILD_DETAIL(slug));
  } catch {
    // Silent cache error
  }
  // Build vừa bị xoá / chuyển riêng tư biến mất khỏi trending ngay, không đợi TTL 60 giây
  await invalidateTrendingCache();
}

/**
 * Cập nhật bản build — chỉ chủ sở hữu. Câu UPDATE kèm điều kiện `user_id = $userId`
 * nên dù có race condition cũng không ghi đè được build của người khác.
 */
export async function updateBuild(
  slug: string,
  userId: string,
  patch: UpdateBuildInput
): Promise<BuildMutationResult> {
  const existing = await getBuildBySlug(slug, false);
  if (!existing) return { status: 'not_found' };
  if (!isBuildOwner(existing, userId)) return { status: 'forbidden' };

  const changes = {
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
    ...(patch.config !== undefined ? { config: patch.config } : {}),
    ...(patch.isPublic !== undefined ? { isPublic: patch.isPublic } : {}),
    updatedAt: new Date(),
  };

  if (process.env.NODE_ENV !== 'test') {
    try {
      const [row] = await db
        .update(builds)
        .set(changes)
        .where(and(eq(builds.slug, slug), eq(builds.userId, userId)))
        .returning();
      await invalidateBuildCache(slug);
      return row ? { status: 'ok', build: row } : { status: 'forbidden' };
    } catch {
      // Database offline -> Fallback in-memory
    }
  }

  const record = memoryBuilds.get(slug);
  if (!record || !isBuildOwner(record, userId)) return { status: 'forbidden' };
  const updated: Build = { ...record, ...changes };
  memoryBuilds.set(slug, updated);
  return { status: 'ok', build: { ...updated } };
}

/** Xoá bản build — chỉ chủ sở hữu */
export async function deleteBuild(slug: string, userId: string): Promise<BuildMutationResult> {
  const existing = await getBuildBySlug(slug, false);
  if (!existing) return { status: 'not_found' };
  if (!isBuildOwner(existing, userId)) return { status: 'forbidden' };

  if (process.env.NODE_ENV !== 'test') {
    try {
      const [row] = await db
        .delete(builds)
        .where(and(eq(builds.slug, slug), eq(builds.userId, userId)))
        .returning();
      await invalidateBuildCache(slug);
      return row ? { status: 'ok', build: row } : { status: 'forbidden' };
    } catch {
      // Database offline -> Fallback in-memory
    }
  }

  const record = memoryBuilds.get(slug);
  if (!record || !isBuildOwner(record, userId)) return { status: 'forbidden' };
  memoryBuilds.delete(slug);
  return { status: 'ok', build: record };
}

/**
 * Remix / Fork một bản build có sẵn
 * Tăng forkCount của build gốc và tạo bản build mới
 */
export async function forkBuild(
  originalSlug: string,
  userId?: string | null,
  customTitle?: string
): Promise<Build | null> {
  const original = await getBuildBySlug(originalSlug, false);
  if (!original) return null;

  // 1. Tăng forkCount của build gốc
  if (process.env.NODE_ENV !== 'test') {
    try {
      await db
        .update(builds)
        .set({
          forkCount: sql`${builds.forkCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(builds.slug, originalSlug));
    } catch {
      // Fallback
    }
  }

  // Luôn cập nhật trong memory store
  const memOriginal = memoryBuilds.get(originalSlug);
  if (memOriginal) {
    memOriginal.forkCount += 1;
    memOriginal.updatedAt = new Date();
  }

  // 2. Tạo build mới được remix
  const newTitle = customTitle?.trim() || `Remix: ${original.title}`;
  const forked = await createBuild({
    title: newTitle,
    description: `Remix từ bản build "${original.title}" (/@${original.slug}).`,
    config: original.config,
    userId: userId ?? null,
    isPublic: true,
  });

  return forked;
}
