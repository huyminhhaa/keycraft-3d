import crypto from 'crypto';
import { redis, REDIS_KEYS } from '@/lib/redis';

export const MAX_FAILED_BEFORE_CAPTCHA = 3;
export const MAX_FAILED_BEFORE_LOCKOUT = 5;
export const LOCKOUT_SECONDS = 900; // Khóa 15 phút
export const ATTEMPTS_WINDOW_SECONDS = 3600; // Lưu vết trong 1 giờ

// Bộ nhớ đệm dự phòng (In-memory Fallback) khi Redis chưa được khởi chạy
const memoryFailedStore = new Map<string, { count: number; expireAt: number }>();
const memoryLockoutStore = new Map<string, number>();

/**
 * Kiểm tra trạng thái bảo mật của tài khoản / IP trước khi đăng nhập:
 * 1. Có đang bị khóa tạm thời (Lockout) do dò mật khẩu quá 5 lần không?
 * 2. Có bị bắt buộc phải giải CAPTCHA (do đã nhập sai từ 3 lần) không?
 */
export async function checkLoginSecurity(identifier: string): Promise<{
  isLocked: boolean;
  remainingLockoutSeconds: number;
  requireCaptcha: boolean;
  failedAttempts: number;
}> {
  const normId = identifier.toLowerCase().trim();

  try {
    // 1. Kiểm tra trạng thái khóa (Lockout)
    const lockoutTtl = await redis.ttl(REDIS_KEYS.AUTH_LOCKOUT(normId));
    if (lockoutTtl > 0) {
      return {
        isLocked: true,
        remainingLockoutSeconds: lockoutTtl,
        requireCaptcha: true,
        failedAttempts: MAX_FAILED_BEFORE_LOCKOUT,
      };
    }

    // 2. Kiểm tra số lần đã thử sai
    const failedStr = await redis.get(REDIS_KEYS.AUTH_FAIL(normId));
    const failedAttempts = failedStr ? parseInt(failedStr, 10) : 0;

    return {
      isLocked: false,
      remainingLockoutSeconds: 0,
      requireCaptcha: failedAttempts >= MAX_FAILED_BEFORE_CAPTCHA,
      failedAttempts,
    };
  } catch {
    // Fallback sang bộ nhớ RAM khi Redis ngoại tuyến
    const now = Date.now();
    const lockedUntil = memoryLockoutStore.get(normId);

    if (lockedUntil && lockedUntil > now) {
      const remaining = Math.ceil((lockedUntil - now) / 1000);
      return {
        isLocked: true,
        remainingLockoutSeconds: remaining,
        requireCaptcha: true,
        failedAttempts: MAX_FAILED_BEFORE_LOCKOUT,
      };
    }

    const failedEntry = memoryFailedStore.get(normId);
    if (failedEntry && failedEntry.expireAt > now) {
      return {
        isLocked: false,
        remainingLockoutSeconds: 0,
        requireCaptcha: failedEntry.count >= MAX_FAILED_BEFORE_CAPTCHA,
        failedAttempts: failedEntry.count,
      };
    }

    return {
      isLocked: false,
      remainingLockoutSeconds: 0,
      requireCaptcha: false,
      failedAttempts: 0,
    };
  }
}

/**
 * Ghi nhận một lần nhập sai mật khẩu:
 * - Tăng bộ đếm số lần sai
 * - Tự động kích hoạt CAPTCHA nếu sai >= 3 lần
 * - Tự động khóa tài khoản 15 phút nếu sai >= 5 lần
 */
