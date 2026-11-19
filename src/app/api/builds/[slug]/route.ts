import { NextResponse } from 'next/server';
import {
  canViewBuild,
  deleteBuild,
  forkBuild,
  getBuildBySlug,
  updateBuild,
  type BuildMutationResult,
} from '@/lib/builds/buildService';
import {
  forkBuildBodySchema,
  MAX_BUILD_PAYLOAD_BYTES,
  SLUG_PATTERN,
  updateBuildBodySchema,
} from '@/lib/builds/buildSchema';
import { getSessionFromRequest, type SessionResult } from '@/lib/auth/session';
import { RATE_LIMITS, rateLimitHeaders, slidingWindowRateLimit } from '@/lib/security/rateLimit';
import { getClientIp, KB, readJsonBody } from '@/lib/security/requestGuard';
import type { KeyboardState } from '@/types/keyboard';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const NOT_FOUND_MESSAGE = 'Bản build không tồn tại hoặc đã bị xóa.';

function withRefreshedCookie(res: NextResponse, session: SessionResult): NextResponse {
  if (session.refreshedAccessCookie) {
    res.headers.append('Set-Cookie', session.refreshedAccessCookie);
  }
  return res;
}

async function readSlug(context: RouteContext): Promise<string | null> {
  const { slug } = await context.params;
  return slug && SLUG_PATTERN.test(slug) ? slug : null;
}

/**
 * GET /api/builds/[slug]: Xem chi tiết một bản build và cấu hình 3D.
 * Build riêng tư chỉ chủ sở hữu xem được; người khác nhận 404 (không lộ là build có tồn tại).
 */
export async function GET(req: Request, context: RouteContext) {
  try {
    const slug = await readSlug(context);
    if (!slug) {
      return NextResponse.json({ error: 'Slug không hợp lệ.' }, { status: 400 });
    }

    const session = await getSessionFromRequest(req);
    const viewerId = session.user?.id ?? null;

    const build = await getBuildBySlug(slug, true);
    if (!build || !canViewBuild(build, viewerId)) {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    return withRefreshedCookie(NextResponse.json({ success: true, build }), session);
  } catch (error) {
    console.error('[API_BUILDS_DETAIL_GET_ERROR]:', error);
    return NextResponse.json(
      { error: 'Không thể tải thông tin bản build.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/builds/[slug]: Remix / Fork bản build hiện tại (dùng chung hạn mức lưu build)
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const slug = await readSlug(context);
    if (!slug) {
      return NextResponse.json({ error: 'Slug không hợp lệ.' }, { status: 400 });
    }

    const session = await getSessionFromRequest(req);
    const userId = session.user?.id ?? null;

    const limit = await slidingWindowRateLimit(
      'build-create',
      userId ? `user:${userId}` : getClientIp(req),
      RATE_LIMITS.buildCreate
    );
    if (!limit.success) {
      return NextResponse.json(
        { error: `Bạn remix quá nhanh. Vui lòng thử lại sau ${limit.retryAfterSeconds} giây.` },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    // Body tuỳ chọn (chỉ có tiêu đề mới)
    let customTitle: string | undefined;
    if (req.headers.get('content-length') !== '0' && req.body) {
      const body = await readJsonBody(req, 2 * KB);
      if (body.ok) {
        const parsed = forkBuildBodySchema.safeParse(body.data);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.issues[0]?.message || 'Tiêu đề không hợp lệ.' },
            { status: 400 }
          );
        }
        customTitle = parsed.data.title;
      } else if (body.status === 413) {
        return NextResponse.json({ error: body.error }, { status: 413 });
      }
    }

    // Không cho remix build riêng tư của người khác
    const original = await getBuildBySlug(slug, false);
    if (!original || !canViewBuild(original, userId)) {
      return NextResponse.json({ error: 'Không tìm thấy bản build gốc để remix.' }, { status: 404 });
    }

    const forked = await forkBuild(slug, userId, customTitle);
    if (!forked) {
      return NextResponse.json(
        { error: 'Không tìm thấy bản build gốc để remix.' },
        { status: 404 }
      );
    }

    return withRefreshedCookie(
      NextResponse.json(
        {
          success: true,
          build: forked,
          shareUrl: `/build/${forked.slug}`,
          message: 'Đã remix bản build thành công!',
        },
        { status: 201 }
      ),
      session
    );
  } catch (error) {
    console.error('[API_BUILDS_FORK_ERROR]:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra sự cố khi remix bản build.' },
      { status: 500 }
    );
  }
}

function mutationResponse(result: BuildMutationResult, session: SessionResult, okMessage: string) {
  if (result.status === 'not_found') {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }
  if (result.status === 'forbidden') {
    return NextResponse.json(
      { error: 'Bạn không có quyền thay đổi bản build này.' },
      { status: 403 }
    );
  }
  return withRefreshedCookie(
    NextResponse.json({ success: true, build: result.build, message: okMessage }),
    session
  );
}

/** Chung cho PATCH/DELETE: bắt buộc đăng nhập + rate limit theo user */
async function authorizeMutation(
  req: Request
): Promise<{ ok: true; session: SessionResult; userId: string } | { ok: false; res: NextResponse }> {
  const session = await getSessionFromRequest(req);
  if (!session.authenticated || !session.user) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'Vui lòng đăng nhập để thay đổi bản build.' }, { status: 401 }),
    };
  }

  const limit = await slidingWindowRateLimit(
    'build-mutate',
    `user:${session.user.id}`,
    RATE_LIMITS.buildMutate
  );
  if (!limit.success) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: `Thao tác quá nhanh. Vui lòng thử lại sau ${limit.retryAfterSeconds} giây.` },
        { status: 429, headers: rateLimitHeaders(limit) }
      ),
    };
  }
  return { ok: true, session, userId: session.user.id };
}

