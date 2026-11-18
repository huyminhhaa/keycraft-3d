import type { KeyboardLayout } from '@/types/keyboard';

/**
 * Bố cục phím ANSI thật cho 3 layout. Đơn vị là "u" (1u = một phím chữ cái, 19.05mm).
 * Mỗi phím có `code` theo chuẩn KeyboardEvent.code để gõ phím thật thì phím 3D nhấn theo.
 */

export type KeyRole = 'alpha' | 'modifier' | 'accent';

export interface KeyDef {
  code: string;
  /** Ký hiệu in trên mặt phím: 1 dòng, hoặc 2 dòng [trên, dưới] */
  legend: string | [string, string];
  /** Bề rộng (u) */
  w: number;
  role: KeyRole;
}

export interface Gap {
  gap: number;
}

type RowItem = KeyDef | Gap;

export interface PlacedKey extends KeyDef {
  /** Toạ độ góc trên-trái (u) */
  x: number;
  y: number;
  /** Hàng profile Cherry (1 = hàng số/F, 4 = hàng dưới cùng) để tạo độ cong keycap */
  profileRow: 1 | 2 | 3 | 4;
}

export interface LayoutDefinition {
  id: KeyboardLayout;
  /** Tổng bề rộng (u) */
  width: number;
  /** Tổng chiều sâu (u) */
  depth: number;
  keys: PlacedKey[];
}

const k = (code: string, legend: KeyDef['legend'], w = 1, role: KeyRole = 'alpha'): KeyDef => ({
  code,
  legend,
  w,
  role,
});
const m = (code: string, legend: KeyDef['legend'], w = 1): KeyDef => k(code, legend, w, 'modifier');
const gap = (u: number): Gap => ({ gap: u });

const isGap = (item: RowItem): item is Gap => 'gap' in item;

/* ----------------------------- Các hàng dùng chung ----------------------------- */

const NUMBER_ROW: KeyDef[] = [
  k('Backquote', ['~', '`']),
  k('Digit1', ['!', '1']),
  k('Digit2', ['@', '2']),
  k('Digit3', ['#', '3']),
  k('Digit4', ['$', '4']),
  k('Digit5', ['%', '5']),
  k('Digit6', ['^', '6']),
  k('Digit7', ['&', '7']),
  k('Digit8', ['*', '8']),
  k('Digit9', ['(', '9']),
  k('Digit0', [')', '0']),
  k('Minus', ['_', '-']),
  k('Equal', ['+', '=']),
  m('Backspace', 'Backspace', 2),
];

const QWERTY_ROW: KeyDef[] = [
  m('Tab', 'Tab', 1.5),
  ...'QWERTYUIOP'.split('').map((c) => k(`Key${c}`, c)),
  k('BracketLeft', ['{', '[']),
  k('BracketRight', ['}', ']']),
  k('Backslash', ['|', '\\'], 1.5),
];

const HOME_ROW: KeyDef[] = [
  m('CapsLock', 'Caps Lock', 1.75),
  ...'ASDFGHJKL'.split('').map((c) => k(`Key${c}`, c)),
  k('Semicolon', [':', ';']),
  k('Quote', ['"', "'"]),
  k('Enter', 'Enter', 2.25, 'accent'),
];

const SHIFT_ROW_ALPHAS: KeyDef[] = [
  ...'ZXCVBNM'.split('').map((c) => k(`Key${c}`, c)),
  k('Comma', ['<', ',']),
  k('Period', ['>', '.']),
  k('Slash', ['?', '/']),
];

const F_KEYS = (from: number, to: number, role: KeyRole): KeyDef[] =>
  Array.from({ length: to - from + 1 }, (_, i) => k(`F${from + i}`, `F${from + i}`, 1, role));

const ESC = k('Escape', 'Esc', 1, 'accent');
const ARROW_LEFT = m('ArrowLeft', '←');
const ARROW_DOWN = m('ArrowDown', '↓');
const ARROW_RIGHT = m('ArrowRight', '→');
const ARROW_UP = m('ArrowUp', '↑');

/* --------------------------------- Định nghĩa --------------------------------- */

type RowSpec = { y: number; profileRow: PlacedKey['profileRow']; items: RowItem[] };

