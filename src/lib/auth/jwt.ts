import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify, JWTPayload } from 'jose';

export type AuthProvider = 'credentials' | 'google';

export interface UserJWTPayload extends JWTPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  authProvider?: AuthProvider;
  type?: 'access' | 'refresh';
}

const DEFAULT_SECRET = 'keycraft_super_secret_jwt_key_at_least_32_chars_long!';
const DEFAULT_REFRESH_SECRET = 'keycraft_super_refresh_jwt_key_at_least_32_chars!';

/** Các giá trị mẫu/mặc định công khai — dùng trên production là ai cũng ký được token giả */
const KNOWN_WEAK_SECRETS = new Set([
  DEFAULT_SECRET,
  DEFAULT_REFRESH_SECRET,
  'your_jwt_secret_key_minimum_32_characters_here',
  'your_jwt_refresh_secret_key_minimum_32_characters_here',
  'keycraft_captcha_salt_fallback_key_2026',
]);

export const MIN_SECRET_LENGTH = 32;

export class FatalSecurityError extends Error {
  constructor(message: string) {
    super(`Fatal Security Error: ${message}`);
    this.name = 'FatalSecurityError';
  }
}

type SecretName = 'JWT_SECRET' | 'JWT_REFRESH_SECRET';

/**
 * Lấy khoá ký JWT. Production: thiếu, quá ngắn hoặc trùng giá trị mặc định -> ném FatalSecurityError
 * (không có đường vòng). Dev/test: cho phép khoá mặc định để chạy local không cần cấu hình.
 */
export function getSigningSecret(name: SecretName): string {
  const value = process.env[name];
  if (process.env.NODE_ENV === 'production') {
    if (!value) {
      throw new FatalSecurityError(`${name} chưa được cấu hình trên môi trường production.`);
    }
    if (KNOWN_WEAK_SECRETS.has(value) || value.length < MIN_SECRET_LENGTH) {
      throw new FatalSecurityError(
        `${name} đang dùng giá trị mặc định hoặc ngắn hơn ${MIN_SECRET_LENGTH} ký tự.`
      );
    }
    return value;
  }
  return value || (name === 'JWT_SECRET' ? DEFAULT_SECRET : DEFAULT_REFRESH_SECRET);
}

/** Kiểm tra toàn bộ khoá ngay khi server khởi động (gọi từ `src/instrumentation.ts`) */
export function assertProductionSecrets(): void {
  getSigningSecret('JWT_SECRET');
  getSigningSecret('JWT_REFRESH_SECRET');
}

/**
 * Tạo JWK (JSON Web Key) chuẩn đối xứng, an toàn 100% không bị lỗi realm mismatch trong JSDOM / Node
 */
const getSymmetricJWK = (secret: string) => ({
  kty: 'oct',
  k: Buffer.from(secret).toString('base64url'),
});

export const COOKIE_ACCESS_TOKEN = 'keycraft_access_token';
export const COOKIE_REFRESH_TOKEN = 'keycraft_refresh_token';

/**
 * Ký tạo Access Token ngắn hạn (mặc định 15 phút)
 */
export async function signAccessToken(payload: Omit<UserJWTPayload, 'type'>): Promise<string> {
  const secret = getSigningSecret('JWT_SECRET');
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(randomUUID()) // Mã định danh riêng để thu hồi token khi đăng xuất
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || '15m')
    .sign(getSymmetricJWK(secret));
}

/**
 * Ký tạo Refresh Token dài hạn (mặc định 7 ngày)
 */
export async function signRefreshToken(payload: Omit<UserJWTPayload, 'type'>): Promise<string> {
  const secret = getSigningSecret('JWT_REFRESH_SECRET');
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    .sign(getSymmetricJWK(secret));
}

/**
 * Giải mã và thẩm định tính hợp lệ của Token (chữ ký, hạn dùng, loại, có `jti`).
 * Không kiểm tra danh sách đen — việc đó nằm ở `getSessionFromRequest` (cần Redis).
 */
export async function verifyToken(
  token: string,
  type: 'access' | 'refresh' = 'access'
): Promise<UserJWTPayload | null> {
  // Lỗi cấu hình khoá trên production phải nổ ra ngoài, không bị nuốt thành "token sai"
  const secret = getSigningSecret(type === 'access' ? 'JWT_SECRET' : 'JWT_REFRESH_SECRET');
  try {
    const { payload } = await jwtVerify(token, getSymmetricJWK(secret), { algorithms: ['HS256'] });
    const userPayload = payload as unknown as UserJWTPayload;

    if (userPayload.type && userPayload.type !== type) {
      return null;
    }

    // Token không có jti thì không thể thu hồi khi đăng xuất -> không chấp nhận
    if (typeof userPayload.jti !== 'string' || !userPayload.jti) {
      return null;
    }

    return userPayload;
  } catch {
    return null;
  }
}

/**
 * Tạo Set-Cookie header an toàn (httpOnly, sameSite=lax, path=/)
 */
export function buildAuthCookieHeaders(tokens: { accessToken: string; refreshToken: string }): string[] {
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';

  // Access Token hết hạn sau 15 phút (900 giây)
  const accessCookie = `${COOKIE_ACCESS_TOKEN}=${tokens.accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${secureFlag}`;

  // Refresh Token hết hạn sau 7 ngày (604800 giây)
  const refreshCookie = `${COOKIE_REFRESH_TOKEN}=${tokens.refreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secureFlag}`;

  return [accessCookie, refreshCookie];
}

/**
 * Tạo Cookie header xóa token khi đăng xuất
 */
export function buildLogoutCookieHeaders(): string[] {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return [
    `${COOKIE_ACCESS_TOKEN}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`,
    `${COOKIE_REFRESH_TOKEN}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`,
  ];
}
