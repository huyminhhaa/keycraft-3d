import type { KeyboardLayout } from '@/types/keyboard';
import { hasFunctionRow, type KeyRole, type LayoutDefinition, type PlacedKey } from './layouts';
import { legendColorFor } from './keycapSets';

/**
 * Phối màu keycap theo ảnh thật. Ngoài 3 màu cơ bản theo vai trò phím (chữ / bổ trợ / nhấn) còn có:
 *  - rows: màu theo hàng từ hàng F xuống hàng dưới cùng (keycap gradient kiểu MonsGeek M1W, Mercury K1,
 *    hoặc phối từng hàng kiểu Weikav Nut108),
 *  - accentKeys / modifierKeys / alphaKeys: ép từng phím sang màu khác (Space nâu của Hi75C, mũi tên cam…),
 *  - finish: PBT nhám, nhựa trong (jelly) hoặc carbon forged; jellyAccent: chỉ phím nhấn là nhựa trong,
 *  - legend: màu chữ in riêng (chữ cam trên keycap đen…).
 */

export type KeycapFinish = 'pbt' | 'translucent' | 'forged-carbon';

export interface KeycapTheme {
  alpha: string;
  modifier: string;
  accent: string;
  rows?: string[];
  accentKeys?: string[];
  modifierKeys?: string[];
  alphaKeys?: string[];
  legend?: string;
  finish?: KeycapFinish;
  jellyAccent?: boolean;
}

export interface KeycapSlot {
  /** Khoá vật liệu dùng chung: các phím cùng slot dùng chung một material */
  id: string;
  color: string;
  legend: string;
  finish: KeycapFinish;
}

/** Thứ tự hàng nhìn thấy (0 = hàng F). Layout không có hàng F thì hàng số là 1 để gradient khớp ảnh. */
export const keycapRowIndex = (key: Pick<PlacedKey, 'y'>, layout: Pick<LayoutDefinition, 'id' | 'keys'>): number => {
  const rows = [...new Set(layout.keys.map((k) => k.y))].sort((a, b) => a - b);
  const index = rows.indexOf(key.y);
  return Math.max(0, index) + (hasFunctionRow(layout.id as KeyboardLayout) ? 0 : 1);
};

const overrideRole = (code: string, theme: KeycapTheme): KeyRole | null => {
  if (theme.accentKeys?.includes(code)) return 'accent';
  if (theme.modifierKeys?.includes(code)) return 'modifier';
  if (theme.alphaKeys?.includes(code)) return 'alpha';
  return null;
};

export const resolveKeycapSlot = (key: Pick<PlacedKey, 'code' | 'role'>, rowIndex: number, theme: KeycapTheme): KeycapSlot => {
  const forced = overrideRole(key.code, theme);
  const role = forced ?? key.role;
  const useRow = !forced && theme.rows && theme.rows.length > 0;
  const base = useRow ? `row${Math.min(rowIndex, (theme.rows as string[]).length - 1)}` : role;
  const color = useRow ? (theme.rows as string[])[Math.min(rowIndex, (theme.rows as string[]).length - 1)] : theme[role];
  const finish: KeycapFinish = theme.jellyAccent && role === 'accent' && !useRow ? 'translucent' : (theme.finish ?? 'pbt');
  return { id: `${base}:${finish}`, color, legend: theme.legend ?? legendColorFor(color), finish };
};
