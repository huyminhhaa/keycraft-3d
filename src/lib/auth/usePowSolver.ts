'use client';

import { useEffect, useState } from 'react';
import { solvePow } from './powCaptcha';
import type { CaptchaChallenge } from './bruteForce';

export interface PowSolverState {
  /** Lời giải của ĐÚNG đề hiện tại (null khi đang giải / chưa có đề) */
  answer: string | null;
  /** Tiến độ 0..1 của đề hiện tại */
  progress: number;
}

/**
 * Tự giải đề Proof-of-Work ngay khi đề xuất hiện (chạy nền, nhường luồng chính từng lượt).
 * Kết quả gắn với challengeId nên đổi đề là kết quả cũ tự vô hiệu, không cần reset state đồng bộ.
 */
export function usePowSolver(challenge: CaptchaChallenge | null): PowSolverState {
  const [solved, setSolved] = useState<{ id: string; answer: string } | null>(null);
  const [progress, setProgress] = useState<{ id: string; ratio: number } | null>(null);

  useEffect(() => {
    if (!challenge) return;
    const controller = new AbortController();
    const id = challenge.challengeId;

    solvePow(id, {
      difficulty: challenge.difficulty,
      signal: controller.signal,
      onProgress: (ratio) => setProgress({ id, ratio }),
    })
      .then((answer) => setSolved({ id, answer }))
      .catch(() => {
        // Bị huỷ do đổi đề / đóng form
      });

    return () => controller.abort();
  }, [challenge]);

  const currentId = challenge?.challengeId;
  return {
    answer: solved && solved.id === currentId ? solved.answer : null,
    progress: progress && progress.id === currentId ? progress.ratio : 0,
  };
}
