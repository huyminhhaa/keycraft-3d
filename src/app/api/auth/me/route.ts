import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req);

    if (!session.authenticated || !session.user) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      authenticated: true,
      user: session.user,
    });

    if (session.refreshedAccessCookie) {
      response.headers.append('Set-Cookie', session.refreshedAccessCookie);
    }

    return response;
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
