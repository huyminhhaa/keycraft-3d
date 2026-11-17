import { NextResponse } from 'next/server';
import { getBuildBySlug, forkBuild } from '@/lib/builds/buildService';
import { verifyToken, COOKIE_ACCESS_TOKEN } from '@/lib/auth/jwt';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/builds/[slug]: Xem chi tiết một bản build và cấu hình 3D
 */
export async function GET(req: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    if (!slug) {
      return NextResponse.json({ error: 'Slug không hợp lệ.' }, { status: 400 });
    }

    const build = await getBuildBySlug(slug, true);
    if (!build) {
      return NextResponse.json(
        { error: 'Bản build không tồn tại hoặc đã bị xóa.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      build,
    });
  } catch (error) {
    console.error('[API_BUILDS_DETAIL_GET_ERROR]:', error);
    return NextResponse.json(
      { error: 'Không thể tải thông tin bản build.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/builds/[slug]: Remix / Fork bản build hiện tại
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    if (!slug) {
      return NextResponse.json({ error: 'Slug không hợp lệ.' }, { status: 400 });
    }

    // 1. Kiểm tra xác thực người dùng (nếu có)
    let userId: string | null = null;
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_ACCESS_TOKEN}=`));

    if (match) {
      const token = match.split('=')[1];
      if (token) {
        const user = await verifyToken(token, 'access');
        if (user) {
          userId = user.userId;
        }
      }
    }

    // 2. Đọc tiêu đề mới nếu có
    let customTitle: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.title === 'string') {
        customTitle = body.title;
      }
    } catch {
      // Body rỗng -> Dùng tiêu đề mặc định
    }

    // 3. Thực hiện Fork
    const forked = await forkBuild(slug, userId, customTitle);
    if (!forked) {
      return NextResponse.json(
        { error: 'Không tìm thấy bản build gốc để remix.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        build: forked,
        shareUrl: `/build/${forked.slug}`,
        message: 'Đã remix bản build thành công!',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API_BUILDS_FORK_ERROR]:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra sự cố khi remix bản build.' },
      { status: 500 }
    );
  }
}
