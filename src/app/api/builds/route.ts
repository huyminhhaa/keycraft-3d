import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBuild, getTrendingBuilds } from '@/lib/builds/buildService';
import { verifyToken, COOKIE_ACCESS_TOKEN } from '@/lib/auth/jwt';
import type { KeyboardState } from '@/types/keyboard';

// Schema xác thực dữ liệu khi tạo bản build mới
const createBuildBodySchema = z.object({
  title: z
    .string()
    .min(2, 'Tiêu đề bản build phải từ 2 ký tự trở lên')
    .max(100, 'Tiêu đề không được vượt quá 100 ký tự'),
  description: z.string().max(500, 'Mô tả không được vượt quá 500 ký tự').optional(),
  config: z.record(z.string(), z.unknown()).refine(
    (cfg) => typeof cfg.layout === 'string' && typeof cfg.plateMaterial === 'string',
    { message: 'Cấu hình bàn phím 3D không hợp lệ' }
  ),
  isPublic: z.boolean().optional().default(true),
});

/**
 * GET /api/builds: Lấy danh sách các bản build thịnh hành (Trending Builds)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(searchParams.get('limit')) || 12, 50));
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0);

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
    const rawBody = await req.json();
    const parseResult = createBuildBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || 'Dữ liệu bản build không hợp lệ.';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { title, description, config, isPublic } = parseResult.data;

    // 1. Kiểm tra xác thực người dùng (Optional Auth)
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

    // 2. Tạo bản build mới
    const build = await createBuild({
      title,
      description: description || null,
      config: config as unknown as KeyboardState,
      userId,
      isPublic,
    });

    const shareUrl = `/build/${build.slug}`;

    return NextResponse.json(
      {
        success: true,
        build,
        shareUrl,
        message: 'Bản build đã được lưu thành công!',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API_BUILDS_POST_ERROR]:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi lưu bản build.' },
      { status: 500 }
    );
  }
}
