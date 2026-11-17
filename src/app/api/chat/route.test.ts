import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

describe('/api/chat API Route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('trả về HTTP 401 khi chưa cấu hình Gemini API Key', async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const request = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Tư vấn phím thock' }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toContain('GOOGLE_GENERATIVE_AI_API_KEY');
  });

  it('xử lý lỗi an toàn khi request body không hợp lệ', async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test_mock_key';

    const invalidRequest = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json-string',
    });

    const response = await POST(invalidRequest);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('trả về HTTP 429 khi vượt quá hạn mức Rate Limit', async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test_mock_key';
    process.env.AI_RATE_LIMIT_MAX_REQUESTS = '2';
    process.env.AI_RATE_LIMIT_WINDOW_SECONDS = '60';

    const reqHeaders = {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.195',
    };

    // 2 request đầu tiên hợp lệ
    for (let i = 0; i < 2; i++) {
      await POST(
        new Request('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: reqHeaders,
          body: 'invalid-json', // Tránh gọi Gemini SDK thật
        })
      );
    }

    // Request thứ 3 bị rate limit chặn lại trước khi xử lý
    const rateLimitedRes = await POST(
      new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ messages: [] }),
      })
    );

    expect(rateLimitedRes.status).toBe(429);
    expect(rateLimitedRes.headers.get('Retry-After')).toBeDefined();
    const data = await rateLimitedRes.json();
    expect(data.error).toContain('quá nhiều yêu cầu');
  });
});
