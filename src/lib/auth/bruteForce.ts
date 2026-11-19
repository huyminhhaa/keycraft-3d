import crypto from 'crypto';
import { redis, REDIS_KEYS } from '@/lib/redis';
import { getSigningSecret } from '@/lib/auth/jwt';
import { POW_DIFFICULTY, verifyPow } from '@/lib/auth/powCaptcha';

export const MAX_FAILED_BEFORE_CAPTCHA = 3;
export const MAX_FAILED_BEFORE_LOCKOUT = 5;
export const LOCKOUT_SECONDS = 900; // Khóa 15 phút
export const ATTEMPTS_WINDOW_SECONDS = 3600; // Lưu vết trong 1 giờ

// Chống Password Spraying: một IP thử sai nhiều tài khoản khác nhau
export const IP_MAX_DISTINCT_ACCOUNTS = 5; // sai trên >= 5 email khác nhau
export const IP_MAX_FAILED_ATTEMPTS = 20; // hoặc tổng >= 20 lần sai
export const IP_LOCKOUT_SECONDS = 1800; // Khóa IP 30 phút

// CAPTCHA
export const CAPTCHA_CHALLENGE_TTL_SECONDS = 300; // Đề toán sống 5 phút
export const CAPTCHA_TOKEN_TTL_SECONDS = 180; // Vé nonce sống 3 phút, dùng đúng 1 lần

// Bộ nhớ đệm dự phòng (In-memory Fallback) khi Redis chưa được khởi chạy
const memoryFailedStore = new Map<string, { count: number; expireAt: number }>();
const memoryLockoutStore = new Map<string, number>();
const memoryIpStore = new Map<string, { count: number; accounts: Set<string>; expireAt: number }>();
const memoryIpLockout = new Map<string, number>();
const memoryCaptchaUsed = new Map<string, number>();
const memoryCaptchaTokens = new Map<string, { boundTo: string; expireAt: number }>();

/** Reset toàn bộ bộ nhớ RAM dự phòng (dùng trong unit test) */
export function resetBruteForceMemory(): void {
  memoryFailedStore.clear();
  memoryLockoutStore.clear();
  memoryIpStore.clear();
  memoryIpLockout.clear();
  memoryCaptchaUsed.clear();
  memoryCaptchaTokens.clear();
}

/**
 * So sánh hằng thời gian cho chuỗi bất kỳ độ dài.
 * `crypto.timingSafeEqual` ném RangeError khi 2 Buffer khác độ dài (kẻ tấn công gửi chữ ký
 * sai độ dài là làm route sập 500). Băm SHA-256 cả hai trước -> luôn 32 byte.
 */
export function safeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

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
// Khoá theo IP (chống Password Spraying)
// Kẻ tấn công thử 1 mật khẩu phổ biến trên RẤT NHIỀU email: mỗi email chỉ sai 1-2 lần nên
// không chạm ngưỡng khoá theo email. Ta đếm theo IP: số lần sai và số email khác nhau.
// ==============================================================================

/** IP không xác định (thiếu header proxy) thì không khoá, tránh khoá nhầm cả nhóm người dùng */
const isTrackableIp = (ip: string): boolean => Boolean(ip) && ip !== 'unknown';

export async function checkIpSecurity(
  ip: string
): Promise<{ isLocked: boolean; remainingLockoutSeconds: number }> {
  if (!isTrackableIp(ip)) return { isLocked: false, remainingLockoutSeconds: 0 };
  try {
    const ttl = await redis.ttl(REDIS_KEYS.AUTH_IP_LOCKOUT(ip));
    return { isLocked: ttl > 0, remainingLockoutSeconds: Math.max(0, ttl) };
  } catch {
    const lockedUntil = memoryIpLockout.get(ip);
    const now = Date.now();
    if (lockedUntil && lockedUntil > now) {
      return { isLocked: true, remainingLockoutSeconds: Math.ceil((lockedUntil - now) / 1000) };
    }
    return { isLocked: false, remainingLockoutSeconds: 0 };
  }
}

