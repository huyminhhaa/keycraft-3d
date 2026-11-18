import { describe, it, expect } from 'vitest';
import {
  buildGoogleAuthorizeUrl,
  computePkceChallenge,
  generateRandomBase64Url,
  sanitizeReturnTo,
} from './googleOAuth';
import { getOAuthErrorMessage } from './oauthErrors';

describe('Google OAuth 2.0 + PKCE Helpers (src/lib/auth/googleOAuth.ts)', () => {
  it('tính toán PKCE S256 challenge chính xác và ngẫu nhiên đủ độ dài', () => {
    const verifier = generateRandomBase64Url(32);
    expect(verifier.length).toBeGreaterThanOrEqual(40);

    const challengeA = computePkceChallenge(verifier);
    const challengeB = computePkceChallenge(verifier);
    expect(challengeA).toBe(challengeB);
    expect(challengeA).not.toBe(verifier);
    expect(challengeA).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('chặn Open Redirect trong tham số returnTo', () => {
    expect(sanitizeReturnTo('/studio')).toBe('/studio');
    expect(sanitizeReturnTo('/')).toBe('/');
    expect(sanitizeReturnTo('/build/deep-thock')).toBe('/build/deep-thock');

    expect(sanitizeReturnTo('https://evil.com')).toBe('/studio');
    expect(sanitizeReturnTo('//evil.com/phish')).toBe('/studio');
    expect(sanitizeReturnTo('javascript:alert(1)')).toBe('/studio');
    expect(sanitizeReturnTo('/\\evil.com')).toBe('/studio');
  });

  it('tạo Google Authorize URL đầy đủ tham số bảo mật PKCE & CSRF state', () => {
    const urlStr = buildGoogleAuthorizeUrl({
      clientId: 'test-client-id.apps.googleusercontent.com',
      redirectUri: 'https://keycraft3d.vercel.app/api/auth/google/callback',
      state: 'csrf_state_123',
      codeChallenge: 'pkce_challenge_xyz',
    });

    const parsed = new URL(urlStr);
    expect(parsed.origin).toBe('https://accounts.google.com');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('scope')).toBe('openid email profile');
    expect(parsed.searchParams.get('state')).toBe('csrf_state_123');
    expect(parsed.searchParams.get('code_challenge')).toBe('pkce_challenge_xyz');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('trả về thông báo lỗi OAuth thân thiện tiếng Việt', () => {
    expect(getOAuthErrorMessage('google_not_configured')).toContain('AUTH_GOOGLE_ID');
    expect(getOAuthErrorMessage('invalid_state')).toContain('CSRF');
    expect(getOAuthErrorMessage(null)).toBeNull();
  });
});
