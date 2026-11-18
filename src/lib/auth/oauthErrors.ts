/**
 * Bản đồ thông báo lỗi Google OAuth thân thiện tiếng Việt (dùng được ở cả Client và Server)
 */
export function getOAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case 'google_not_configured':
      return 'Chưa cấu hình AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET trên server. Hãy thêm Google OAuth Client ID vào .env.local hoặc Vercel Environment Variables.';
    case 'access_denied':
      return 'Bạn đã hủy đăng nhập bằng Google.';
    case 'invalid_state':
      return 'Phiên xác thực Google không hợp lệ hoặc đã hết hạn (CSRF check). Vui lòng thử lại.';
    case 'token_exchange_failed':
      return 'Không thể trao đổi mã xác thực với Google. Hãy kiểm tra Authorized Redirect URI trên Google Cloud Console.';
    case 'unverified_email':
      return 'Email Google của bạn chưa được xác minh nên không thể đăng nhập.';
    default:
      return 'Đăng nhập bằng Google thất bại. Vui lòng thử lại sau.';
  }
}
