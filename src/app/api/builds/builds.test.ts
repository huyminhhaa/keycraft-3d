import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getBuilds, POST as postBuild } from './route';
import { GET as getBuildDetail, POST as postForkBuild } from './[slug]/route';
import { resetMemoryBuilds } from '@/lib/builds/buildService';

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
