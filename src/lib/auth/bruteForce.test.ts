import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkLoginSecurity,
  recordFailedLogin,
  recordSuccessfulLogin,
  generateCaptchaChallenge,
  verifyCaptchaChallenge,
  MAX_FAILED_BEFORE_CAPTCHA,
  MAX_FAILED_BEFORE_LOCKOUT,
} from './bruteForce';

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

      // Trích xuất phép tính để tìm đáp án đúng
      const match = challenge.question.match(/(\d+)\s*\+\s*(\d+)/);
      if (!match) throw new Error('Không đọc được câu hỏi');

      const correctAnswer = (parseInt(match[1], 10) + parseInt(match[2], 10)).toString();
      const isValid = verifyCaptchaChallenge(challenge.challengeId, correctAnswer, challenge.signature);
      expect(isValid).toBe(true);

      const isInvalid = verifyCaptchaChallenge(challenge.challengeId, '99999', challenge.signature);
      expect(isInvalid).toBe(false);
    });
  });
});
