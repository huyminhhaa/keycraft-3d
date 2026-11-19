import { describe, it, expect } from 'vitest';
import { getClientIp, jsonByteSize, readJsonBody, trustedProxyHops } from './requestGuard';

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/x', { method: 'POST', body, headers });

describe('Request Guard (src/lib/security/requestGuard.ts)', () => {
  it('đọc JSON hợp lệ và trả về số byte thật', async () => {
    const res = await readJsonBody(post(JSON.stringify({ a: 'á' })), 1024);
    expect(res).toEqual({ ok: true, data: { a: 'á' }, bytes: Buffer.byteLength('{"a":"á"}') });
  });

  it('chặn 413 khi body thật vượt giới hạn (đếm byte UTF-8, không phải số ký tự)', async () => {
    // 600 ký tự "ộ" = 1.800 byte UTF-8 > 1.024
    const res = await readJsonBody(post(JSON.stringify({ t: 'ộ'.repeat(600) })), 1024);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(413);
  });

  it('chặn 413 ngay từ header Content-Length khai báo quá lớn', async () => {
    const res = await readJsonBody(post('{}', { 'content-length': '999999' }), 1024);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(413);
  });

  it('trả 400 cho JSON hỏng hoặc body rỗng', async () => {
    const broken = await readJsonBody(post('not-json'), 1024);
    expect(broken.ok === false && broken.status === 400).toBe(true);

    const empty = await readJsonBody(new Request('http://localhost/api/x', { method: 'POST' }), 1024);
    expect(empty.ok === false && empty.status === 400).toBe(true);
  });

  it('jsonByteSize đo đúng byte UTF-8', () => {
    expect(jsonByteSize({ k: 'đ' })).toBe(Buffer.byteLength('{"k":"đ"}'));
  });

  describe('getClientIp — chỉ tin IP do proxy của ta ghi', () => {
    const req = (h: Record<string, string>) => new Request('http://localhost', { headers: h });

    it('không có proxy đáng tin (hops = 0): bỏ qua mọi header client tự đặt', () => {
      expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.7' }), 0)).toBe('unknown');
      expect(getClientIp(req({ 'x-real-ip': '203.0.113.7' }), 0)).toBe('unknown');
    });

    it('1 proxy: lấy IP ở cuối chuỗi (do proxy nối vào), phần client giả mạo bên trái bị bỏ', () => {
      // Kẻ tấn công gửi "X-Forwarded-For: 1.2.3.4", proxy nối IP thật 203.0.113.7 vào cuối
      expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }), 1)).toBe('203.0.113.7');
      expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.7' }), 1)).toBe('203.0.113.7');
    });

    it('2 proxy (CDN + nginx): lấy phần tử thứ 2 từ phải', () => {
      expect(getClientIp(req({ 'x-forwarded-for': 'fake, 198.51.100.9, 10.0.0.2' }), 2)).toBe('198.51.100.9');
    });

    it('thiếu x-forwarded-for thì dùng x-real-ip; giá trị lạ -> unknown', () => {
      expect(getClientIp(req({ 'x-real-ip': '2001:db8::1' }), 1)).toBe('2001:db8::1');
      expect(getClientIp(req({ 'x-forwarded-for': 'x'.repeat(500) }), 1)).toBe('unknown');
      expect(getClientIp(req({ 'x-forwarded-for': '1.1.1.1:evil*key' }), 1)).toBe('unknown');
      expect(getClientIp(req({}), 1)).toBe('unknown');
    });

    it('trustedProxyHops: Vercel mặc định 1, TRUSTED_PROXY_HOPS ghi đè, không cấu hình = 0', () => {
      expect(trustedProxyHops({ VERCEL: '1' })).toBe(1);
      expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: '2' })).toBe(2);
      expect(trustedProxyHops({ VERCEL: '1', TRUSTED_PROXY_HOPS: '0' })).toBe(0);
      expect(trustedProxyHops({})).toBe(0);
    });
  });
});
