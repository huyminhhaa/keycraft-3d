/**
 * Cổng chống "dính tiếng": bỏ các lần nhấn đến quá sát nhau.
 *  - Cùng một phím trong `sameKeyMs` (rung tiếp điểm, sự kiện lặp): chỉ phát lần đầu.
 *  - Phím bất kỳ trong `anyKeyMs` (bộ gõ tiếng Việt Unikey/EVKey bắn Backspace + ký tự mới trong ~1ms):
 *    hai tiếng chồng nhau gần như cùng lúc nghe thành một tiếng nổ to, nên chỉ giữ tiếng đầu.
 * Người gõ thật nhanh cũng cách nhau ≥ 30ms giữa hai phím, nên không mất tiếng gõ thật.
 */
export interface PressGateOptions {
  sameKeyMs: number;
  anyKeyMs: number;
}

export const DEFAULT_PRESS_GATE: PressGateOptions = { sameKeyMs: 22, anyKeyMs: 12 };

export type PressGate = (code: string, nowMs: number) => boolean;

export const createPressGate = (options: PressGateOptions = DEFAULT_PRESS_GATE): PressGate => {
  const lastByCode = new Map<string, number>();
  let lastAny = Number.NEGATIVE_INFINITY;
  return (code, nowMs) => {
    const lastSame = lastByCode.get(code) ?? Number.NEGATIVE_INFINITY;
    if (nowMs - lastSame < options.sameKeyMs) return false;
    if (nowMs - lastAny < options.anyKeyMs) return false;
    lastByCode.set(code, nowMs);
    lastAny = nowMs;
    // Giữ map gọn: chỉ cần nhớ các phím vừa gõ gần đây
    if (lastByCode.size > 64) {
      lastByCode.forEach((at, key) => {
        if (nowMs - at > 1000) lastByCode.delete(key);
      });
    }
    return true;
  };
};
