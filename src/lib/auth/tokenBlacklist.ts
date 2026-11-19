import { redis, REDIS_KEYS } from '@/lib/redis';

/**
 * Danh sách đen JWT (Token Revocation).
 *
 * JWT là "stateless": server không lưu, nên một token bị lộ vẫn dùng được đến khi hết hạn.
 * Khi đăng xuất ta ghi `jti` của token vào Redis với TTL = thời gian sống còn lại của token;
 * hết TTL thì token cũng đã hết hạn nên khoá tự biến mất, Redis không phình ra.
 */

// Fallback RAM khi Redis offline: jti -> thời điểm hết hạn (ms)
const memoryRevoked = new Map<string, number>();

export function resetMemoryBlacklist(): void {
  memoryRevoked.clear();
}

/** Số giây còn lại đến `exp` (giây Unix). Trả về 0 nếu đã hết hạn hoặc không có exp */
export function remainingTtlSeconds(exp: number | undefined, nowMs = Date.now()): number {
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return 0;
  return Math.max(0, Math.ceil(exp - nowMs / 1000));
}

/**
 * Thu hồi một token theo jti. Token đã hết hạn thì không cần lưu.
 * @returns true nếu đã ghi vào danh sách đen
 */
export async function revokeToken(jti: string | undefined, exp: number | undefined): Promise<boolean> {
  if (!jti) return false;
  const ttl = remainingTtlSeconds(exp);
  if (ttl <= 0) return false;

  // Luôn ghi RAM để instance hiện tại chặn ngay cả khi Redis chập chờn
  memoryRevoked.set(jti, Date.now() + ttl * 1000);
  try {
    await redis.set(REDIS_KEYS.TOKEN_BLACKLIST(jti), '1', 'EX', ttl);
  } catch {
    // Redis offline -> chỉ còn bản RAM
  }
  return true;
}

/** Token (theo jti) đã bị thu hồi chưa? */
export async function isTokenRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return true; // Không có jti = không thể thu hồi -> coi như không hợp lệ

  const memExpire = memoryRevoked.get(jti);
  if (memExpire !== undefined) {
    if (memExpire > Date.now()) return true;
    memoryRevoked.delete(jti);
  }

  try {
    return (await redis.exists(REDIS_KEYS.TOKEN_BLACKLIST(jti))) === 1;
  } catch {
    // Redis offline: fail-open (không đá văng mọi người dùng chỉ vì cache sập),
    // token vẫn bị giới hạn bởi hạn dùng 15 phút của access token
    return false;
  }
}
