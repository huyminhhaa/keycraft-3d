import { describe, it, expect } from 'vitest';
import { leadingZeroBits, powDigest, POW_DIFFICULTY, solvePow, verifyPow } from './powCaptcha';

describe('CAPTCHA Proof-of-Work (src/lib/auth/powCaptcha.ts)', () => {
  it('đếm đúng số bit 0 ở đầu', () => {
    expect(leadingZeroBits(new Uint8Array([0x00, 0x00, 0xff]))).toBe(16);
    expect(leadingZeroBits(new Uint8Array([0x00, 0x01]))).toBe(15);
    expect(leadingZeroBits(new Uint8Array([0x80]))).toBe(0);
    expect(leadingZeroBits(new Uint8Array([0x00, 0x00]))).toBe(16);
  });

  it('lời giải tìm được thật sự thoả độ khó, và server kiểm bằng 1 lần băm', async () => {
    const id = 'test-challenge.123';
    const answer = await solvePow(id, { difficulty: 12 });
    expect(leadingZeroBits(powDigest(id, answer))).toBeGreaterThanOrEqual(12);
    expect(verifyPow(id, answer, 12)).toBe(true);
  });

  it('lời giải của đề này không dùng được cho đề khác', async () => {
    const answer = await solvePow('de-A.1', { difficulty: 12 });
    // Xác suất trùng hợp 2^-12: chọn đề B sao cho chắc chắn không thoả
    const other = Array.from({ length: 50 }, (_, i) => `de-B-${i}.1`).find((id) => !verifyPow(id, answer, 12));
    expect(other).toBeDefined();
  });

  it('từ chối lời giải không phải số nguyên không âm', () => {
    expect(verifyPow('x', '-1')).toBe(false);
    expect(verifyPow('x', '1e5')).toBe(false);
    expect(verifyPow('x', '')).toBe(false);
    expect(verifyPow('x', '9'.repeat(20))).toBe(false);
  });

  it('huỷ được giữa chừng (đổi đề / đóng form)', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(solvePow('x', { difficulty: 30, signal: controller.signal })).rejects.toThrow();
  });

  it('báo tiến độ tăng dần, kết thúc ở 1', async () => {
    const ratios: number[] = [];
    await solvePow('progress.1', { difficulty: 14, batch: 500, onProgress: (r) => ratios.push(r) });
    expect(ratios.at(-1)).toBe(1);
    expect(ratios.every((r, i) => i === 0 || r >= ratios[i - 1])).toBe(true);
  });

  it('độ khó mặc định đủ đắt cho bot nhưng nhẹ cho người: 2^17 ≈ 131 nghìn lần băm', () => {
    expect(POW_DIFFICULTY).toBe(17);
  });
});
