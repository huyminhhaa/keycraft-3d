import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePasswordStrength } from './password';

describe('Password Utilities (bcryptjs)', () => {
  it('mã hóa mật khẩu và kiểm tra so khớp thành công', async () => {
    const rawPassword = 'SecurePassword123!';
    const hash = await hashPassword(rawPassword);

    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith('$2')).toBe(true);

    const isMatch = await verifyPassword(rawPassword, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword('WrongPassword123!', hash);
    expect(isWrongMatch).toBe(false);
  });

  it('thẩm định độ mạnh mật khẩu', () => {
    expect(validatePasswordStrength('short').valid).toBe(false);
    expect(validatePasswordStrength('onlyletters').valid).toBe(false);
    expect(validatePasswordStrength('validpass123').valid).toBe(true);
    expect(validatePasswordStrength('validpass!').valid).toBe(true);
  });
});
