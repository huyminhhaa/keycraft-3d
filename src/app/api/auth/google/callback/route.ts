import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import {
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  getGoogleOAuthConfig,
  resolveGoogleRedirectUri,
  sanitizeReturnTo,
} from '@/lib/auth/googleOAuth';
import { buildAuthCookieHeaders, signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { parseCookieHeader } from '@/lib/auth/session';

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
}

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

function clearOAuthCookies(response: NextResponse) {
  const expired = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  response.headers.append('Set-Cookie', `${OAUTH_STATE_COOKIE}=; ${expired}`);
  response.headers.append('Set-Cookie', `${OAUTH_VERIFIER_COOKIE}=; ${expired}`);
  response.headers.append('Set-Cookie', `${OAUTH_NEXT_COOKIE}=; ${expired}`);
}

function redirectWithError(origin: string, returnTo: string, errorCode: string): NextResponse {
  const url = new URL(returnTo, origin);
  url.searchParams.set('auth_error', errorCode);
  const res = NextResponse.redirect(url);
  clearOAuthCookies(res);
  return res;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const cookies = parseCookieHeader(req.headers.get('cookie') || '');

  const rawNext = cookies[OAUTH_NEXT_COOKIE] ? decodeURIComponent(cookies[OAUTH_NEXT_COOKIE]) : '/studio';
  const returnTo = sanitizeReturnTo(rawNext, '/studio');

  const errorParam = reqUrl.searchParams.get('error');
  if (errorParam) {
    return redirectWithError(reqUrl.origin, returnTo, errorParam === 'access_denied' ? 'access_denied' : 'oauth_failed');
  }

  const config = getGoogleOAuthConfig();
  if (!config) {
    return redirectWithError(reqUrl.origin, returnTo, 'google_not_configured');
  }

  const code = reqUrl.searchParams.get('code');
  const returnedState = reqUrl.searchParams.get('state');
  const expectedState = cookies[OAUTH_STATE_COOKIE];
  const codeVerifier = cookies[OAUTH_VERIFIER_COOKIE];

  // 1. Chống CSRF: đối chiếu state với httpOnly cookie bằng timingSafeEqual
  if (!code || !returnedState || !expectedState || !codeVerifier || !safeEqual(returnedState, expectedState)) {
    return redirectWithError(reqUrl.origin, returnTo, 'invalid_state');
  }

  try {
    // 2. Đổi Authorization Code + PKCE Verifier lấy Access Token từ Google
    const redirectUri = resolveGoogleRedirectUri(req);
    const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      return redirectWithError(reqUrl.origin, returnTo, 'token_exchange_failed');
    }

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenData.access_token) {
      return redirectWithError(reqUrl.origin, returnTo, 'token_exchange_failed');
    }

    // 3. Lấy thông tin định danh người dùng chuẩn OpenID Connect
    const userInfoRes = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      return redirectWithError(reqUrl.origin, returnTo, 'token_exchange_failed');
    }

    const profile = (await userInfoRes.json()) as GoogleUserInfo;
    if (!profile.email || !profile.sub || profile.email_verified === false) {
      return redirectWithError(reqUrl.origin, returnTo, 'unverified_email');
    }

    const normEmail = profile.email.trim().toLowerCase();
    const displayName = (profile.name || normEmail.split('@')[0] || 'Google Builder').trim().slice(0, 100);
    const avatarUrl = profile.picture || null;

    // 4. Upsert tài khoản vào PostgreSQL (có fallback in-memory nếu DB tạm offline)
    let userRecord = {
      id: `google_${profile.sub}`,
      email: normEmail,
      name: displayName,
      role: 'user',
      avatarUrl,
      authProvider: 'google' as const,
    };

    try {
      const existing = await db.select().from(users).where(eq(users.email, normEmail)).limit(1);

      if (existing[0]) {
        const updated = await db
          .update(users)
          .set({
            name: existing[0].name || displayName,
            avatarUrl: avatarUrl ?? existing[0].avatarUrl,
            googleId: profile.sub,
            authProvider: 'google',
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing[0].id))
          .returning();

        if (updated[0]) {
          userRecord = {
            id: updated[0].id,
            email: updated[0].email,
            name: updated[0].name,
            role: updated[0].role,
            avatarUrl: updated[0].avatarUrl,
            authProvider: 'google',
          };
        }
      } else {
        const inserted = await db
          .insert(users)
          .values({
            name: displayName,
            email: normEmail,
            passwordHash: null,
            avatarUrl,
            googleId: profile.sub,
            authProvider: 'google',
            role: 'user',
          })
          .returning();

        if (inserted[0]) {
          userRecord = {
            id: inserted[0].id,
            email: inserted[0].email,
            name: inserted[0].name,
            role: inserted[0].role,
            avatarUrl: inserted[0].avatarUrl,
            authProvider: 'google',
          };
        }
      }
    } catch (dbErr) {
      console.warn('[GOOGLE_OAUTH_DB_NOTICE]:', dbErr instanceof Error ? dbErr.message : dbErr);
    }

    // 5. Ký JWT Access + Refresh Token lưu vào httpOnly Cookies đồng nhất toàn app
    const jwtPayload = {
      userId: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
      avatarUrl: userRecord.avatarUrl,
      authProvider: 'google' as const,
    };

    const accessToken = await signAccessToken(jwtPayload);
    const refreshToken = await signRefreshToken(jwtPayload);
    const authCookies = buildAuthCookieHeaders({ accessToken, refreshToken });

    const finalRedirect = new URL(returnTo, reqUrl.origin);
    const response = NextResponse.redirect(finalRedirect);
    clearOAuthCookies(response);
    authCookies.forEach((cookie) => response.headers.append('Set-Cookie', cookie));
    return response;
  } catch (error) {
    console.error('[GOOGLE_OAUTH_CALLBACK_ERROR]:', error);
    return redirectWithError(reqUrl.origin, returnTo, 'oauth_failed');
  }
}
