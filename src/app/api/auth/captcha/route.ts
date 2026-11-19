import { connection, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  CAPTCHA_TOKEN_TTL_SECONDS,
  generateCaptchaChallenge,
  redeemCaptchaChallenge,
} from '@/lib/auth/bruteForce';
import { RATE_LIMITS, rateLimitHeaders, slidingWindowRateLimit } from '@/lib/security/rateLimit';
import { getClientIp, KB, readJsonBody } from '@/lib/security/requestGuard';

/** GET /api/auth/captcha: phát một đề Proof-of-Work mới (có chữ ký HMAC + hạn 5 phút) */
export async function GET() {
  // Cache Components có thể prerender GET handler lúc build -> mọi người nhận CÙNG một đề.
  // connection() buộc chạy theo từng request.
  await connection();
  return NextResponse.json(
    { success: true, captcha: generateCaptchaChallenge() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

const redeemSchema = z.object({
  challengeId: z.string().min(1).max(100),
  // Lời giải Proof-of-Work: số nguyên không âm
  answer: z.string().regex(/^\d{1,12}$/),
  signature: z.string().min(1).max(128),
  email: z.string().trim().min(3).max(254),
});

/**
 * POST /api/auth/captcha: nộp đáp án -> nhận vé `captchaToken` dùng 1 lần (TTL 3 phút)
 * để gửi kèm form đăng nhập. Mỗi đề chỉ đổi được 1 vé.
 */
export async function POST(req: Request) {
  const limit = await slidingWindowRateLimit('captcha', getClientIp(req), RATE_LIMITS.captchaVerify);
  if (!limit.success) {
    return NextResponse.json(
      { error: `Bạn thử quá nhiều lần. Vui lòng đợi ${limit.retryAfterSeconds} giây.` },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const body = await readJsonBody(req, 2 * KB);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const parsed = redeemSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Thiếu thông tin thử thách CAPTCHA.', captcha: generateCaptchaChallenge() },
      { status: 400 }
    );
  }

  const { challengeId, answer, signature, email } = parsed.data;
  const captchaToken = await redeemCaptchaChallenge(challengeId, answer, signature, email);

  if (!captchaToken) {
    return NextResponse.json(
      {
        error: 'Câu trả lời CAPTCHA không chính xác, đã hết hạn hoặc đã được dùng.',
        requireCaptcha: true,
        captcha: generateCaptchaChallenge(),
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { success: true, captchaToken, expiresIn: CAPTCHA_TOKEN_TTL_SECONDS },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
