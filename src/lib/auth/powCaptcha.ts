import { sha256 } from '@noble/hashes/sha2.js';

/**
 * CAPTCHA Proof-of-Work (ý tưởng Hashcash / ALTCHA), dùng chung cho trình duyệt và server.
 *
 * Đề: chuỗi `challengeId` ngẫu nhiên do server ký. Lời giải: số `n` sao cho
 *     SHA-256("<challengeId>:<n>") có ít nhất `difficulty` bit 0 ở đầu.
 * Không có cách nào nhanh hơn thử lần lượt: trung bình 2^difficulty lần băm (17 bit ≈ 131 nghìn
 * lần ≈ 0,5 giây). Người dùng thật không phải gõ gì; còn bot thử mật khẩu phải trả đúng ngần ấy CPU
 * cho MỖI lượt — khác phép cộng cũ: máy giải tức thì, không tốn gì.
 * Server kiểm tra chỉ bằng 1 lần băm.
 */

export const POW_DIFFICULTY = 17;

const encoder = new TextEncoder();

/** Số bit 0 liên tiếp ở đầu mảng byte */
export function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

export function powDigest(challengeId: string, nonce: number | string): Uint8Array {
  return sha256(encoder.encode(`${challengeId}:${nonce}`));
}

/** Kiểm tra lời giải (server dùng) */
export function verifyPow(challengeId: string, nonce: string, difficulty: number = POW_DIFFICULTY): boolean {
  if (!/^\d{1,12}$/.test(nonce)) return false;
  return leadingZeroBits(powDigest(challengeId, nonce)) >= difficulty;
}

export interface SolveOptions {
  difficulty?: number;
  /** Huỷ khi người dùng đóng form / đổi đề */
  signal?: AbortSignal;
  /** Báo tiến độ 0..1 (ước lượng theo số lần thử kỳ vọng) */
  onProgress?: (ratio: number) => void;
  /** Số lần băm mỗi lượt trước khi nhường luồng chính cho giao diện */
  batch?: number;
}

/**
 * Tìm lời giải, chia nhỏ từng lượt để giao diện không bị đứng.
 * @throws DOMException 'AbortError' khi bị huỷ
 */
export async function solvePow(challengeId: string, options: SolveOptions = {}): Promise<string> {
  const difficulty = options.difficulty ?? POW_DIFFICULTY;
  const batch = options.batch ?? 4000;
  const expected = 2 ** difficulty;

  for (let start = 0; ; start += batch) {
    if (options.signal?.aborted) throw new DOMException('Đã huỷ', 'AbortError');
    for (let n = start; n < start + batch; n++) {
      if (leadingZeroBits(powDigest(challengeId, n)) >= difficulty) {
        options.onProgress?.(1);
        return String(n);
      }
    }
    options.onProgress?.(Math.min(0.95, (start + batch) / expected));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
