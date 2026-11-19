import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  checkIpSecurity,
  checkLoginSecurity,
  consumeCaptchaToken,
  generateCaptchaChallenge,
  recordFailedLogin,
  recordFailedLoginForIp,
  recordSuccessfulLogin,
  redeemCaptchaChallenge,
  safeEqual,
  verifyCaptchaChallenge,
  CAPTCHA_CHALLENGE_TTL_SECONDS,
  IP_MAX_DISTINCT_ACCOUNTS,
  MAX_FAILED_BEFORE_CAPTCHA,
  MAX_FAILED_BEFORE_LOCKOUT,
  type CaptchaChallenge,
} from './bruteForce';

const solve = (challenge: CaptchaChallenge): string => {
  const match = challenge.question.match(/(\d+)\s*\+\s*(\d+)/);
  if (!match) throw new Error('Không đọc được câu hỏi');
  return (parseInt(match[1], 10) + parseInt(match[2], 10)).toString();
};

const randomIp = () => `10.${crypto.randomInt(0, 256)}.${crypto.randomInt(0, 256)}.${crypto.randomInt(1, 255)}`;

describe('Brute-force Shield & CAPTCHA System', () => {
  const testId = `test-user-${Date.now()}@keycraft.io`;

  beforeEach(async () => {
    await recordSuccessfulLogin(testId);
  });

  it('mặc định cho phép đăng nhập tự do khi chưa nhập sai lần nào', async () => {
    const status = await checkLoginSecurity(testId);
    expect(status.isLocked).toBe(false);
    expect(status.requireCaptcha).toBe(false);
    expect(status.failedAttempts).toBe(0);
  });

  it('kích hoạt thử thách CAPTCHA khi nhập sai đủ 3 lần', async () => {
    for (let i = 1; i <= MAX_FAILED_BEFORE_CAPTCHA; i++) {
      const res = await recordFailedLogin(testId);
      if (i < MAX_FAILED_BEFORE_CAPTCHA) {
        expect(res.requireCaptcha).toBe(false);
      } else {
        expect(res.requireCaptcha).toBe(true);
      }
    }

    const check = await checkLoginSecurity(testId);
    expect(check.requireCaptcha).toBe(true);
    expect(check.isLocked).toBe(false);
  });

  it('kích hoạt khóa tài khoản tạm thời (Lockout) khi nhập sai 5 lần', async () => {
    for (let i = 1; i <= MAX_FAILED_BEFORE_LOCKOUT; i++) {
      await recordFailedLogin(testId);
    }

    const check = await checkLoginSecurity(testId);
    expect(check.isLocked).toBe(true);
    expect(check.remainingLockoutSeconds).toBeGreaterThan(0);
  });

  it('reset bộ đếm khi đăng nhập thành công', async () => {
    await recordFailedLogin(testId);
    await recordFailedLogin(testId);

    await recordSuccessfulLogin(testId);
    const status = await checkLoginSecurity(testId);
    expect(status.failedAttempts).toBe(0);
    expect(status.requireCaptcha).toBe(false);
  });

  describe('Signed Cryptographic CAPTCHA Challenge', () => {
    it('sinh thử thách và xác thực đáp án chính xác', () => {
      const challenge = generateCaptchaChallenge();
      expect(challenge.challengeId).toBeDefined();
      expect(challenge.question).toContain('Vui lòng tính:');
      expect(challenge.signature).toHaveLength(64); // SHA-256 Hex

      const isValid = verifyCaptchaChallenge(challenge.challengeId, solve(challenge), challenge.signature);
      expect(isValid).toBe(true);

      const isInvalid = verifyCaptchaChallenge(challenge.challengeId, '99999', challenge.signature);
      expect(isInvalid).toBe(false);
    });

    it('chữ ký sai độ dài / không phải hex KHÔNG làm sập (trước đây ném RangeError)', () => {
      const challenge = generateCaptchaChallenge();
      const answer = solve(challenge);
      expect(() => verifyCaptchaChallenge(challenge.challengeId, answer, 'abc')).not.toThrow();
      expect(verifyCaptchaChallenge(challenge.challengeId, answer, 'abc')).toBe(false);
      expect(verifyCaptchaChallenge(challenge.challengeId, answer, 'zz'.repeat(64))).toBe(false);
      expect(verifyCaptchaChallenge(123, answer, challenge.signature)).toBe(false);
    });

    it('safeEqual so sánh hằng thời gian được mọi độ dài', () => {
      expect(safeEqual('a', 'a')).toBe(true);
      expect(safeEqual('a', 'ab')).toBe(false);
      expect(safeEqual('', 'x'.repeat(1000))).toBe(false);
    });

    it('đề quá hạn 5 phút bị từ chối; sửa hạn trong challengeId làm hỏng chữ ký', () => {
      const issuedAt = Date.now();
      const challenge = generateCaptchaChallenge(issuedAt);
      const answer = solve(challenge);
      const afterExpiry = issuedAt + CAPTCHA_CHALLENGE_TTL_SECONDS * 1000 + 1;
      expect(verifyCaptchaChallenge(challenge.challengeId, answer, challenge.signature, afterExpiry)).toBe(false);

      const [uuid] = challenge.challengeId.split('.');
      const extended = `${uuid}.${afterExpiry + 999_999}`;
      expect(verifyCaptchaChallenge(extended, answer, challenge.signature, afterExpiry)).toBe(false);
    });
  });

  describe('Vé CAPTCHA dùng 1 lần (chống Replay Attack)', () => {
    it('giải đúng -> nhận vé; vé dùng được đúng 1 lần', async () => {
      const email = `nonce-${crypto.randomUUID()}@keycraft.io`;
      const challenge = generateCaptchaChallenge();
      const token = await redeemCaptchaChallenge(challenge.challengeId, solve(challenge), challenge.signature, email);

      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(await consumeCaptchaToken(token, email)).toBe(true);
      // Gửi lại đúng vé đó lần 2 -> đã bị xoá
      expect(await consumeCaptchaToken(token, email)).toBe(false);
    });

    it('một đề chỉ đổi được 1 vé (chép lại request giải đề không có tác dụng)', async () => {
      const email = `once-${crypto.randomUUID()}@keycraft.io`;
      const challenge = generateCaptchaChallenge();
      const answer = solve(challenge);
      const first = await redeemCaptchaChallenge(challenge.challengeId, answer, challenge.signature, email);
      const second = await redeemCaptchaChallenge(challenge.challengeId, answer, challenge.signature, email);
      expect(first).not.toBeNull();
      expect(second).toBeNull();
    });

    it('vé gắn với email: không dùng vé của tài khoản A để đăng nhập tài khoản B', async () => {
      const challenge = generateCaptchaChallenge();
      const token = await redeemCaptchaChallenge(
        challenge.challengeId,
        solve(challenge),
        challenge.signature,
        `a-${crypto.randomUUID()}@keycraft.io`
      );
      expect(await consumeCaptchaToken(token, 'victim@keycraft.io')).toBe(false);
    });

    it('đáp án sai thì không có vé; vé rác bị từ chối', async () => {
      const challenge = generateCaptchaChallenge();
      expect(await redeemCaptchaChallenge(challenge.challengeId, '0', challenge.signature, 'x@y.z')).toBeNull();
      expect(await consumeCaptchaToken('not-a-real-token', 'x@y.z')).toBe(false);
      expect(await consumeCaptchaToken(undefined, 'x@y.z')).toBe(false);
    });
  });

  describe('Khoá theo IP (chống Password Spraying)', () => {
    it(`khoá IP khi sai trên ${IP_MAX_DISTINCT_ACCOUNTS} tài khoản khác nhau`, async () => {
      const ip = randomIp();
      for (let i = 0; i < IP_MAX_DISTINCT_ACCOUNTS - 1; i++) {
        const res = await recordFailedLoginForIp(ip, `spray-${i}-${crypto.randomUUID()}@keycraft.io`);
        expect(res.isLocked).toBe(false);
      }
      expect((await checkIpSecurity(ip)).isLocked).toBe(false);

      const last = await recordFailedLoginForIp(ip, `spray-last-${crypto.randomUUID()}@keycraft.io`);
      expect(last.isLocked).toBe(true);
      expect(last.distinctAccounts).toBe(IP_MAX_DISTINCT_ACCOUNTS);

      const status = await checkIpSecurity(ip);
      expect(status.isLocked).toBe(true);
      expect(status.remainingLockoutSeconds).toBeGreaterThan(0);
    });

    it('sai nhiều lần trên CÙNG một email không tính là spraying', async () => {
      const ip = randomIp();
      const email = `same-${crypto.randomUUID()}@keycraft.io`;
      for (let i = 0; i < IP_MAX_DISTINCT_ACCOUNTS + 1; i++) {
        await recordFailedLoginForIp(ip, email);
      }
      expect((await checkIpSecurity(ip)).isLocked).toBe(false);
    });

    it('IP không xác định thì không theo dõi (tránh khoá nhầm cả nhóm người dùng)', async () => {
      const res = await recordFailedLoginForIp('unknown', 'a@b.c');
      expect(res).toEqual({ isLocked: false, failedAttempts: 0, distinctAccounts: 0 });
    });
  });
});
