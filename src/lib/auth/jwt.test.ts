import { describe, it, expect, afterEach, vi } from 'vitest';
import { SignJWT } from 'jose';
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  buildAuthCookieHeaders,
  buildLogoutCookieHeaders,
  getSigningSecret,
  assertProductionSecrets,
  FatalSecurityError,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
} from './jwt';

describe('Khai tử Default Secret trên Production', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('production thiếu JWT_SECRET -> FatalSecurityError', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');
    expect(() => getSigningSecret('JWT_SECRET')).toThrow(FatalSecurityError);
    expect(() => assertProductionSecrets()).toThrow(/Fatal Security Error/);
  });

  it('production dùng khoá mặc định / khoá mẫu trong .env.example / khoá ngắn -> FatalSecurityError', () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const weak of [
      'keycraft_super_secret_jwt_key_at_least_32_chars_long!',
      'your_jwt_secret_key_minimum_32_characters_here',
      'short-secret',
    ]) {
      vi.stubEnv('JWT_SECRET', weak);
      expect(() => getSigningSecret('JWT_SECRET')).toThrow(FatalSecurityError);
    }
  });

  it('production ký token cũng bị chặn (không có đường vòng)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');
    await expect(
      signAccessToken({ userId: 'u', email: 'e@x.io', name: 'n', role: 'user' })
    ).rejects.toThrow(FatalSecurityError);
  });

  it('production với khoá mạnh thì chạy bình thường', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'a'.repeat(24) + 'Zx9#kLm2Qw8$');
    vi.stubEnv('JWT_REFRESH_SECRET', 'b'.repeat(24) + 'Pq7!nBv4Rt6%');
    expect(() => assertProductionSecrets()).not.toThrow();
  });

  it('dev/test vẫn chạy được không cần cấu hình', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('JWT_SECRET', '');
    expect(getSigningSecret('JWT_SECRET').length).toBeGreaterThanOrEqual(32);
  });
});

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

  it('mỗi token có jti riêng để thu hồi khi đăng xuất', async () => {
    const a = await verifyToken(await signAccessToken(mockUser), 'access');
    const b = await verifyToken(await signAccessToken(mockUser), 'access');
    expect(a?.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(a?.jti).not.toBe(b?.jti);
  });

  it('từ chối token hợp lệ chữ ký nhưng KHÔNG có jti (không thể thu hồi)', async () => {
    const legacy = await new SignJWT({ ...mockUser, type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign({ kty: 'oct', k: Buffer.from(getSigningSecret('JWT_SECRET')).toString('base64url') });
    expect(await verifyToken(legacy, 'access')).toBeNull();
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