const ROWS: Record<KeyboardLayout, RowSpec[]> = {
  TKL: [
    {
      y: 0,
      profileRow: 1,
      items: [
        ESC, gap(1), ...F_KEYS(1, 4, 'alpha'), gap(0.5), ...F_KEYS(5, 8, 'modifier'), gap(0.5),
        ...F_KEYS(9, 12, 'alpha'), gap(0.25),
        m('PrintScreen', 'Prt Sc'), m('ScrollLock', 'Scroll'), m('Pause', 'Pause'),
      ],
    },
    {
      y: 1.25,
      profileRow: 1,
      items: [...NUMBER_ROW, gap(0.25), m('Insert', 'Insert'), m('Home', 'Home'), m('PageUp', 'PgUp')],
    },
    {
      y: 2.25,
      profileRow: 2,
      items: [...QWERTY_ROW, gap(0.25), m('Delete', 'Delete'), m('End', 'End'), m('PageDown', 'PgDn')],
    },
    { y: 3.25, profileRow: 3, items: [...HOME_ROW] },
    {
      y: 4.25,
      profileRow: 4,
      items: [m('ShiftLeft', 'Shift', 2.25), ...SHIFT_ROW_ALPHAS, m('ShiftRight', 'Shift', 2.75), gap(1.25), ARROW_UP],
    },
    {
      y: 5.25,
      profileRow: 4,
      items: [
        m('ControlLeft', 'Ctrl', 1.25), m('MetaLeft', 'Win', 1.25), m('AltLeft', 'Alt', 1.25),
        k('Space', '', 6.25),
        m('AltRight', 'Alt', 1.25), m('Fn', 'Fn', 1.25), m('ContextMenu', 'Menu', 1.25), m('ControlRight', 'Ctrl', 1.25),
        gap(0.25), ARROW_LEFT, ARROW_DOWN, ARROW_RIGHT,
      ],
    },
  ],
  '75%': [
    {
      y: 0,
      profileRow: 1,
      items: [
        ESC, gap(0.25), ...F_KEYS(1, 4, 'alpha'), gap(0.25), ...F_KEYS(5, 8, 'modifier'), gap(0.25),
        ...F_KEYS(9, 12, 'alpha'), gap(0.25), m('PrintScreen', 'Prt Sc'), m('Delete', 'Del'),
      ],
    },
    { y: 1.25, profileRow: 1, items: [...NUMBER_ROW, m('Home', 'Home')] },
    { y: 2.25, profileRow: 2, items: [...QWERTY_ROW, m('PageUp', 'PgUp')] },
    { y: 3.25, profileRow: 3, items: [...HOME_ROW, m('PageDown', 'PgDn')] },
    {
      y: 4.25,
      profileRow: 4,
      items: [m('ShiftLeft', 'Shift', 2.25), ...SHIFT_ROW_ALPHAS, m('ShiftRight', 'Shift', 1.75), ARROW_UP, m('End', 'End')],
    },
    {
      y: 5.25,
      profileRow: 4,
      items: [
        m('ControlLeft', 'Ctrl', 1.25), m('MetaLeft', 'Win', 1.25), m('AltLeft', 'Alt', 1.25),
        k('Space', '', 6.25),
        m('AltRight', 'Alt'), m('Fn', 'Fn'), m('ControlRight', 'Ctrl'),
        ARROW_LEFT, ARROW_DOWN, ARROW_RIGHT,
      ],
    },
  ],
  // 96% (1800 thu gọn, kiểu AULA F99): cụm mũi tên nằm sát phím chữ, numpad bên phải.
  // Phím + và Enter của numpad ngoài đời cao 2u; ở đây vẽ 1u nên hai ô dưới chúng là PgUp/PgDn.
  '96%': [
    {
      y: 0,
      profileRow: 1,
      items: [
        ESC, gap(0.25), ...F_KEYS(1, 4, 'alpha'), gap(0.25), ...F_KEYS(5, 8, 'modifier'), gap(0.25),
        ...F_KEYS(9, 12, 'alpha'), gap(0.25),
        m('Insert', 'Ins'), m('Delete', 'Del'), m('Home', 'Home'), m('End', 'End'), m('PrintScreen', 'Prt Sc'),
      ],
    },
    {
      y: 1.25,
      profileRow: 1,
      items: [...NUMBER_ROW, m('NumLock', 'Num'), k('NumpadDivide', '/'), k('NumpadMultiply', '*'), k('NumpadSubtract', '-')],
    },
    {
      y: 2.25,
      profileRow: 2,
      items: [...QWERTY_ROW, k('Numpad7', '7'), k('Numpad8', '8'), k('Numpad9', '9'), m('NumpadAdd', '+')],
    },
    {
      y: 3.25,
      profileRow: 3,
      items: [...HOME_ROW, k('Numpad4', '4'), k('Numpad5', '5'), k('Numpad6', '6'), m('PageUp', 'PgUp')],
    },
    {
      y: 4.25,
      profileRow: 4,
      items: [
        m('ShiftLeft', 'Shift', 2.25), ...SHIFT_ROW_ALPHAS, m('ShiftRight', 'Shift', 1.75), ARROW_UP,
        k('Numpad1', '1'), k('Numpad2', '2'), k('Numpad3', '3'), k('NumpadEnter', 'Ent', 1, 'accent'),
      ],
    },
    {
      y: 5.25,
      profileRow: 4,
      items: [
        m('ControlLeft', 'Ctrl', 1.25), m('MetaLeft', 'Win', 1.25), m('AltLeft', 'Alt', 1.25),
        k('Space', '', 6.25),
        m('AltRight', 'Alt'), m('Fn', 'Fn'), m('ControlRight', 'Ctrl'),
        ARROW_LEFT, ARROW_DOWN, ARROW_RIGHT,
        k('Numpad0', '0'), k('NumpadDecimal', '.'), m('PageDown', 'PgDn'),
      ],
    },
  ],
  '65%': [
    { y: 0, profileRow: 1, items: [{ ...ESC, legend: ['~', 'Esc'] }, ...NUMBER_ROW.slice(1), m('Delete', 'Del')] },
    { y: 1, profileRow: 2, items: [...QWERTY_ROW, m('PageUp', 'PgUp')] },
    { y: 2, profileRow: 3, items: [...HOME_ROW, m('PageDown', 'PgDn')] },
    {
      y: 3,
      profileRow: 4,
      items: [m('ShiftLeft', 'Shift', 2.25), ...SHIFT_ROW_ALPHAS, m('ShiftRight', 'Shift', 1.75), ARROW_UP, m('End', 'End')],
    },
    {
      y: 4,
      profileRow: 4,
      items: [
        m('ControlLeft', 'Ctrl', 1.25), m('MetaLeft', 'Win', 1.25), m('AltLeft', 'Alt', 1.25),
        k('Space', '', 6.25),
        m('AltRight', 'Alt'), m('Fn', 'Fn'), m('ControlRight', 'Ctrl'),
        ARROW_LEFT, ARROW_DOWN, ARROW_RIGHT,
      ],
    },
  ],
};

