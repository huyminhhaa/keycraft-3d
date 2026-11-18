import { KEYBOARD_BUILDS, buildBrand, findBuild, type KeyboardBuild } from '@/lib/keyboard/builds';

/** Số liệu trang chủ: tính từ thư viện build thật, không ghi tay (thêm mẫu là tự đúng) */
export const LANDING_STATS = {
  builds: KEYBOARD_BUILDS.length,
  // "WOBKEY" và "Wobkey" là một hãng
  brands: new Set(KEYBOARD_BUILDS.map((b) => buildBrand(b).toLowerCase())).size,
  layers: 7,
} as const;

/** Mẫu nghe thử ở trang chủ: mỗi mẫu một chất âm khác nhau (vỏ nhựa/nhôm/PC, plate PC/FR4/POM/nhôm) */
export const FEATURED_BUILD_IDS = [
  'aula-f75-reaper',
  'leobog-hi75c-pro',
  'gravastar-mercury-k1',
  'nuphy-halo75-v2',
  'mode-envoy-pc',
  'wobkey-crush80-pro',
] as const;

export const FEATURED_BUILDS: KeyboardBuild[] = FEATURED_BUILD_IDS.map((id) => findBuild(id)).filter(
  (b): b is KeyboardBuild => Boolean(b)
);
