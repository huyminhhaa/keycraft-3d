import { describe, it, expect } from 'vitest';
import {
  API_CONTENT_SECURITY_POLICY,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  generateNonce,
  isCrossSiteMutation,
} from './securityHeaders';

const directive = (csp: string, name: string) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

describe('OWASP Security Headers (src/lib/security/securityHeaders.ts)', () => {
  it('đủ header tĩnh bắt buộc với giá trị chuẩn', () => {
    const headers = Object.fromEntries(buildSecurityHeaders().map((h) => [h.key, h.value]));
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
  });

  it("script-src dùng nonce + 'strict-dynamic', KHÔNG còn 'unsafe-inline'", () => {
    const csp = buildContentSecurityPolicy({ isDev: false, nonce: 'abc123==' });
    const script = directive(csp, 'script-src');
    expect(script).toContain("'nonce-abc123=='");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain('unsafe-inline');
    expect(script).not.toContain('unsafe-eval');
  });

  it("dev mới có 'unsafe-eval' (React dev overlay)", () => {
    expect(directive(buildContentSecurityPolicy({ isDev: true, nonce: 'n' }), 'script-src')).toContain("'unsafe-eval'");
  });

  it('chặn clickjacking, plugin, base hijack và handler inline', () => {
    const csp = buildContentSecurityPolicy({ isDev: false, nonce: 'n' });
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'script-src-attr')).toBe("script-src-attr 'none'");
  });

  it('connect-src chỉ cho chính origin: trình duyệt không gọi thẳng DB/Redis/Gemini', () => {
    const connect = directive(buildContentSecurityPolicy({ isDev: false, nonce: 'n' }), 'connect-src');
    expect(connect).toContain("'self'");
    expect(connect).not.toMatch(/neon|upstash|googleapis|\*/);
  });

  it('nonce 128-bit, mỗi lần một giá trị khác', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(atob(a)).toHaveLength(16);
    expect(a).not.toBe(b);
  });

  it('API: CSP chặn mọi thứ', () => {
    expect(API_CONTENT_SECURITY_POLICY).toContain("default-src 'none'");
  });

  describe('isCrossSiteMutation (chống CSRF lớp 2)', () => {
    const h = (init: Record<string, string>) => new Headers(init);
    const host = 'keycraft3d.vercel.app';

    it('cho qua request đọc (GET) dù từ trang khác', () => {
      expect(isCrossSiteMutation('GET', h({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }), host)).toBe(false);
    });

    it('chặn POST/PATCH/DELETE từ trang khác (Origin hoặc Sec-Fetch-Site)', () => {
      expect(isCrossSiteMutation('POST', h({ origin: 'https://evil.example' }), host)).toBe(true);
      expect(isCrossSiteMutation('DELETE', h({ 'sec-fetch-site': 'cross-site' }), host)).toBe(true);
      expect(isCrossSiteMutation('PATCH', h({ origin: 'null' }), host)).toBe(true);
    });

    it('cho qua request cùng trang và request không phải từ trình duyệt', () => {
      expect(isCrossSiteMutation('POST', h({ origin: `https://${host}`, 'sec-fetch-site': 'same-origin' }), host)).toBe(false);
      expect(isCrossSiteMutation('POST', h({}), host)).toBe(false);
    });
  });
});