const placeRows = (rows: RowSpec[]): PlacedKey[] =>
  rows.flatMap((row) => {
    let x = 0;
    const placed: PlacedKey[] = [];
    for (const item of row.items) {
      if (isGap(item)) {
        x += item.gap;
        continue;
      }
      placed.push({ ...item, x, y: row.y, profileRow: row.profileRow });
      x += item.w;
    }
    return placed;
  });

const buildLayout = (id: KeyboardLayout): LayoutDefinition => {
  const keys = placeRows(ROWS[id]);
  const width = Math.max(...keys.map((key) => key.x + key.w));
  const depth = Math.max(...keys.map((key) => key.y + 1));
  return { id, width, depth, keys };
};

export const LAYOUTS: Record<KeyboardLayout, LayoutDefinition> = {
  '65%': buildLayout('65%'),
  '75%': buildLayout('75%'),
  TKL: buildLayout('TKL'),
  '96%': buildLayout('96%'),
};

/**
 * Phím mà núm xoay thay chỗ: phím ngoài cùng bên phải của hàng trên cùng
 * (AULA F75, Leobog Hi75C Pro, Attack Shark X85, AULA F99 Pro đều đặt núm ở góc này).
 */
export const knobKeyCode = (id: KeyboardLayout): string | null => topRowModuleCodes(id, 1)[0] ?? null;

/**
 * `count` phím ngoài cùng bên phải hàng trên — chỗ đặt module: núm xoay (1 phím),
 * màn hình LCD 2U kiểu Meletrix Zoom75 (2 phím).
 */
export const topRowModuleCodes = (id: KeyboardLayout, count: number): string[] =>
  LAYOUTS[id].keys
    .filter((key) => key.y === 0)
    .sort((a, b) => b.x - a.x)
    .slice(0, count)
    .map((key) => key.code);

export const getLayout = (id: KeyboardLayout): LayoutDefinition => LAYOUTS[id];

/** Số phím của một layout (dùng cho nhãn giao diện). */
export const countKeys = (id: KeyboardLayout): number => LAYOUTS[id].keys.length;
