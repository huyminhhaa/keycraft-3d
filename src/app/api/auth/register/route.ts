import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken, buildAuthCookieHeaders } from '@/lib/auth/jwt';
import { RATE_LIMITS, rateLimitHeaders, slidingWindowRateLimit } from '@/lib/security/rateLimit';
import { getClientIp, KB, readJsonBody } from '@/lib/security/requestGuard';

const isProduction = () => process.env.NODE_ENV === 'production';

export async function POST(req: Request) {
  try {
    // 0. Chống spam tạo tài khoản: tối đa 5 lượt / 10 phút / IP (đếm cả lượt không hợp lệ)
    const limit = await slidingWindowRateLimit('register', getClientIp(req), RATE_LIMITS.register);
    if (!limit.success) {
      return NextResponse.json(
        {
          error: `Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(
            limit.retryAfterSeconds / 60
          )} phút.`,
        },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    const body = await readJsonBody(req, 4 * KB);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }
    const raw = (typeof body.data === 'object' && body.data !== null ? body.data : {}) as Record<
      string,
      unknown
    >;
    const { name, email, password } = raw;

    // 1. Thẩm định dữ liệu đầu vào
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Họ và tên phải có tối thiểu 2 ký tự.' },
        { status: 400 }
      );
    }
    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Họ và tên không được vượt quá 100 ký tự.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || email.length > 254 || !emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Địa chỉ email không đúng định dạng.' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length > 200) {
      return NextResponse.json(
        { error: 'Mật khẩu phải chứa từ 8 đến 200 ký tự.' },
        { status: 400 }
      );
    }

    const passCheck = validatePasswordStrength(password);
    if (!passCheck.valid) {
      return NextResponse.json(
        { error: passCheck.message || 'Mật khẩu không đạt tiêu chuẩn an toàn.' },
        { status: 400 }
      );
    }

    const normEmail = email.trim().toLowerCase();

    // 2. Kiểm tra tài khoản đã tồn tại hay chưa
    try {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, normEmail))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'Email này đã được đăng ký tài khoản. Vui lòng đăng nhập.' },
          { status: 409 }
        );
      }
    } catch (dbErr) {
      // Production: không có DB thì không được cấp token cho tài khoản "ảo"
      if (isProduction()) throw dbErr;
      console.warn('[AUTH_REGISTER_DB_NOTICE]:', dbErr instanceof Error ? dbErr.message : dbErr);
    }

    // 3. Mã hóa mật khẩu an toàn
    const passwordHash = await hashPassword(password);

    // 4. Lưu người dùng vào cơ sở dữ liệu
    let newUser = {
      id: `usr_${Date.now()}`,
      name: name.trim(),
      email: normEmail,
      role: 'user',
      avatarUrl: null as string | null,
    };

    try {
      const inserted = await db
        .insert(users)
        .values({
          name: name.trim(),
          email: normEmail,
          passwordHash,
          role: 'user',
        })
        .returning();

      if (inserted[0]) {
        newUser = {
          id: inserted[0].id,
          name: inserted[0].name,
          email: inserted[0].email,
          role: inserted[0].role,
          avatarUrl: inserted[0].avatarUrl,
        };
      }
    } catch (insertErr) {
      if (isProduction()) throw insertErr;
      // Fallback cho môi trường test/dev offline
    }

    // 5. Ký phát sinh Access & Refresh Tokens
    const accessToken = await signAccessToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      avatarUrl: newUser.avatarUrl,
      authProvider: 'credentials',
    });

    const refreshToken = await signRefreshToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      avatarUrl: newUser.avatarUrl,
      authProvider: 'credentials',
    });

    const cookieHeaders = buildAuthCookieHeaders({ accessToken, refreshToken });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Đăng ký tài khoản thành công.',
        user: { ...newUser, authProvider: 'credentials' as const },
      },
      { status: 201 }
    );

    // Đính kèm Set-Cookie headers
    cookieHeaders.forEach((cookie) => {
      response.headers.append('Set-Cookie', cookie);
    });

    return response;
  } catch (error) {
    console.error('[AUTH_REGISTER_ERROR]:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra sự cố trong quá trình đăng ký. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
