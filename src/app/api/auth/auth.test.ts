import { describe, it, expect, beforeEach } from 'vitest';
import { POST as registerHandler } from './register/route';
import { POST as loginHandler } from './login/route';
import { POST as logoutHandler } from './logout/route';
import { GET as meHandler } from './me/route';
import { signAccessToken, COOKIE_ACCESS_TOKEN } from '@/lib/auth/jwt';
import { recordSuccessfulLogin } from '@/lib/auth/bruteForce';

describe('Auth API Routes', () => {
  const uniqueEmail = `test_${Date.now()}@keycraft.io`;
  const validPassword = 'StrongPassword123!';

  beforeEach(async () => {
    await recordSuccessfulLogin(uniqueEmail);
  });

  describe('POST /api/auth/register', () => {
    it('từ chối khi thiếu tên hoặc tên quá ngắn', async () => {
      const req = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'A', email: uniqueEmail, password: validPassword }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Họ và tên');
    });

    it('từ chối khi email sai định dạng', async () => {
      const req = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nguyen Van A', email: 'invalid-email', password: validPassword }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('email');
    });

    it('từ chối khi mật khẩu quá yếu (dưới 8 ký tự hoặc không có số)', async () => {
      const req = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nguyen Van A', email: uniqueEmail, password: 'weak' }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Mật khẩu');
    });

    it('đăng ký thành công và phát sinh Set-Cookie', async () => {
      const req = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'KeyCraft Builder',
          email: uniqueEmail,
          password: validPassword,
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe(uniqueEmail);

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain(COOKIE_ACCESS_TOKEN);
    });
  });

  describe('POST /api/auth/login & Brute-force Shield', () => {
    it('báo lỗi khi nhập sai mật khẩu và theo dõi số lần sai', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: uniqueEmail,
          password: 'WrongPassword999!',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.failedAttempts).toBeGreaterThanOrEqual(1);
    });

    it('kích hoạt yêu cầu CAPTCHA khi sai liên tiếp 3 lần', async () => {
      const attackEmail = `brute_${Date.now()}@keycraft.io`;

      for (let i = 0; i < 3; i++) {
        const req = new Request('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: attackEmail, password: 'wrong' }),
        });
        const res = await loginHandler(req);
        if (i === 2) {
          const data = await res.json();
          expect(data.requireCaptcha).toBe(true);
          expect(data.captcha).toBeDefined();
        }
      }
    });
  });

  describe('GET /api/auth/me & POST /api/auth/logout', () => {
    it('GET /api/auth/me trả về 401 khi chưa đăng nhập', async () => {
      const req = new Request('http://localhost:3000/api/auth/me');
      const res = await meHandler(req);
      expect(res.status).toBe(401);
    });

    it('GET /api/auth/me nhận diện được user khi có Token hợp lệ', async () => {
      const token = await signAccessToken({
        userId: 'usr_abc',
        email: 'builder@keycraft.io',
        name: 'Builder Pro',
        role: 'user',
      });

      const req = new Request('http://localhost:3000/api/auth/me', {
        headers: {
          cookie: `${COOKIE_ACCESS_TOKEN}=${token}`,
        },
      });

      const res = await meHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
      expect(data.user.email).toBe('builder@keycraft.io');
    });

    it('POST /api/auth/logout xóa sạch cookie', async () => {
      const res = await logoutHandler();
      expect(res.status).toBe(200);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('Max-Age=0');
    });
  });
});
