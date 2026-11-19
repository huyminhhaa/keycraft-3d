/**
 * Chạy một lần khi server Next.js khởi động (không chạy lúc `next build`).
 * Production thiếu JWT_SECRET / dùng khoá mặc định -> ném FatalSecurityError, server không lên.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertProductionSecrets } = await import('@/lib/auth/jwt');
  assertProductionSecrets();
}
