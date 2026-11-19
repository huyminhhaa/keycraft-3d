/**
 * HTTP Security Headers chuẩn OWASP.
 *
 * - Header tĩnh (X-Frame-Options, HSTS...): `next.config.ts` -> `headers()`, áp cho mọi route.
 * - CSP cho trang HTML: `src/proxy.ts` sinh NONCE mới cho từng request:
 *     script-src 'self' 'nonce-<ngẫu nhiên>' 'strict-dynamic'
 *   Script inline chỉ chạy nếu mang đúng nonce của request đó -> script XSS chèn vào trang không
 *   có nonce nên bị trình duyệt chặn. KHÔNG còn 'unsafe-inline' cho script.
 *   'strict-dynamic': script đã được tin (có nonce) được phép nạp tiếp các chunk JS của Next.
 * - CSP cho API (JSON): `default-src 'none'` — phản hồi API không bao giờ cần chạy gì.
 *
 * File này được next.config.ts và proxy.ts import nên KHÔNG dùng alias `@/`.
 */

export interface HeaderEntry {
  key: string;
  value: string;
}

export interface CspOptions {
  isDev: boolean;
  /** Nonce base64 của request hiện tại */
  nonce: string;
}

/** Nguồn ảnh ngoài: avatar Google (OAuth) + kho ảnh CDN phổ biến cho ảnh build */
const IMAGE_HOSTS = [
  'https://lh3.googleusercontent.com',
  'https://images.unsplash.com',
  'https://res.cloudinary.com',
];

/** Nonce 128-bit ngẫu nhiên (Web Crypto, chạy được trong proxy) */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export function buildContentSecurityPolicy({ isDev, nonce }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'self' chỉ là dự phòng cho trình duyệt cũ không hiểu 'strict-dynamic'.
    // 'unsafe-eval' chỉ ở dev (React dựng lại stack lỗi bằng eval). Production không có.
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    'script-src-attr': ["'none'"],
    // Thuộc tính style="" (framer-motion, màu bàn phím) không gắn nonce được -> vẫn cần 'unsafe-inline'
    // cho STYLE. CSS không chạy được mã nên rủi ro thấp hơn hẳn script.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...IMAGE_HOSTS],
    'font-src': ["'self'", 'data:'],
    // three.js loader đọc data:/blob: URI; dev cần websocket cho HMR
    'connect-src': ["'self'", 'data:', 'blob:', ...(isDev ? ['ws:', 'wss:'] : [])],
    'media-src': ["'self'", 'blob:', 'data:'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

/** CSP cho phản hồi API (JSON / stream): không cho tải hay chạy bất cứ thứ gì */
export const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

/** Header tĩnh áp cho mọi route (CSP của trang do proxy đặt riêng theo nonce) */
export function buildSecurityHeaders(): HeaderEntry[] {
  return [
    // Chống Clickjacking (trình duyệt cũ không hiểu frame-ancestors)
    { key: 'X-Frame-Options', value: 'DENY' },
    // Chống MIME sniffing (ví dụ file .txt bị đoán thành script)
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    // HSTS: trình duyệt chỉ ghi nhận qua HTTPS, nên đặt cả lúc chạy local cũng vô hại
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    // Cô lập cửa sổ khỏi trang khác mở nó (chống tabnabbing / XS-Leaks)
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
}

// ------------------------------------------------------------------------------
// Chống CSRF lớp 2 cho API (lớp 1 là cookie SameSite=Lax)
// ------------------------------------------------------------------------------

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Request ghi dữ liệu đến từ một trang web KHÁC (CSRF)?
 * - `Sec-Fetch-Site: cross-site` (trình duyệt tự gắn, JS không sửa được) -> chặn
 * - `Origin` khác host của app -> chặn
 * - Không có cả hai header (curl, server-to-server): không phải CSRF qua trình duyệt -> cho qua
 */
export function isCrossSiteMutation(method: string, headers: Headers, appHost: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;

  const fetchSite = headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return true;

  const origin = headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== appHost;
  } catch {
    return true; // Origin rác ("null" từ iframe sandbox, data: URL...) -> chặn
  }
}
