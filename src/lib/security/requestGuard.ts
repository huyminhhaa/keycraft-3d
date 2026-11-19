/**
 * Cổng đọc request an toàn: giới hạn kích thước body (chống DoS bộ nhớ / cạn quota)
 * và chuẩn hoá IP client làm khoá rate limit.
 */

export const KB = 1024;

export type JsonBodyResult =
  | { ok: true; data: unknown; bytes: number }
  | { ok: false; status: 400 | 413; error: string };

function tooLarge(maxBytes: number): JsonBodyResult {
  return {
    ok: false,
    status: 413,
    error: `Dữ liệu gửi lên vượt quá giới hạn ${Math.round(maxBytes / KB)}KB.`,
  };
}

/**
 * Đọc body JSON nhưng dừng ngay khi vượt `maxBytes` (không nạp hết body khổng lồ vào RAM).
 * - Chặn sớm nếu header Content-Length đã khai báo lớn hơn giới hạn
 * - Đếm byte thật khi stream (Content-Length có thể bị giả mạo hoặc vắng mặt)
 */
export async function readJsonBody(req: Request, maxBytes: number): Promise<JsonBodyResult> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return tooLarge(maxBytes);
  }

  if (!req.body) {
    return { ok: false, status: 400, error: 'Thiếu nội dung yêu cầu.' };
  }

  const reader = req.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return tooLarge(maxBytes);
    }
    chunks.push(Buffer.from(value));
  }

  try {
    const text = Buffer.concat(chunks).toString('utf8');
    return { ok: true, data: JSON.parse(text) as unknown, bytes: total };
  } catch {
    return { ok: false, status: 400, error: 'Dữ liệu JSON không hợp lệ.' };
  }
}

/** Đo kích thước JSON (byte UTF-8) của một giá trị */
export function jsonByteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
}

const IP_PATTERN = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * Số proxy đáng tin đứng trước app (mỗi proxy nối thêm 1 IP vào cuối `x-forwarded-for`).
 * - Vercel: 1 (nền tảng ghi đè header, client không giả được)
 * - Docker Compose: 1 (nginx trong `docker/nginx.conf` ghi đè bằng `$remote_addr`)
 * - Không cấu hình: 0 = không có proxy -> header do CLIENT tự đặt, không được tin.
 */
export function trustedProxyHops(
  env: Record<string, string | undefined> = process.env
): number {
  const configured = Number(env.TRUSTED_PROXY_HOPS);
  if (Number.isInteger(configured) && configured >= 0) return configured;
  return env.VERCEL === '1' ? 1 : 0;
}

/**
 * IP client dùng làm khoá rate limit / khoá IP.
 *
 * Lấy phần tử thứ N tính từ PHẢI của `x-forwarded-for` (N = số proxy đáng tin): phần bên trái
 * do client tự ghi được, phần bên phải do proxy của ta nối vào nên mới đáng tin. Lấy phần tử đầu
 * tiên (cách cũ) cho phép kẻ tấn công gửi `X-Forwarded-For: <IP ngẫu nhiên>` mỗi request để
 * được một hạn mức rate limit mới tinh.
 *
 * Không có proxy đáng tin -> `unknown` (mọi request chung một bucket: chặt hơn, nhưng không lách được).
 * Giá trị lạ (quá dài, ký tự lạ) cũng thành `unknown` để không thể nhồi khoá Redis tuỳ ý.
 */
export function getClientIp(req: Request, hops: number = trustedProxyHops()): string {
  if (hops < 1) return 'unknown';

  const chain = (req.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const candidate =
    chain.length >= hops ? chain[chain.length - hops] : req.headers.get('x-real-ip')?.trim() ?? '';

  return IP_PATTERN.test(candidate) ? candidate : 'unknown';
}
