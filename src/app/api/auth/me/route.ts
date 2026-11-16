import { NextResponse } from 'next/server';
import {
  verifyToken,
  signAccessToken,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
} from '@/lib/auth/jwt';

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const authHeader = req.headers.get('authorization') || '';

    // Trích xuất Access Token từ Cookie hoặc Bearer Header
    let accessToken: string | undefined;
    let refreshToken: string | undefined;

    const cookiePairs = cookieHeader.split(';').map((c) => c.trim());
    for (const pair of cookiePairs) {
      if (pair.startsWith(`${COOKIE_ACCESS_TOKEN}=`)) {
        accessToken = pair.substring(COOKIE_ACCESS_TOKEN.length + 1);
      }
      if (pair.startsWith(`${COOKIE_REFRESH_TOKEN}=`)) {
        refreshToken = pair.substring(COOKIE_REFRESH_TOKEN.length + 1);
      }
    }

    if (!accessToken && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7).trim();
    }

    // 1. Kiểm tra Access Token
    if (accessToken) {
      const payload = await verifyToken(accessToken, 'access');
      if (payload) {
        return NextResponse.json({
          authenticated: true,
          user: {
            id: payload.userId,
            email: payload.email,
            name: payload.name,
            role: payload.role,
          },
        });
      }
    }

    // 2. Tự động Silent-Refresh nếu Access Token hết hạn nhưng Refresh Token còn hạn
    if (refreshToken) {
      const refreshPayload = await verifyToken(refreshToken, 'refresh');
      if (refreshPayload) {
        const newAccessToken = await signAccessToken({
          userId: refreshPayload.userId,
          email: refreshPayload.email,
          name: refreshPayload.name,
          role: refreshPayload.role,
        });

        const isProd = process.env.NODE_ENV === 'production';
        const secureFlag = isProd ? '; Secure' : '';
        const newCookie = `${COOKIE_ACCESS_TOKEN}=${newAccessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${secureFlag}`;

        const response = NextResponse.json({
          authenticated: true,
          user: {
            id: refreshPayload.userId,
            email: refreshPayload.email,
            name: refreshPayload.name,
            role: refreshPayload.role,
          },
        });

        response.headers.append('Set-Cookie', newCookie);
        return response;
      }
    }

    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401 }
    );
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'digest' in error &&
      (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED'
    ) {
      throw error;
    }
    console.error('[AUTH_ME_ERROR]:', error);
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401 }
    );
  }
}
