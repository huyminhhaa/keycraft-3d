import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  signAccessToken,
  verifyToken,
  type AuthProvider,
} from './jwt';
import { isTokenRevoked, revokeToken } from './tokenBlacklist';

export interface AuthenticatedSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  authProvider: AuthProvider;
}

export interface SessionResult {
  authenticated: boolean;
  user: AuthenticatedSessionUser | null;
  refreshedAccessCookie?: string;
}

/**
 * Đọc cookie cụ thể từ Cookie header (hỗ trợ giá trị có dấu `=`)
 */
export function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    result[key] = val;
  }
  return result;
}

/**
 * Xác thực request bằng Access Token (httpOnly cookie hoặc Bearer header)
 * và tự động silent-refresh nếu Access Token hết hạn nhưng Refresh Token còn hạn.
 */
export async function getSessionFromRequest(req: Request): Promise<SessionResult> {
  return getSessionFromHeaders(req.headers);
}

/** Như `getSessionFromRequest` nhưng nhận thẳng Headers (dùng trong Server Component qua `headers()`) */
export async function getSessionFromHeaders(headers: Headers): Promise<SessionResult> {
  const cookieHeader = headers.get('cookie') || '';
  const authHeader = headers.get('authorization') || '';

  const cookies = parseCookieHeader(cookieHeader);
  let accessToken = cookies[COOKIE_ACCESS_TOKEN];
  const refreshToken = cookies[COOKIE_REFRESH_TOKEN];

  if (!accessToken && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7).trim();
  }

  // 1. Kiểm tra Access Token (chữ ký + hạn + chưa bị thu hồi khi đăng xuất)
  if (accessToken) {
    const payload = await verifyToken(accessToken, 'access');
    if (payload && !(await isTokenRevoked(payload.jti))) {
      return {
        authenticated: true,
        user: {
          id: payload.userId,
          email: payload.email,
          name: payload.name,
          role: payload.role,
          avatarUrl: payload.avatarUrl ?? null,
          authProvider: payload.authProvider ?? 'credentials',
        },
      };
    }
  }

  // 2. Tự động Silent-Refresh nếu Access Token hết hạn nhưng Refresh Token còn hạn
  if (refreshToken) {
    const refreshPayload = await verifyToken(refreshToken, 'refresh');
    if (refreshPayload && !(await isTokenRevoked(refreshPayload.jti))) {
      const authProvider: AuthProvider = refreshPayload.authProvider ?? 'credentials';
      const avatarUrl = refreshPayload.avatarUrl ?? null;

      const newAccessToken = await signAccessToken({
        userId: refreshPayload.userId,
        email: refreshPayload.email,
        name: refreshPayload.name,
        role: refreshPayload.role,
        avatarUrl,
        authProvider,
      });

      const isProd = process.env.NODE_ENV === 'production';
      const secureFlag = isProd ? '; Secure' : '';
      const newCookie = `${COOKIE_ACCESS_TOKEN}=${newAccessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${secureFlag}`;

      return {
        authenticated: true,
        user: {
          id: refreshPayload.userId,
          email: refreshPayload.email,
          name: refreshPayload.name,
          role: refreshPayload.role,
          avatarUrl,
          authProvider,
        },
        refreshedAccessCookie: newCookie,
      };
    }
  }

  return { authenticated: false, user: null };
}

/**
 * Đăng xuất phía server: đưa jti của Access + Refresh Token hiện tại vào danh sách đen
 * với TTL bằng thời gian sống còn lại. Token bị đánh cắp trước đó cũng mất hiệu lực ngay.
 * @returns số token đã thu hồi
 */
export async function revokeSessionTokens(req: Request): Promise<number> {
  const cookies = parseCookieHeader(req.headers.get('cookie') || '');
  const authHeader = req.headers.get('authorization') || '';
  const accessToken =
    cookies[COOKIE_ACCESS_TOKEN] ||
    (authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '');
  const refreshToken = cookies[COOKIE_REFRESH_TOKEN];

  let revoked = 0;
  const candidates: Array<[string | undefined, 'access' | 'refresh']> = [
    [accessToken, 'access'],
    [refreshToken, 'refresh'],
  ];

  for (const [token, type] of candidates) {
    if (!token) continue;
    const payload = await verifyToken(token, type);
    if (payload && (await revokeToken(payload.jti, payload.exp))) {
      revoked += 1;
    }
  }
  return revoked;
}
