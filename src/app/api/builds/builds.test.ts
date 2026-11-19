import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getBuilds, POST as postBuild } from './route';
import {
  GET as getBuildDetail,
  POST as postForkBuild,
  PATCH as patchBuild,
  DELETE as deleteBuildRoute,
} from './[slug]/route';
import { resetMemoryBuilds } from '@/lib/builds/buildService';
import { resetSlidingWindowMemory } from '@/lib/security/rateLimit';
import { signAccessToken, COOKIE_ACCESS_TOKEN } from '@/lib/auth/jwt';

const validConfig = {
  modelId: 'procedural-default',
  layout: '75%',
  plateMaterial: 'pom',
  caseMaterial: 'aluminum',
  switchType: 'linear',
  keycapColor: '#1e293b',
  caseColor: '#0f172a',
};

describe('Builds API Routes (/api/builds & /api/builds/[slug])', () => {
  beforeEach(() => {
    resetMemoryBuilds();
  });

  it('GET /api/builds trả về HTTP 200 và danh sách rỗng ban đầu', async () => {
    const req = new Request('http://localhost:3000/api/builds?limit=10&offset=0');
    const res = await getBuilds(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.builds)).toBe(true);
  });

  it('POST /api/builds trả về HTTP 400 khi dữ liệu thiếu hoặc không hợp lệ', async () => {
    // Thiếu title
    const req1 = new Request('http://localhost:3000/api/builds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: validConfig }),
    });
    const res1 = await postBuild(req1);
    expect(res1.status).toBe(400);

    // Config thiếu plateMaterial
    const req2 = new Request('http://localhost:3000/api/builds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Build Test', config: { layout: '75%' } }),
    });
    const res2 = await postBuild(req2);
    expect(res2.status).toBe(400);
  });

  it('POST /api/builds lưu thành công và trả về HTTP 201 kèm shareUrl', async () => {
    const req = new Request('http://localhost:3000/api/builds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Bàn phím Deep Thock 75%',
        description: 'Vỏ nhôm plate POM',
        config: validConfig,
      }),
    });

    const res = await postBuild(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.build.title).toBe('Bàn phím Deep Thock 75%');
    expect(data.shareUrl).toMatch(/^\/build\/ban-phim-deep-thock-75-[a-z0-9]{4}$/);
  });

  it('GET /api/builds/[slug] trả về 404 nếu không tìm thấy và 200 khi tìm thấy', async () => {
    const notFoundReq = new Request('http://localhost:3000/api/builds/not-found-slug');
    const notFoundRes = await getBuildDetail(notFoundReq, {
      params: Promise.resolve({ slug: 'not-found-slug' }),
    });
    expect(notFoundRes.status).toBe(404);

    // Tạo một build mới
    const createReq = new Request('http://localhost:3000/api/builds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Gateron Oil King 75', config: validConfig }),
    });
    const createRes = await postBuild(createReq);
    const createdData = await createRes.json();
    const slug = createdData.build.slug;

    // Xem chi tiết build
    const detailReq = new Request(`http://localhost:3000/api/builds/${slug}`);
    const detailRes = await getBuildDetail(detailReq, {
      params: Promise.resolve({ slug }),
    });
    expect(detailRes.status).toBe(200);

    const detailData = await detailRes.json();
    expect(detailData.build.title).toBe('Gateron Oil King 75');
    expect(detailData.build.viewCount).toBe(1);
  });

  it('POST /api/builds/[slug] remix thành công bản build', async () => {
    // 1. Tạo build gốc
    const createReq = new Request('http://localhost:3000/api/builds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Bản Gốc Retro', config: validConfig }),
    });
    const createRes = await postBuild(createReq);
    const { build: original } = await createRes.json();

    // 2. Remix build gốc
    const forkReq = new Request(`http://localhost:3000/api/builds/${original.slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Bản Remix Của Tôi' }),
    });

    const forkRes = await postForkBuild(forkReq, {
      params: Promise.resolve({ slug: original.slug }),
    });

    expect(forkRes.status).toBe(201);
    const forkData = await forkRes.json();
    expect(forkData.build.title).toBe('Bản Remix Của Tôi');
    expect(forkData.build.slug).not.toBe(original.slug);
  });
});

describe('Bảo mật Builds API: IDOR, payload, rate limit', () => {
  const owner = { userId: 'usr_owner', email: 'owner@keycraft.io', name: 'Owner', role: 'user' };
  const attacker = { userId: 'usr_attacker', email: 'evil@keycraft.io', name: 'Evil', role: 'user' };
  const cookieFor = async (u: typeof owner) => `${COOKIE_ACCESS_TOKEN}=${await signAccessToken(u)}`;
  const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

  const createAs = async (cookie: string | null, extra: Record<string, unknown> = {}) => {
    const res = await postBuild(
      new Request('http://localhost:3000/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({ title: 'Build của chủ', config: validConfig, ...extra }),
      })
    );
    return (await res.json()).build as { slug: string; userId: string | null };
  };

  beforeEach(() => {
    resetMemoryBuilds();
    resetSlidingWindowMemory();
  });

  it('PATCH: chủ sở hữu sửa được; người khác 403; chưa đăng nhập 401', async () => {
    const ownerCookie = await cookieFor(owner);
    const build = await createAs(ownerCookie);
    expect(build.userId).toBe(owner.userId);

    const patch = (cookie: string | null, body: unknown) =>
      patchBuild(
        new Request(`http://localhost:3000/api/builds/${build.slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
          body: JSON.stringify(body),
        }),
        ctx(build.slug)
      );

    expect((await patch(null, { title: 'Hack' })).status).toBe(401);
    expect((await patch(await cookieFor(attacker), { title: 'Bị chiếm quyền' })).status).toBe(403);

    const ok = await patch(ownerCookie, { title: 'Tên mới', isPublic: false });
    expect(ok.status).toBe(200);
    const data = await ok.json();
    expect(data.build.title).toBe('Tên mới');
    expect(data.build.isPublic).toBe(false);
  });

  it('PATCH: không cho đổi chủ sở hữu bằng cách gửi userId trong body', async () => {
    const ownerCookie = await cookieFor(owner);
    const build = await createAs(ownerCookie);
    const res = await patchBuild(
      new Request(`http://localhost:3000/api/builds/${build.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: ownerCookie },
        body: JSON.stringify({ userId: attacker.userId }),
      }),
      ctx(build.slug)
    );
    expect(res.status).toBe(400);
  });

  it('DELETE: người khác 403 và build vẫn còn; chủ sở hữu xoá được', async () => {
    const ownerCookie = await cookieFor(owner);
    const build = await createAs(ownerCookie);
    const del = (cookie: string) =>
      deleteBuildRoute(
        new Request(`http://localhost:3000/api/builds/${build.slug}`, { method: 'DELETE', headers: { cookie } }),
        ctx(build.slug)
      );

    expect((await del(await cookieFor(attacker))).status).toBe(403);
    expect((await getBuildDetail(new Request('http://localhost/x'), ctx(build.slug))).status).toBe(200);

    expect((await del(ownerCookie)).status).toBe(200);
    expect((await getBuildDetail(new Request('http://localhost/x'), ctx(build.slug))).status).toBe(404);
  });

  it('build ẩn danh (không có chủ) thì không ai sửa/xoá được', async () => {
    const build = await createAs(null);
    const res = await deleteBuildRoute(
      new Request(`http://localhost:3000/api/builds/${build.slug}`, {
        method: 'DELETE',
        headers: { cookie: await cookieFor(attacker) },
      }),
      ctx(build.slug)
    );
    expect(res.status).toBe(403);
  });

  it('build riêng tư: chỉ chủ xem/remix được, người khác nhận 404', async () => {
    const ownerCookie = await cookieFor(owner);
    const build = await createAs(ownerCookie, { isPublic: false });
    const get = async (cookie: string | null) =>
      (await getBuildDetail(new Request('http://localhost/x', { headers: cookie ? { cookie } : {} }), ctx(build.slug)))
        .status;

    expect(await get(ownerCookie)).toBe(200);
    expect(await get(await cookieFor(attacker))).toBe(404);
    expect(await get(null)).toBe(404);

    const fork = await postForkBuild(
      new Request(`http://localhost:3000/api/builds/${build.slug}`, {
        method: 'POST',
        headers: { cookie: await cookieFor(attacker) },
      }),
      ctx(build.slug)
    );
    expect(fork.status).toBe(404);
  });

  it('chặn tiêu đề > 100 ký tự, mô tả > 500 ký tự và payload > 50KB', async () => {
    const send = (body: unknown) =>
      postBuild(
        new Request('http://localhost:3000/api/builds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      );

    expect((await send({ title: 'x'.repeat(101), config: validConfig })).status).toBe(400);
    expect((await send({ title: 'OK build', description: 'x'.repeat(501), config: validConfig })).status).toBe(400);

    const huge = { ...validConfig, notes: 'x'.repeat(60 * 1024) };
    expect((await send({ title: 'Payload bomb', config: huge })).status).toBe(413);
  });

  it('POST /api/builds: tối đa 10 lượt / phút / user, lượt 11 -> 429 kèm Retry-After', async () => {
    const cookie = await cookieFor(owner);
    const statuses: number[] = [];
    let last: Response | null = null;
    for (let i = 0; i < 11; i++) {
      last = await postBuild(
        new Request('http://localhost:3000/api/builds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ title: `Spam ${i}`, config: validConfig }),
        })
      );
      statuses.push(last.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(Number(last?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
