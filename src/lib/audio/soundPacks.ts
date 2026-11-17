import { z } from 'zod';

/**
 * Gói âm thanh thật: các đoạn tiếng gõ cắt từ bản thu bàn phím thật (scripts/sounds/make-pack.ts).
 * Nằm ở public/sounds/<id>/ (không đưa lên git), web đọc danh sách ở public/sounds/index.json.
 */

export const SOUND_ROOT = '/sounds';

export const soundCategorySchema = z.enum(['alpha', 'space', 'up']);
export type SoundCategory = z.infer<typeof soundCategorySchema>;

export const packSummarySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Tên hiển thị, ví dụ "AULA F75" */
  name: z.string().min(1),
  /** Switch dùng trong bản thu */
  switch: z.string().min(1),
  /** Tạp âm nền của bản thu (trung vị nhiễu trước mỗi tiếng gõ / đỉnh tiếng gõ). Cao hơn NOISY_PACK thì nên nghe kiểm tra lại */
  noise: z.number().min(0).optional(),
});

export const NOISY_PACK = 0.02;
export type PackSummary = z.infer<typeof packSummarySchema>;

export const packManifestSchema = packSummarySchema.extend({
  sourceUrl: z.string().optional(),
  clips: z.object({
    alpha: z.array(z.string()).min(1),
    space: z.array(z.string()),
    up: z.array(z.string()),
  }),
});
export type PackManifest = z.infer<typeof packManifestSchema>;

export const packIndexSchema = z.array(packSummarySchema);

/** Phím có stabilizer: dùng tiếng phím cách (trầm, có tiếng stab) nếu gói có */
const STABILIZED = new Set(['Space', 'Enter', 'NumpadEnter', 'Backspace', 'ShiftLeft', 'ShiftRight', 'NumpadAdd', 'Numpad0']);

export interface SamplePlan {
  category: SoundCategory;
  /** Tốc độ phát: phím cách giữ nguyên, Enter/Backspace/Shift ngắn hơn phím cách nên cao hơn một chút */
  rate: number;
}

export const planForKey = (code: string, available: Record<SoundCategory, number>): SamplePlan => {
  if (STABILIZED.has(code) && available.space > 0) return { category: 'space', rate: code === 'Space' ? 1 : 1.06 };
  return { category: 'alpha', rate: 1 };
};

/** Chọn ngẫu nhiên một biến thể, tránh lặp lại đúng biến thể vừa phát (nghe như súng máy). */
export const pickVariant = (count: number, last: number, random: () => number = Math.random): number => {
  if (count <= 1) return 0;
  if (last < 0 || last >= count) return Math.floor(random() * count);
  const pick = Math.floor(random() * (count - 1));
  return pick >= last ? pick + 1 : pick;
};
