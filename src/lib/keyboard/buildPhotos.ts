import { createHash } from 'node:crypto';

/**
 * Ảnh thật chủ dự án thả vào `pics/<tên thư mục>/` → ảnh đại diện `public/builds/<build.id>.jpg`.
 * Script `npm run photos` (scripts/builds/sync-photos.ts) dùng bảng này; thư mục trống thì giữ ảnh cũ.
 */

/** Tên thư mục trong `pics/` của từng build (mẫu trùng tên máy thì thêm switch trong ngoặc) */
export const PHOTO_FOLDERS: Record<string, string> = {
  'attack-shark-x85': 'Attack Shark X85',
  'aula-f75-ice-vein': 'AULA F75 (Leobog Ice Vein)',
  'aula-f75-reaper': 'AULA F75 (Leobog Reaper)',
  'aula-f87-pro': 'AULA F87 Pro',
  'aula-f99-asura': 'AULA F99 Pro',
  'aula-l99': 'AULA L99',
  'aula-nova75-pro': 'AULA Nova75 Pro',
  'aula-s75-pro': 'AULA S75 Pro',
  'chilkey-nd75': 'Chilkey ND75',
  'cidoo-qk61-v2': 'CIDOO QK61 V2',
  'cidoo-qk75': 'CIDOO QK75',
  'gravastar-mercury-k1': 'GravaStar Mercury K1',
  'keychron-k2-he-se': 'Keychron K2 HE Special Edition',
  'keychron-q1-max': 'Keychron Q1 Max',
  'leobog-hi75-vertex': 'Leobog Hi75',
  'leobog-hi75c-pro': 'Leobog Hi75C Pro',
  'leobog-hi8-se': 'Leobog Hi8 SE',
  'leobog-hi98c-pro': 'Leobog Hi98C Pro',
  'mchose-g75-v2': 'MCHOSE G75 V2',
  'mchose-g87-v2': 'MCHOSE G87 V2',
  'zoom75-ee': 'Meletrix Zoom75',
  'mode-envoy-pc': 'Mode Envoy (Polycarbonate)',
  'monsgeek-m1w-v3': 'MonsGeek M1W V3',
  'nuphy-halo75-v2': 'NuPhy Halo75 V2',
  'pmo-aurora80': 'PMO Aurora 80',
  'pmo-wave75': 'PMO Wave 75',
  neo65: 'Qwertykeys Neo65',
  'riccks-rs8': 'Riccks RS8',
  'bridge75-plus': 'Shortcut Studio Bridge75 Plus',
  'lucky65-creamy-yellow': 'Weikav Lucky65 V2 (Akko Creamy Yellow U1)',
  'lucky65-husky': 'Weikav Lucky65 V2 (Kinetic Labs Husky)',
  'lucky65-turtle-silent': 'Weikav Lucky65 V2 (Kinetic Labs Turtle)',
  'weikav-nut108': 'Weikav Nut108',
  'weikav-nut65': 'Weikav Nut65',
  'weikav-nut75': 'Weikav Nut75',
  'weikav-nut87': 'Weikav Nut87',
  'weikav-stars75s': 'Weikav Stars75 S',
  'wobkey-crush80-pro': 'WOBKEY Crush 80 Reboot Pro',
  'wobkey-rainy75-pro': 'WOBKEY Rainy75 Pro',
  'wobkey-zen65': 'Wobkey Zen65',
  'wooting-80he': 'Wooting 80HE',
};

const IMAGE_EXT = /\.(png|jpe?g|webp|avif)$/i;
/** Ảnh được chủ dự án đặt tên ưu tiên làm ảnh đại diện */
const PREFERRED_NAME = /(^|[^a-z])(cover|main|dai-dien|daidien|hero)([^a-z]|$)/i;

export interface PhotoCandidate {
  file: string;
  width: number;
  height: number;
}

/**
 * Chọn ảnh đại diện trong một thư mục: ảnh đặt tên `cover`/`main`/`dai-dien` nếu có, không thì ảnh
 * nằm ngang (bàn phím toàn cảnh) có nhiều điểm ảnh nhất; ảnh dọc (thường là ảnh cận switch/đáy) xếp sau.
 * Không có ảnh nào → null (giữ nguyên ảnh cũ).
 */
export const pickPrimaryPhoto = (candidates: PhotoCandidate[]): PhotoCandidate | null => {
  const images = candidates.filter((c) => IMAGE_EXT.test(c.file) && c.width > 0 && c.height > 0);
  if (images.length === 0) return null;
  const preferred = images.find((c) => PREFERRED_NAME.test(c.file.replace(IMAGE_EXT, '')));
  if (preferred) return preferred;
  // Ảnh ngang/vuông (bàn phím toàn cảnh) luôn đứng trước ảnh dọc, sau đó mới so độ phân giải
  const landscape = (c: PhotoCandidate): number => (c.width >= c.height ? 1 : 0);
  return [...images].sort(
    (a, b) => landscape(b) - landscape(a) || b.width * b.height - a.width * a.height || a.file.localeCompare(b.file)
  )[0];
};

/** Mã phiên bản ảnh: 10 ký tự đầu SHA-1 của nội dung file (đổi ảnh là đổi mã) */
export const photoHash = (bytes: Uint8Array): string => createHash('sha1').update(bytes).digest('hex').slice(0, 10);

/** Kích thước đích: cạnh dài tối đa 1280px, giữ tỷ lệ, không phóng to ảnh nhỏ */
export const fitWithin = (width: number, height: number, max = 1280): { width: number; height: number } => {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};
