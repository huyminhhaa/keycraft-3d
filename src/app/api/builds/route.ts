import { NextResponse } from 'next/server';
import { createBuild, getTrendingBuilds } from '@/lib/builds/buildService';
import { createBuildBodySchema, MAX_BUILD_PAYLOAD_BYTES } from '@/lib/builds/buildSchema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { RATE_LIMITS, rateLimitHeaders, slidingWindowRateLimit } from '@/lib/security/rateLimit';
import { getClientIp, readJsonBody } from '@/lib/security/requestGuard';
import type { KeyboardState } from '@/types/keyboard';

/**
 * GET /api/builds: Lấy danh sách các bản build thịnh hành (Trending Builds)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(searchParams.get('limit')) || 12, 50));
    const offset = Math.max(0, Math.min(Number(searchParams.get('offset')) || 0, 10_000));

    const list = await getTrendingBuilds(limit, offset);

    return NextResponse.json({
      success: true,
      builds: list,
      count: list.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[API_BUILDS_GET_ERROR]:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách bản build.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/builds: Lưu cấu hình bàn phím 3D thành bản build và sinh link chia sẻ
 */
export async function POST(req: Request) {
  try {
    // 1. Xác thực tuỳ chọn (cookie / Bearer, đã kiểm tra danh sách đen token)
    const session = await getSessionFromRequest(req);
    const userId = session.authenticated && session.user ? session.user.id : null;

    // 2. Chống spam ghi DB: 10 lượt / phút / user (hoặc IP nếu là khách)
    const limit = await slidingWindowRateLimit(
      'build-create',
      userId ? `user:${userId}` : getClientIp(req),
      RATE_LIMITS.buildCreate
    );
    if (!limit.success) {
      return NextResponse.json(
        { error: `Bạn lưu bản build quá nhanh. Vui lòng thử lại sau ${limit.retryAfterSeconds} giây.` },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    // 3. Body tối đa 50KB, đếm byte thật khi stream
    const body = await readJsonBody(req, MAX_BUILD_PAYLOAD_BYTES);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    const parseResult = createBuildBodySchema.safeParse(body.data);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || 'Dữ liệu bản build không hợp lệ.';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { title, description, config, isPublic } = parseResult.data;

    // 4. Tạo bản build mới
    const build = await createBuild({
      title,
      description: description || null,
      config: config as unknown as KeyboardState,
      userId,
      isPublic,
    });

    const response = NextResponse.json(
      {
        success: true,
        build,
        shareUrl: `/build/${build.slug}`,
        message: 'Bản build đã được lưu thành công!',
      },
      { status: 201 }
    );
    if (session.refreshedAccessCookie) {
      response.headers.append('Set-Cookie', session.refreshedAccessCookie);
    }
    return response;
  } catch (error) {
    console.error('[API_BUILDS_POST_ERROR]:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi lưu bản build.' },
      { status: 500 }
    );
  }
}
