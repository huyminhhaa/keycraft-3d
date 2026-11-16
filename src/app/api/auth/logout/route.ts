import { NextResponse } from 'next/server';
import { buildLogoutCookieHeaders } from '@/lib/auth/jwt';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Đăng xuất thành công.',
  });

  const logoutCookies = buildLogoutCookieHeaders();
  logoutCookies.forEach((cookie) => {
    response.headers.append('Set-Cookie', cookie);
  });

  return response;
}
