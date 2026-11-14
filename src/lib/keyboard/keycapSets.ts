/**
 * Bộ màu keycap: mỗi bộ có 3 tông — phím chữ (alpha), phím chức năng (modifier) và phím nhấn
 * (Esc, Enter). Màu ký tự in trên phím tự suy ra theo độ sáng nền để luôn đọc được.
 */

export interface KeycapSet {
  id: string;
  name: string;
  alpha: string;
  modifier: string;
  accent: string;
}

export const KEYCAP_SETS: KeycapSet[] = [
  { id: 'red-two-tone', name: 'Đỏ hai tông', alpha: '#7c1521', modifier: '#c41f2d', accent: '#efebe3' },
  { id: 'graphite', name: 'Than chì', alpha: '#2c2d31', modifier: '#4a4c52', accent: '#d9a441' },
  { id: 'retro-cream', name: 'Kem cổ điển', alpha: '#e8e1cf', modifier: '#a59d8b', accent: '#c4472f' },
  { id: 'navy', name: 'Xanh navy', alpha: '#1e2b46', modifier: '#33497a', accent: '#e9e4d6' },
  { id: 'white-grey', name: 'Trắng xám', alpha: '#ebebe8', modifier: '#9b9ea4', accent: '#2c2c2f' },
  { id: 'moss', name: 'Rêu', alpha: '#3e4939', modifier: '#6a7a5b', accent: '#e3d7b6' },
];

export interface KeycapColors {
  keycapColor: string;
  keycapModifierColor: string;
  keycapAccentColor: string;
}

/** Tìm bộ keycap khớp đúng cả 3 màu hiện tại (không phân biệt hoa thường). */
export const findKeycapSet = (colors: KeycapColors): KeycapSet | undefined => {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return KEYCAP_SETS.find(
    (set) =>
      same(set.alpha, colors.keycapColor) &&
      same(set.modifier, colors.keycapModifierColor) &&
      same(set.accent, colors.keycapAccentColor)
  );
};

/** Độ sáng tương đối WCAG của một màu HEX (#rgb hoặc #rrggbb), 0–1. */
export const relativeLuminance = (hex: string): number => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value) || full.length !== 6) return 0;
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
};

/** Màu ký tự in trên phím: chữ trắng ngà trên nền tối, chữ than trên nền sáng. */
export const legendColorFor = (capHex: string): string =>
  relativeLuminance(capHex) > 0.35 ? '#26262a' : '#f1eee8';