export async function recordFailedLogin(identifier: string): Promise<{
  requireCaptcha: boolean;
  isLocked: boolean;
  failedAttempts: number;
  remainingLockoutSeconds: number;
}> {
  const normId = identifier.toLowerCase().trim();

  try {
    const failKey = REDIS_KEYS.AUTH_FAIL(normId);
    const count = await redis.incr(failKey);

    // Đặt hạn 1 giờ cho bộ đếm lần sai đầu tiên
    if (count === 1) {
      await redis.expire(failKey, ATTEMPTS_WINDOW_SECONDS);
    }

    if (count >= MAX_FAILED_BEFORE_LOCKOUT) {
      // Khóa tài khoản trong 15 phút
      await redis.set(REDIS_KEYS.AUTH_LOCKOUT(normId), 'locked', 'EX', LOCKOUT_SECONDS);
      return {
        requireCaptcha: true,
        isLocked: true,
        failedAttempts: count,
        remainingLockoutSeconds: LOCKOUT_SECONDS,
      };
    }

    return {
      requireCaptcha: count >= MAX_FAILED_BEFORE_CAPTCHA,
      isLocked: false,
      failedAttempts: count,
      remainingLockoutSeconds: 0,
    };
  } catch {
    // Fallback Memory Store
    const now = Date.now();
    const current = memoryFailedStore.get(normId);
    const newCount = current && current.expireAt > now ? current.count + 1 : 1;

    memoryFailedStore.set(normId, {
      count: newCount,
      expireAt: now + ATTEMPTS_WINDOW_SECONDS * 1000,
    });

    if (newCount >= MAX_FAILED_BEFORE_LOCKOUT) {
      memoryLockoutStore.set(normId, now + LOCKOUT_SECONDS * 1000);
      return {
        requireCaptcha: true,
        isLocked: true,
        failedAttempts: newCount,
        remainingLockoutSeconds: LOCKOUT_SECONDS,
      };
    }

    return {
      requireCaptcha: newCount >= MAX_FAILED_BEFORE_CAPTCHA,
      isLocked: false,
      failedAttempts: newCount,
      remainingLockoutSeconds: 0,
    };
  }
}

/**
 * Xóa sạch lịch sử đăng nhập sai sau khi người dùng nhập đúng mật khẩu
 */
export async function recordSuccessfulLogin(identifier: string): Promise<void> {
  const normId = identifier.toLowerCase().trim();
  try {
    await redis.del(REDIS_KEYS.AUTH_FAIL(normId));
    await redis.del(REDIS_KEYS.AUTH_LOCKOUT(normId));
  } catch {
    memoryFailedStore.delete(normId);
    memoryLockoutStore.delete(normId);
  }
}

// ==============================================================================
// Cơ chế Sinh & Kiểm tra Thử thách CAPTCHA (Cryptographic Signed Challenge)
// ==============================================================================
export interface CaptchaChallenge {
  challengeId: string;
  question: string;
  signature: string;
}

const CAPTCHA_SECRET = process.env.JWT_SECRET || 'keycraft_captcha_salt_fallback_key_2026';

/**
 * Sinh thử thách CAPTCHA dạng toán học kèm chữ ký HMAC chống làm giả
 */
export function generateCaptchaChallenge(): CaptchaChallenge {
  const num1 = Math.floor(Math.random() * 20) + 1;
  const num2 = Math.floor(Math.random() * 20) + 1;
  const answer = (num1 + num2).toString();
  const challengeId = crypto.randomUUID();

  // Tạo chữ ký HMAC dựa trên challengeId + đáp án bí mật
  const signature = crypto
    .createHmac('sha256', CAPTCHA_SECRET)
    .update(`${challengeId}:${answer}`)
    .digest('hex');

  return {
    challengeId,
    question: `Vui lòng tính: ${num1} + ${num2} = ?`,
    signature,
  };
}

/**
 * Xác thực câu trả lời CAPTCHA của người dùng
 */
export function verifyCaptchaChallenge(
  challengeId: string,
  answer: string,
  signature: string
): boolean {
  if (!challengeId || !answer || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', CAPTCHA_SECRET)
    .update(`${challengeId}:${answer.trim()}`)
    .digest('hex');

  // So khớp an toàn chống tấn công timing attack
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
