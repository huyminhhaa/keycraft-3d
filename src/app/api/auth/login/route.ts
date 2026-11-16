import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken, buildAuthCookieHeaders } from '@/lib/auth/jwt';
import {
  checkLoginSecurity,
  recordFailedLogin,
  recordSuccessfulLogin,
  verifyCaptchaChallenge,
  generateCaptchaChallenge,
} from '@/lib/auth/bruteForce';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, captchaAnswer, captchaChallengeId, captchaSignature } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ Email và Mật khẩu.' },
        { status: 400 }
      );
    }

    const normEmail = email.trim().toLowerCase();

    // 1. Kiểm tra lá chắn bảo mật Brute-force Shield
    const securityStatus = await checkLoginSecurity(normEmail);

    if (securityStatus.isLocked) {
      return NextResponse.json(
        {
          error: `Tài khoản tạm thời bị khóa do nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau ${Math.ceil(
            securityStatus.remainingLockoutSeconds / 60
          )} phút.`,
          isLocked: true,
          remainingLockoutSeconds: securityStatus.remainingLockoutSeconds,
        },
        { status: 423 }
      );
    }

    // 2. Bắt buộc giải thử thách CAPTCHA nếu đã từng nhập sai >= 3 lần
    if (securityStatus.requireCaptcha) {
      const isCaptchaValid = verifyCaptchaChallenge(
        captchaChallengeId,
        captchaAnswer,
        captchaSignature
      );

      if (!isCaptchaValid) {
        return NextResponse.json(
          {
            error: 'Câu trả lời CAPTCHA không chính xác hoặc đã hết hạn.',
            requireCaptcha: true,
            captcha: generateCaptchaChallenge(),
          },
          { status: 400 }
        );
      }
    }

    // 3. Tìm kiếm tài khoản trong Database
    let userRecord: typeof users.$inferSelect | null = null;
    try {
      const results = await db
        .select()
        .from(users)
        .where(eq(users.email, normEmail))
        .limit(1);
      userRecord = results[0] ?? null;
    } catch (err) {
      console.warn('[AUTH_LOGIN_DB_NOTICE]:', err instanceof Error ? err.message : err);
    }

    // 4. Kiểm tra mật khẩu
    let isPasswordCorrect = false;
    if (userRecord && userRecord.passwordHash) {
      isPasswordCorrect = await verifyPassword(password, userRecord.passwordHash);
    }

    // 5. Xử lý khi đăng nhập THẤT BẠI
    if (!userRecord || !isPasswordCorrect) {
      const failResult = await recordFailedLogin(normEmail);

      const errorMessage = failResult.isLocked
        ? 'Bạn đã nhập sai quá 5 lần. Tài khoản bị tạm khóa 15 phút.'
        : failResult.requireCaptcha
        ? 'Sai mật khẩu. Vui lòng giải câu đố bảo mật bên dưới để tiếp tục.'
        : `Email hoặc mật khẩu không chính xác. (Đã sai ${failResult.failedAttempts}/3 lần)`;

      return NextResponse.json(
        {
          error: errorMessage,
          requireCaptcha: failResult.requireCaptcha,
          isLocked: failResult.isLocked,
          failedAttempts: failResult.failedAttempts,
          remainingLockoutSeconds: failResult.remainingLockoutSeconds,
          ...(failResult.requireCaptcha ? { captcha: generateCaptchaChallenge() } : {}),
        },
        { status: 401 }
      );
    }

    // 6. Xử lý khi đăng nhập THÀNH CÔNG -> Reset bộ đếm lỗi & Cấp phát JWT
    await recordSuccessfulLogin(normEmail);

    const userPayload = {
      userId: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
    };

    const accessToken = await signAccessToken(userPayload);
    const refreshToken = await signRefreshToken(userPayload);
    const cookieHeaders = buildAuthCookieHeaders({ accessToken, refreshToken });

    const response = NextResponse.json({
      success: true,
      message: 'Đăng nhập thành công.',
      user: {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        role: userRecord.role,
        avatarUrl: userRecord.avatarUrl,
      },
    });

    cookieHeaders.forEach((cookie) => {
      response.headers.append('Set-Cookie', cookie);
    });

    return response;
  } catch (error) {
    console.error('[AUTH_LOGIN_ERROR]:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi xác thực. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
