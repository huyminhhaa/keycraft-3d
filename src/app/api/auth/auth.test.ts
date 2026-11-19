import { describe, it, expect, beforeEach } from 'vitest';
import { POST as registerHandler } from './register/route';
import { POST as loginHandler } from './login/route';
import { POST as logoutHandler } from './logout/route';
import { GET as meHandler } from './me/route';
import { POST as redeemCaptcha } from './captcha/route';
import { solvePow } from '@/lib/auth/powCaptcha';
import {
  signAccessToken,
  signRefreshToken,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
} from '@/lib/auth/jwt';
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
      const res = await logoutHandler(
        new Request('http://localhost:3000/api/auth/logout', { method: 'POST' })
      );
      expect(res.status).toBe(200);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('Max-Age=0');
    });

    it('chỉ nhận token qua cookie httpOnly: header Authorization: Bearer bị bỏ qua (401)', async () => {
      const token = await signAccessToken({ userId: 'usr_bearer', email: 'b@keycraft.io', name: 'B', role: 'user' });
      const res = await meHandler(
        new Request('http://localhost:3000/api/auth/me', { headers: { authorization: `Bearer ${token}` } })
      );
      expect(res.status).toBe(401);
    });

    it('đăng xuất thu hồi token phía server: dùng lại cookie cũ -> 401 (Token Blacklist)', async () => {
      const payload = {
        userId: 'usr_logout',
        email: 'logout@keycraft.io',
        name: 'Logout Tester',
        role: 'user',
      };
      const access = await signAccessToken(payload);
      const refresh = await signRefreshToken(payload);
      const cookie = `${COOKIE_ACCESS_TOKEN}=${access}; ${COOKIE_REFRESH_TOKEN}=${refresh}`;

      const before = await meHandler(new Request('http://localhost:3000/api/auth/me', { headers: { cookie } }));
      expect(before.status).toBe(200);

      const logoutRes = await logoutHandler(
        new Request('http://localhost:3000/api/auth/logout', { method: 'POST', headers: { cookie } })
      );
      expect((await logoutRes.json()).revokedTokens).toBe(2);

      // Kẻ gian đã chép được cả access + refresh token: vẫn bị từ chối, kể cả silent-refresh
      const after = await meHandler(new Request('http://localhost:3000/api/auth/me', { headers: { cookie } }));
      expect(after.status).toBe(401);
    });
  });

  describe('Rate limit đăng ký & CAPTCHA dùng 1 lần qua API', () => {
    it('POST /api/auth/register: tối đa 5 lượt / 10 phút / IP, lượt thứ 6 -> 429', async () => {
      const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.50' };
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await registerHandler(
          new Request('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'A', email: 'spam@keycraft.io', password: 'x' }),
          })
        );
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 5).every((s) => s === 400)).toBe(true);
      expect(statuses[5]).toBe(429);
    });

    it('sai 3 lần -> phải có vé CAPTCHA; vé dùng 1 lần, gửi lại vé cũ bị chặn', async () => {
      const email = `captcha_${Date.now()}@keycraft.io`;
      const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.77' };
      const login = (extra: Record<string, string> = {}) =>
        loginHandler(
          new Request('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers,
            body: JSON.stringify({ email, password: 'WrongPassword1!', ...extra }),
          })
        );

      let lastData: { captcha?: { challengeId: string; difficulty: number; signature: string } } = {};
      for (let i = 0; i < 3; i++) {
        lastData = await (await login()).json();
      }
      const challenge = lastData.captcha;
      expect(challenge).toBeDefined();
      if (!challenge) return;

      // Không có vé -> 400 requireCaptcha
      const noToken = await login();
      expect(noToken.status).toBe(400);
      expect((await noToken.json()).requireCaptcha).toBe(true);

      // Giải đề Proof-of-Work như trình duyệt -> nhận vé
      const answer = await solvePow(challenge.challengeId, { difficulty: challenge.difficulty });
      const redeemRes = await redeemCaptcha(
        new Request('http://localhost:3000/api/auth/captcha', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            signature: challenge.signature,
            answer,
            email,
          }),
        })
      );
      expect(redeemRes.status).toBe(200);
      const { captchaToken } = await redeemRes.json();
      expect(typeof captchaToken).toBe('string');

      // Lần 1 dùng vé: qua cổng CAPTCHA (mật khẩu vẫn sai nên 401, không phải 400)
      const withToken = await login({ captchaToken });
      expect(withToken.status).toBe(401);

      // Replay: gửi lại đúng vé đó -> đã bị xoá khỏi Redis -> chặn ở cổng CAPTCHA
      const replay = await login({ captchaToken });
      expect(replay.status).toBe(400);
      expect((await replay.json()).requireCaptcha).toBe(true);
    }, 30_000); // mỗi lần sai mật khẩu chạy bcrypt cost 12 thật

    it('login từ chối body sai kiểu (email là object) bằng 400 thay vì sập 500', async () => {
      const res = await loginHandler(
        new Request('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: { $ne: null }, password: 'x' }),
        })
      );
      expect(res.status).toBe(400);
    });
  });
});
