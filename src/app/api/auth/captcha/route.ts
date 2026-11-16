import { NextResponse } from 'next/server';
import { generateCaptchaChallenge } from '@/lib/auth/bruteForce';

export async function GET() {
  const challenge = generateCaptchaChallenge();
  return NextResponse.json({
    success: true,
    captcha: challenge,
  });
}