/**
 * PATCH /api/builds/[slug]: Sửa tiêu đề / mô tả / cấu hình / chế độ công khai — chỉ chủ sở hữu.
 * userId lấy từ JWT phía server, KHÔNG BAO GIỜ tin userId gửi lên trong body.
 */
export async function PATCH(req: Request, context: RouteContext) {
  try {
    const slug = await readSlug(context);
    if (!slug) {
      return NextResponse.json({ error: 'Slug không hợp lệ.' }, { status: 400 });
    }

    const auth = await authorizeMutation(req);
    if (!auth.ok) return auth.res;

    const body = await readJsonBody(req, MAX_BUILD_PAYLOAD_BYTES);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    const parsed = updateBuildBodySchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Dữ liệu cập nhật không hợp lệ.' },
        { status: 400 }
      );
    }

    const { config, ...rest } = parsed.data;
    const result = await updateBuild(slug, auth.userId, {
      ...rest,
      ...(config !== undefined ? { config: config as unknown as KeyboardState } : {}),
    });

    return mutationResponse(result, auth.session, 'Đã cập nhật bản build.');
  } catch (error) {
    console.error('[API_BUILDS_PATCH_ERROR]:', error);
    return NextResponse.json({ error: 'Không thể cập nhật bản build.' }, { status: 500 });
  }
}

/**
 * DELETE /api/builds/[slug]: Xoá bản build — chỉ chủ sở hữu.
 */
export async function DELETE(req: Request, context: RouteContext) {
  try {
    const slug = await readSlug(context);
    if (!slug) {
      return NextResponse.json({ error: 'Slug không hợp lệ.' }, { status: 400 });
    }

    const auth = await authorizeMutation(req);
    if (!auth.ok) return auth.res;

    const result = await deleteBuild(slug, auth.userId);
    return mutationResponse(result, auth.session, 'Đã xoá bản build.');
  } catch (error) {
    console.error('[API_BUILDS_DELETE_ERROR]:', error);
    return NextResponse.json({ error: 'Không thể xoá bản build.' }, { status: 500 });
  }
}