export async function recordFailedLoginForIp(
  ip: string,
  identifier: string
): Promise<{ isLocked: boolean; failedAttempts: number; distinctAccounts: number }> {
  if (!isTrackableIp(ip)) return { isLocked: false, failedAttempts: 0, distinctAccounts: 0 };
  const normId = identifier.toLowerCase().trim();

  let failedAttempts: number;
  let distinctAccounts: number;

  try {
    const failKey = REDIS_KEYS.AUTH_IP_FAIL(ip);
    const accountsKey = REDIS_KEYS.AUTH_IP_ACCOUNTS(ip);
    const reply = await redis
      .multi()
      .incr(failKey)
      .expire(failKey, ATTEMPTS_WINDOW_SECONDS) // gia hạn mỗi lần sai: còn tấn công thì còn nhớ
      .sadd(accountsKey, normId)
      .expire(accountsKey, ATTEMPTS_WINDOW_SECONDS)
      .scard(accountsKey)
      .exec();
    if (!reply) throw new Error('Redis multi bị huỷ');
    failedAttempts = Number(reply[0]?.[1] ?? 0);
    distinctAccounts = Number(reply[4]?.[1] ?? 0);

    const shouldLock =
      distinctAccounts >= IP_MAX_DISTINCT_ACCOUNTS || failedAttempts >= IP_MAX_FAILED_ATTEMPTS;
    if (shouldLock) {
      await redis.set(REDIS_KEYS.AUTH_IP_LOCKOUT(ip), 'locked', 'EX', IP_LOCKOUT_SECONDS);
    }
    return { isLocked: shouldLock, failedAttempts, distinctAccounts };
  } catch {
    const now = Date.now();
    const current = memoryIpStore.get(ip);
    const entry =
      current && current.expireAt > now
        ? current
        : { count: 0, accounts: new Set<string>(), expireAt: now + ATTEMPTS_WINDOW_SECONDS * 1000 };
    entry.count += 1;
    entry.accounts.add(normId);
    memoryIpStore.set(ip, entry);

    failedAttempts = entry.count;
    distinctAccounts = entry.accounts.size;
    const shouldLock =
      distinctAccounts >= IP_MAX_DISTINCT_ACCOUNTS || failedAttempts >= IP_MAX_FAILED_ATTEMPTS;
    if (shouldLock) {
      memoryIpLockout.set(ip, now + IP_LOCKOUT_SECONDS * 1000);
    }
    return { isLocked: shouldLock, failedAttempts, distinctAccounts };
  }
}

// ==============================================================================
// CAPTCHA Proof-of-Work có chữ ký (xem src/lib/auth/powCaptcha.ts)
// Trước đây là phép cộng 2 số: script giải tức thì, không tốn gì. Giờ mỗi đề buộc trình duyệt
// (hoặc bot) băm SHA-256 trung bình 2^17 lần -> người dùng không phải gõ, bot phải trả CPU mỗi lượt.
// ==============================================================================
export interface CaptchaChallenge {
  /** `<uuid>.<expiresAtMs>` — vừa là "muối" của bài băm, vừa chứa hạn dùng (được ký nên không sửa được) */
  challengeId: string;
  /** Số bit 0 đầu tiên mà SHA-256("<challengeId>:<n>") phải đạt */
  difficulty: number;
  signature: string;
}

/** Khoá HMAC riêng cho CAPTCHA, dẫn xuất từ JWT_SECRET (production bắt buộc có khoá thật) */
function captchaKey(): Buffer {
  return crypto
    .createHmac('sha256', getSigningSecret('JWT_SECRET'))
    .update('keycraft-captcha-pow-v3')
    .digest();
}

/** Độ khó PoW: env CAPTCHA_POW_DIFFICULTY (8..24) hoặc mặc định 17 bit */
export function captchaDifficulty(): number {
  const value = Number(process.env.CAPTCHA_POW_DIFFICULTY);
  return Number.isInteger(value) && value >= 8 && value <= 24 ? value : POW_DIFFICULTY;
}

/** Chữ ký phủ cả độ khó: không hạ độ khó xuống 0 rồi nộp lời giải rẻ được */
function signChallenge(challengeId: string, difficulty: number): string {
  return crypto.createHmac('sha256', captchaKey()).update(`${challengeId}:${difficulty}`).digest('hex');
}

/** Sinh đề Proof-of-Work kèm chữ ký HMAC chống làm giả */
export function generateCaptchaChallenge(nowMs = Date.now()): CaptchaChallenge {
  const expiresAt = nowMs + CAPTCHA_CHALLENGE_TTL_SECONDS * 1000;
  const challengeId = `${crypto.randomUUID()}.${expiresAt}`;
  const difficulty = captchaDifficulty();
  return { challengeId, difficulty, signature: signChallenge(challengeId, difficulty) };
}

