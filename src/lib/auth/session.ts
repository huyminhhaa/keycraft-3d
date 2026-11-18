import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  signAccessToken,
  verifyToken,
  type AuthProvider,
} from './jwt';

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
  const cookieHeader = req.headers.get('cookie') || '';
  const authHeader = req.headers.get('authorization') || '';

  const cookies = parseCookieHeader(cookieHeader);
  let accessToken = cookies[COOKIE_ACCESS_TOKEN];
  const refreshToken = cookies[COOKIE_REFRESH_TOKEN];

  if (!accessToken && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7).trim();
  }

  // 1. Kiểm tra Access Token
  if (accessToken) {
    const payload = await verifyToken(accessToken, 'access');
    if (payload) {
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
    if (refreshPayload) {
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
