import { describe, it, expect } from 'vitest';
import { buildContentSecurityPolicy, buildSecurityHeaders } from './securityHeaders';

const toMap = (isDev: boolean) =>
  Object.fromEntries(buildSecurityHeaders({ isDev }).map((h) => [h.key, h.value]));

const directive = (csp: string, name: string) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

describe('OWASP Security Headers (src/lib/security/securityHeaders.ts)', () => {
  it('đủ 6 header bắt buộc với giá trị chuẩn', () => {
    const headers = toMap(false);
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
    expect(headers['Content-Security-Policy']).toBeTruthy();
  });

  it('CSP chặn clickjacking, plugin, base hijack và handler inline', () => {
    const csp = buildContentSecurityPolicy({ isDev: false });
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'form-action')).toBe("form-action 'self'");
    expect(directive(csp, 'script-src-attr')).toBe("script-src-attr 'none'");
  });

  it("production KHÔNG có 'unsafe-eval'; dev mới có (React dev overlay)", () => {
    expect(directive(buildContentSecurityPolicy({ isDev: false }), 'script-src')).not.toContain('unsafe-eval');
    expect(directive(buildContentSecurityPolicy({ isDev: true }), 'script-src')).toContain("'unsafe-eval'");
  });

  it('connect-src chỉ cho chính origin: trình duyệt không được gọi thẳng DB/Redis/Gemini', () => {
    const connect = directive(buildContentSecurityPolicy({ isDev: false }), 'connect-src');
    expect(connect).toContain("'self'");
    expect(connect).not.toMatch(/neon|upstash|googleapis|\*/);
  });
});
