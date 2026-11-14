import type { Transition, Variants } from 'framer-motion';

/**
 * Motion language dùng chung cho toàn bộ UI KeyCraft 3D.
 * Mọi component lấy spring/variant từ đây để chuyển động nhất quán.
 */

/** Đường cong "expo out": bật nhanh rồi hãm êm — chữ ký chuyển động cinematic. */
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Bộ lò xo chuẩn: snappy cho nút bấm, smooth cho panel, gentle cho nền & overlay. */
export const SPRINGS = {
  snappy: { type: 'spring', stiffness: 420, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 },
  gentle: { type: 'spring', stiffness: 120, damping: 20, mass: 1 },
} as const satisfies Record<string, Transition>;

/** Tách câu thành từng từ (bỏ khoảng trắng thừa) để làm kinetic typography. */
export const splitWords = (text: string): string[] =>
  text.trim().split(/\s+/).filter((word) => word.length > 0);

/** Độ trễ (giây) của phần tử thứ `index` trong một dãy stagger. */
export const getStaggerDelay = (index: number, stagger = 0.06, base = 0): number =>
  Number((base + Math.max(0, index) * stagger).toFixed(3));

/** Variant cha: chỉ điều phối nhịp xuất hiện lần lượt của các con. */
export const createStaggerContainer = (stagger = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

/** Từng từ trồi lên từ dưới mặt nạ, từ mờ nhoè thành sắc nét. */
export const kineticWord: Variants = {
  hidden: { y: '110%', opacity: 0, rotate: 4, filter: 'blur(12px)' },
  visible: {
    y: '0%',
    opacity: 1,
    rotate: 0,
    filter: 'blur(0px)',
    transition: {
      ...SPRINGS.smooth,
      opacity: { duration: 0.5, ease: EASE_OUT_EXPO },
      filter: { duration: 0.7, ease: EASE_OUT_EXPO },
    },
  },
};

/** Khối nội dung nổi lên nhẹ kèm khử nhoè — dùng cho badge, đoạn văn, thẻ bento. */
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.75, ease: EASE_OUT_EXPO },
  },
};
