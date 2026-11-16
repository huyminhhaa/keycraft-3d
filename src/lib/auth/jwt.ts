import { SignJWT, jwtVerify, JWTPayload } from 'jose';

export interface UserJWTPayload extends JWTPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  type?: 'access' | 'refresh';
}

const DEFAULT_SECRET = 'keycraft_super_secret_jwt_key_at_least_32_chars_long!';
const DEFAULT_REFRESH_SECRET = 'keycraft_super_refresh_jwt_key_at_least_32_chars!';

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
  const secret = process.env.JWT_SECRET || DEFAULT_SECRET;
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || '15m')
    .sign(getSymmetricJWK(secret));
}

/**
 * Ký tạo Refresh Token dài hạn (mặc định 7 ngày)
 */
export async function signRefreshToken(payload: Omit<UserJWTPayload, 'type'>): Promise<string> {
  const secret = process.env.JWT_REFRESH_SECRET || DEFAULT_REFRESH_SECRET;
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    .sign(getSymmetricJWK(secret));
}

/**
 * Giải mã và thẩm định tính hợp lệ của Token
 */
export async function verifyToken(
  token: string,
  type: 'access' | 'refresh' = 'access'
): Promise<UserJWTPayload | null> {
  try {
    const secret =
      type === 'access'
        ? process.env.JWT_SECRET || DEFAULT_SECRET
        : process.env.JWT_REFRESH_SECRET || DEFAULT_REFRESH_SECRET;

    const { payload } = await jwtVerify(token, getSymmetricJWK(secret));
    const userPayload = payload as unknown as UserJWTPayload;

    if (userPayload.type && userPayload.type !== type) {
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
  return [
    `${COOKIE_ACCESS_TOKEN}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${COOKIE_REFRESH_TOKEN}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ];
}
