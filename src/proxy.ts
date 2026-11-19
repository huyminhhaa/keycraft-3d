import { NextResponse, type NextRequest } from 'next/server';
import {
  buildContentSecurityPolicy,
  generateNonce,
  isCrossSiteMutation,
} from './lib/security/securityHeaders';

/**
 * Proxy (middleware của Next 16) chạy trước mọi trang và API:
 *  1. API: chặn request ghi dữ liệu đến từ trang web khác (CSRF lớp 2).
 *  2. Trang HTML: sinh nonce mới, gắn CSP nonce. Next đọc CSP trong request header và tự gắn
 *     nonce vào mọi script của nó khi render (trang phải render động — xem `src/app/layout.tsx`).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    const appHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host;
    if (isCrossSiteMutation(request.method, request.headers, appHost)) {
      return NextResponse.json({ error: 'Yêu cầu từ nguồn không hợp lệ.' }, { status: 403 });
    }
    return NextResponse.next();
  }

  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy({ isDev: process.env.NODE_ENV === 'development', nonce });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Mọi đường dẫn trừ file tĩnh (JS/CSS build, ảnh tối ưu, âm thanh, ảnh build, mô hình 3D)
    '/((?!_next/static|_next/image|favicon.ico|sounds/|builds/|models/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|wav|mp3|glb|gltf|txt|xml|json)$).*)',
  ],
};
