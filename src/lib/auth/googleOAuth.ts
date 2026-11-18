import { createHash, randomBytes } from 'node:crypto';

export const OAUTH_STATE_COOKIE = 'keycraft_google_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'keycraft_google_oauth_verifier';
export const OAUTH_NEXT_COOKIE = 'keycraft_google_oauth_next';

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Kiểm tra cấu hình Google OAuth có hợp lệ không (tránh giá trị placeholder mặc định)
 */
export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.AUTH_GOOGLE_ID?.trim() || '';
  const clientSecret = process.env.AUTH_GOOGLE_SECRET?.trim() || '';

  if (
    !clientId ||
    !clientSecret ||
    clientId.startsWith('your_') ||
    clientSecret.startsWith('your_')
  ) {
    return null;
  }

  return { clientId, clientSecret };
}

/**
 * Sinh chuỗi ngẫu nhiên mật mã học dạng base64url (dùng cho CSRF state và PKCE code_verifier)
 */
export function generateRandomBase64Url(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

/**
 * Tính PKCE code_challenge theo chuẩn S256 (SHA-256 -> base64url)
 */
export function computePkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Chống tấn công Open Redirect: chỉ cho phép đường dẫn nội bộ bắt đầu bằng `/` (không `//`, không `http:`)
 */
export function sanitizeReturnTo(raw: string | null | undefined, fallback = '/studio'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  if (/^\/[a-zA-Z0-9/_-]*(\?[a-zA-Z0-9=&_%-]*)?$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

/**
 * Xây dựng redirect_uri chuẩn khớp với host hiện tại hoặc NEXT_PUBLIC_APP_URL
 */
export function resolveGoogleRedirectUri(req: Request): string {
  const reqUrl = new URL(req.url);
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || reqUrl.protocol.replace(':', '');

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}/api/auth/google/callback`;
  }
  return `${reqUrl.origin}/api/auth/google/callback`;
}

/**
 * Tạo URL điều hướng tới màn hình đăng nhập Google OAuth 2.0 (Authorization Code + PKCE)
 */
export function buildGoogleAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

/**
 * Bản đồ thông báo lỗi Google OAuth thân thiện tiếng Việt cho UI
 */
export function getOAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case 'google_not_configured':
      return 'Chưa cấu hình AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET trên server. Hãy thêm Google OAuth Client ID vào .env.local hoặc Vercel Environment Variables.';
    case 'access_denied':
      return 'Bạn đã hủy đăng nhập bằng Google.';
    case 'invalid_state':
      return 'Phiên xác thực Google không hợp lệ hoặc đã hết hạn (CSRF check). Vui lòng thử lại.';
    case 'token_exchange_failed':
      return 'Không thể trao đổi mã xác thực với Google. Hãy kiểm tra Authorized Redirect URI trên Google Cloud Console.';
    case 'unverified_email':
      return 'Email Google của bạn chưa được xác minh nên không thể đăng nhập.';
    default:
      return 'Đăng nhập bằng Google thất bại. Vui lòng thử lại sau.';
  }
}
