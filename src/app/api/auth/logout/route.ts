import { NextResponse } from 'next/server';
import { buildLogoutCookieHeaders } from '@/lib/auth/jwt';
import { revokeSessionTokens } from '@/lib/auth/session';

export async function POST(req: Request) {
  // 1. Thu hồi token phía server (Redis blacklist) — xoá cookie thôi là chưa đủ:
  //    ai đã chép được token vẫn dùng tiếp được đến khi hết hạn.
  let revokedTokens = 0;
  try {
    revokedTokens = await revokeSessionTokens(req);
  } catch (error) {
    console.error('[AUTH_LOGOUT_REVOKE_ERROR]:', error);
  }

  // 2. Xoá cookie phía trình duyệt
  const response = NextResponse.json({
    success: true,
    message: 'Đăng xuất thành công.',
    revokedTokens,
  });

  const logoutCookies = buildLogoutCookieHeaders();
  logoutCookies.forEach((cookie) => {
    response.headers.append('Set-Cookie', cookie);
  });

  return response;
}
