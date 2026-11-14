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
});
