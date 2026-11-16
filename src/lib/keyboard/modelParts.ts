import type { KeyRole } from './layouts';

/**
 * Quy ước đặt tên bộ phận trong file 3D (.glb) — đặt tên object trong Blender đúng như sau
 * thì web tự nhận ra bộ phận để đổi màu, tách lớp và nhấn phím:
 *
 *   TopCase, BottomCase, Weight, PCB, Foam, Plate, Switches, Keycaps
 *   Keycap_<KeyboardEvent.code>_<alpha|modifier|accent>   ví dụ: Keycap_KeyA_alpha, Keycap_Space_modifier
 *   Legend (ký tự in trên phím), Detail_<bất kỳ> (chân cao su, LED, ốc vít…)
 *
 * Object không theo quy ước thì lấy theo object cha gần nhất có tên hợp lệ.
 */
export type ModelPart =
  | 'topCase'
  | 'bottomCase'
  | 'weight'
  | 'pcb'
  | 'foam'
  | 'plate'
  | 'switch'
  | 'keycap'
  | 'legend'
  | 'detail';

/** Lớp trong exploded view (khớp với `calculateLayerPositions`) */
export type ModelLayer = 'bottomCase' | 'pcb' | 'foam' | 'plate' | 'switches' | 'keycaps' | 'topCase';

export interface ParsedPart {
  part: ModelPart;
  /** Chỉ có ở keycap: mã phím theo KeyboardEvent.code để gõ phím thật thì phím 3D nhấn theo */
  keyCode?: string;
  /** Chỉ có ở keycap: nhóm màu */
  role?: KeyRole;
}

const PREFIXES: [RegExp, ModelPart][] = [
  [/^topcase/i, 'topCase'],
  [/^bottomcase/i, 'bottomCase'],
  [/^weight/i, 'weight'],
  [/^pcb/i, 'pcb'],
  [/^foam/i, 'foam'],
  [/^plate/i, 'plate'],
  [/^switch/i, 'switch'],
  [/^keycap/i, 'keycap'],
  [/^legend/i, 'legend'],
  [/^detail/i, 'detail'],
];

/**
 * Blender tự thêm đuôi ".001" khi trùng tên, và GLTFLoader xoá dấu "." khỏi tên node,
 * nên "Keycap_KeyA_alpha.001" về tới web thành "Keycap_KeyA_alpha001": bỏ số thừa ở cuối role.
 */
const KEYCAP_NAME = /^keycap_([a-z0-9]+)_(alpha|modifier|accent)\d*$/i;

export const parsePartName = (name: string): ParsedPart | null => {
  const match = PREFIXES.find(([pattern]) => pattern.test(name));
  if (!match) return null;
  const part = match[1];
  if (part !== 'keycap') return { part };
  const keycap = KEYCAP_NAME.exec(name);
  if (!keycap) return { part };
  return { part, keyCode: keycap[1], role: keycap[2].toLowerCase() as KeyRole };
};

/** Bộ phận nào nằm ở lớp nào khi tách lớp. Legend/Detail đi theo object cha nên không có lớp riêng. */
export const PART_LAYER: Partial<Record<ModelPart, ModelLayer>> = {
  topCase: 'topCase',
  bottomCase: 'bottomCase',
  weight: 'bottomCase',
  pcb: 'pcb',
  foam: 'foam',
  plate: 'plate',
  switch: 'switches',
  keycap: 'keycaps',
};

interface NamedNode {
  name: string;
  parent: NamedNode | null;
}

/** Bộ phận của một node: chính tên nó, nếu không khớp thì lấy theo cha gần nhất (dừng ở `root`). */
export const resolvePart = (node: NamedNode, root: NamedNode | null = null): ParsedPart | null => {
  for (let current: NamedNode | null = node; current && current !== root; current = current.parent) {
    const parsed = parsePartName(current.name);
    if (parsed) return parsed;
  }
  return null;
};

/** Node là "gốc lớp" khi tên nó là một bộ phận có lớp và không cha nào phía trên là bộ phận. */
export const isLayerRoot = (node: NamedNode, root: NamedNode | null = null): boolean => {
  const own = parsePartName(node.name);
  if (!own || !PART_LAYER[own.part]) return false;
  return !node.parent || node.parent === root || resolvePart(node.parent, root) === null;
};
