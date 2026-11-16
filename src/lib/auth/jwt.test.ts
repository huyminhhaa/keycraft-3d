import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  buildAuthCookieHeaders,
  buildLogoutCookieHeaders,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
} from './jwt';

describe('JWT Utilities (jose)', () => {
  const mockUser = {
    userId: 'user-uuid-1234',
    email: 'dev@keycraft.io',
    name: 'KeyCraft Master',
    role: 'user',
  };

  it('ký và xác thực Access Token hợp lệ', async () => {
    const token = await signAccessToken(mockUser);
    expect(typeof token).toBe('string');

    const payload = await verifyToken(token, 'access');
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(mockUser.userId);
    expect(payload?.email).toBe(mockUser.email);
    expect(payload?.type).toBe('access');
  });

  it('ký và xác thực Refresh Token hợp lệ', async () => {
    const refreshToken = await signRefreshToken(mockUser);
    expect(typeof refreshToken).toBe('string');

    const payload = await verifyToken(refreshToken, 'refresh');
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(mockUser.userId);
    expect(payload?.type).toBe('refresh');
  });

  it('từ chối token khi sai loại (access vs refresh mismatch)', async () => {
    const accessToken = await signAccessToken(mockUser);
    const result = await verifyToken(accessToken, 'refresh');
    expect(result).toBeNull();
  });

  it('tạo đúng Set-Cookie header cho đăng nhập và đăng xuất', () => {
    const cookies = buildAuthCookieHeaders({
      accessToken: 'sample_access',
      refreshToken: 'sample_refresh',
    });

    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain(COOKIE_ACCESS_TOKEN);
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('SameSite=Lax');
    expect(cookies[1]).toContain(COOKIE_REFRESH_TOKEN);

    const logoutCookies = buildLogoutCookieHeaders();
    expect(logoutCookies[0]).toContain('Max-Age=0');
  });
});
