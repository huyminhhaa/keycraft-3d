import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken, buildAuthCookieHeaders } from '@/lib/auth/jwt';
import {
  checkIpSecurity,
  checkLoginSecurity,
  consumeCaptchaToken,
  generateCaptchaChallenge,
  recordFailedLogin,
  recordFailedLoginForIp,
  recordSuccessfulLogin,
} from '@/lib/auth/bruteForce';
import { getClientIp, KB, readJsonBody } from '@/lib/security/requestGuard';

// Hash bcrypt (cùng cost) của một chuỗi ngẫu nhiên: dùng khi email không tồn tại để thời gian
// phản hồi giống hệt email có thật -> không dò được email nào đã đăng ký (user enumeration).
let dummyHashPromise: Promise<string> | null = null;
const getDummyHash = (): Promise<string> =>
  (dummyHashPromise ??= hashPassword(randomBytes(16).toString('hex')));

const loginSchema = z.object({
  email: z.string().trim().min(3).max(254),
  // bcrypt chỉ dùng 72 byte đầu; chặn mật khẩu khổng lồ làm tốn CPU
  password: z.string().min(1).max(200),
  captchaToken: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);

    const body = await readJsonBody(req, 4 * KB);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    const parsed = loginSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ Email và Mật khẩu.' },
        { status: 400 }
      );
    }

    const { password, captchaToken } = parsed.data;
    const normEmail = parsed.data.email.toLowerCase();

    // 0. Khoá theo IP (Password Spraying: một IP thử sai trên nhiều tài khoản)
    const ipStatus = await checkIpSecurity(clientIp);
    if (ipStatus.isLocked) {
      return NextResponse.json(
        {
          error: `Phát hiện quá nhiều lần đăng nhập sai từ mạng của bạn. Vui lòng thử lại sau ${Math.ceil(
            ipStatus.remainingLockoutSeconds / 60
          )} phút.`,
          isLocked: true,
          remainingLockoutSeconds: ipStatus.remainingLockoutSeconds,
        },
        { status: 429, headers: { 'Retry-After': String(ipStatus.remainingLockoutSeconds) } }
      );
    }

    // 1. Kiểm tra lá chắn bảo mật Brute-force Shield theo email
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

    // 2. Đã sai >= 3 lần: bắt buộc có vé CAPTCHA dùng 1 lần (vé bị xoá ngay khi kiểm tra)
    if (securityStatus.requireCaptcha) {
      const isCaptchaValid = await consumeCaptchaToken(captchaToken, normEmail);

      if (!isCaptchaValid) {
        return NextResponse.json(
          {
            error: 'Vui lòng giải câu đố bảo mật (CAPTCHA) để tiếp tục.',
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

    // 4. Kiểm tra mật khẩu (luôn chạy bcrypt, kể cả khi không có tài khoản)
    const isPasswordCorrect = await verifyPassword(
      password,
      userRecord?.passwordHash || (await getDummyHash())
    );

    // 5. Xử lý khi đăng nhập THẤT BẠI
    if (!userRecord || !userRecord.passwordHash || !isPasswordCorrect) {
      const failResult = await recordFailedLogin(normEmail);
      await recordFailedLoginForIp(clientIp, normEmail);

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

    const authProvider = userRecord.authProvider === 'google' ? 'google' : 'credentials';
    const userPayload = {
      userId: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
      avatarUrl: userRecord.avatarUrl ?? null,
      authProvider: authProvider as 'credentials' | 'google',
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
        authProvider,
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
