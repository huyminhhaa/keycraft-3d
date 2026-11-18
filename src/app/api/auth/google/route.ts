import { NextResponse } from 'next/server';
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  buildGoogleAuthorizeUrl,
  computePkceChallenge,
  generateRandomBase64Url,
  getGoogleOAuthConfig,
  resolveGoogleRedirectUri,
  sanitizeReturnTo,
} from '@/lib/auth/googleOAuth';

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const returnTo = sanitizeReturnTo(reqUrl.searchParams.get('returnTo'), '/studio');
  const config = getGoogleOAuthConfig();

  if (!config) {
    const errorRedirect = new URL(returnTo, reqUrl.origin);
    errorRedirect.searchParams.set('auth_error', 'google_not_configured');
    return NextResponse.redirect(errorRedirect);
  }

  const state = generateRandomBase64Url(24);
  const codeVerifier = generateRandomBase64Url(32);
  const codeChallenge = computePkceChallenge(codeVerifier);
  const redirectUri = resolveGoogleRedirectUri(req);

  const authorizeUrl = buildGoogleAuthorizeUrl({
    clientId: config.clientId,
    redirectUri,
    state,
    codeChallenge,
  });

  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  const baseAttr = `Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secureFlag}`;

  const response = NextResponse.redirect(authorizeUrl);
  response.headers.append('Set-Cookie', `${OAUTH_STATE_COOKIE}=${state}; ${baseAttr}`);
  response.headers.append('Set-Cookie', `${OAUTH_VERIFIER_COOKIE}=${codeVerifier}; ${baseAttr}`);
  response.headers.append('Set-Cookie', `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(returnTo)}; ${baseAttr}`);
  return response;
}
