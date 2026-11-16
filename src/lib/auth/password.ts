import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Mã hóa mật khẩu an toàn chuẩn production sử dụng bcryptjs với 12 salt rounds
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * So khớp mật khẩu người dùng nhập với chuỗi băm (hash) trong database
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Kiểm tra độ mạnh của mật khẩu (tối thiểu 8 ký tự, ít nhất 1 số hoặc ký tự đặc biệt)
 */
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Mật khẩu phải chứa ít nhất 8 ký tự.' };
  }
  if (!/[0-9]/.test(password) && !/[^a-zA-Z0-9]/.test(password)) {
    return { valid: false, message: 'Mật khẩu phải chứa ít nhất 1 chữ số hoặc 1 ký tự đặc biệt.' };
  }
  return { valid: true };
}
