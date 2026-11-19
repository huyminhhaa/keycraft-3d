/**
 * HTTP Security Headers chuẩn OWASP, dùng trong `next.config.ts` -> `headers()`.
 * File này được next.config.ts import trực tiếp nên KHÔNG dùng alias `@/`.
 *
 * Vì sao CSP còn `'unsafe-inline'` cho script?
 * App bật `cacheComponents` (Partial Prerendering): vỏ HTML tĩnh được build sẵn, Next chèn
 * script inline (`self.__next_f.push(...)`) để nạp dữ liệu RSC. CSP dạng nonce bắt buộc render
 * động mọi trang và Next ghi rõ là KHÔNG tương thích PPR. Ta bù bằng các chỉ thị chặn đường
 * khai thác XSS phổ biến nhất mà không làm vỡ Next:
 *   - `script-src-attr 'none'`: cấm handler inline kiểu `<img onerror=...>`
 *   - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`
 *   - `connect-src` chỉ cho phép chính origin (trình duyệt không bao giờ gọi thẳng
 *     Neon / Upstash / Gemini — các dịch vụ đó chỉ được gọi từ server)
 */

export interface HeaderEntry {
  key: string;
  value: string;
}

export interface CspOptions {
  isDev: boolean;
}

/** Nguồn ảnh ngoài: avatar Google (OAuth) + kho ảnh CDN phổ biến cho ảnh build */
const IMAGE_HOSTS = [
  'https://lh3.googleusercontent.com',
  'https://images.unsplash.com',
  'https://res.cloudinary.com',
];

export function buildContentSecurityPolicy({ isDev }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'unsafe-eval' chỉ ở dev (React dựng lại stack lỗi bằng eval). Production không có.
    'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    'script-src-attr': ["'none'"],
    // framer-motion / React gắn style inline trên phần tử -> cần 'unsafe-inline' cho style
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...IMAGE_HOSTS],
    // next/font tự host font Geist -> chỉ cần 'self'
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

export function buildSecurityHeaders({ isDev }: CspOptions): HeaderEntry[] {
  return [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy({ isDev }) },
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