function challengeExpiry(challengeId: string): number | null {
  const parts = challengeId.split('.');
  if (parts.length !== 2) return null;
  const expiresAt = Number(parts[1]);
  return Number.isSafeInteger(expiresAt) ? expiresAt : null;
}

/**
 * Xác thực lời giải CAPTCHA: chữ ký đề + hạn dùng + lời giải Proof-of-Work. Không ném lỗi với input lạ.
 * Lưu ý: hàm này KHÔNG đánh dấu đề đã dùng — luồng đăng nhập phải đi qua
 * `redeemCaptchaChallenge` để nhận vé dùng 1 lần.
 */
export function verifyCaptchaChallenge(
  challengeId: unknown,
  answer: unknown,
  signature: unknown,
  nowMs = Date.now()
): boolean {
  if (typeof challengeId !== 'string' || typeof answer !== 'string' || typeof signature !== 'string') {
    return false;
  }
  if (!challengeId || !signature || challengeId.length > 100 || !/^\d{1,12}$/.test(answer)) {
    return false;
  }

  const expiresAt = challengeExpiry(challengeId);
  if (expiresAt === null || expiresAt < nowMs) return false;

  // So khớp an toàn chống timing attack, không sập khi độ dài khác nhau
  const difficulty = captchaDifficulty();
  if (!safeEqual(signature, signChallenge(challengeId, difficulty))) return false;
  return verifyPow(challengeId, answer, difficulty);
}

/**
 * Giải đúng CAPTCHA -> đổi lấy một vé nonce ngẫu nhiên (TTL 3 phút) lưu trên Redis.
 * Mỗi đề chỉ đổi được đúng 1 vé (SET NX), nên chép lại request giải đề cũ là vô ích.
 * @param boundTo email mà vé được phép dùng (vé không chuyển sang tài khoản khác được)
 * @returns vé nonce, hoặc null nếu sai / hết hạn / đề đã dùng
 */
export async function redeemCaptchaChallenge(
  challengeId: unknown,
  answer: unknown,
  signature: unknown,
  boundTo: string
): Promise<string | null> {
  if (!verifyCaptchaChallenge(challengeId, answer, signature)) return null;
  const id = challengeId as string;
  const normBound = boundTo.toLowerCase().trim();
  const nonce = crypto.randomBytes(32).toString('base64url');

  try {
    const firstUse = await redis.set(
      REDIS_KEYS.CAPTCHA_USED(id),
      '1',
      'EX',
      CAPTCHA_CHALLENGE_TTL_SECONDS,
      'NX'
    );
    if (firstUse !== 'OK') return null;
    await redis.set(REDIS_KEYS.CAPTCHA_TOKEN(nonce), normBound, 'EX', CAPTCHA_TOKEN_TTL_SECONDS);
    return nonce;
  } catch {
    const now = Date.now();
    const usedUntil = memoryCaptchaUsed.get(id);
    if (usedUntil && usedUntil > now) return null;
    memoryCaptchaUsed.set(id, now + CAPTCHA_CHALLENGE_TTL_SECONDS * 1000);
    memoryCaptchaTokens.set(nonce, {
      boundTo: normBound,
      expireAt: now + CAPTCHA_TOKEN_TTL_SECONDS * 1000,
    });
    return nonce;
  }
}

const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Kiểm tra và TIÊU HUỶ vé CAPTCHA ngay lập tức (GETDEL nguyên tử).
 * Gửi lại cùng vé lần 2 (Replay Attack) -> vé không còn -> false.
 */
export async function consumeCaptchaToken(token: unknown, identifier: string): Promise<boolean> {
  if (typeof token !== 'string' || !NONCE_PATTERN.test(token)) return false;
  const normId = identifier.toLowerCase().trim();

  try {
    const boundTo = await redis.getdel(REDIS_KEYS.CAPTCHA_TOKEN(token));
    return boundTo !== null && safeEqual(boundTo, normId);
  } catch {
    const entry = memoryCaptchaTokens.get(token);
    memoryCaptchaTokens.delete(token);
    return Boolean(entry && entry.expireAt > Date.now() && safeEqual(entry.boundTo, normId));
  }
}
