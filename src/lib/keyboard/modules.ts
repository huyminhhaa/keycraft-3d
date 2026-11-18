import { z } from 'zod';
import type { ShellStyle } from '@/types/keyboard';
import type { LayoutDefinition } from './layouts';
import { knobKeyCode, topRowModuleCodes } from './layouts';

/**
 * Module phần cứng riêng của từng mẫu phím thật, đặt trong lưới phím (đơn vị u):
 *  - knob: núm xoay tròn (khía, phẳng, hoặc gắn hông vỏ)
 *  - roller: con lăn trụ nằm ngang có khía, nằm trong hốc khuyết
 *  - screen: màn hình TFT/LCD (mini 1×2u, medium 2×1u, large như AULA L99)
 *  - lightbar: dải/chấm đèn báo, logo phát sáng
 *  - badge: tấm logo kim loại / đá marble
 *  - blank: ô trống (blocker)
 * Vị trí: `replaces` (thay chỗ các phím đó: không vẽ keycap/switch, plate không khoét lỗ)
 * hoặc `at` (ô trống trong lưới hay trên viền vỏ, toạ độ góc trên-trái).
 */

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const rectSchema = z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() });
export type ModuleRect = z.infer<typeof rectSchema>;

const placement = {
  replaces: z.array(z.string()).min(1).optional(),
  at: rectSchema.optional(),
};

export const moduleSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('knob'),
      ...placement,
      /** knurled: núm nhôm khía; flat: đĩa thấp phẳng (MCHOSE G75); side: trụ khía gắn hông vỏ (Nova75) */
      style: z.enum(['knurled', 'flat', 'side']).default('knurled'),
      color: hex.optional(),
      /** Vòng viền nhấn màu quanh đỉnh (Hi75C bạc, QK75 cam) */
      ring: hex.optional(),
      /** Mặt đỉnh khác màu thân (Hi75C mặt đen in logo) */
      cap: hex.optional(),
    }),
    z.object({
      kind: z.literal('roller'),
      ...placement,
      color: hex.optional(),
      /** Đèn báo nhỏ cạnh con lăn (Weikav Nut75) */
      light: hex.optional(),
    }),
    z.object({
      kind: z.literal('screen'),
      ...placement,
      size: z.enum(['mini', 'medium', 'large']),
      ui: z.enum(['clock', 'calculator', 'status', 'off']),
    }),
    z.object({
      kind: z.literal('lightbar'),
      ...placement,
      color: z.union([hex, z.literal('rainbow')]),
      shape: z.enum(['bar', 'dot']).default('bar'),
    }),
    z.object({
      kind: z.literal('badge'),
      ...placement,
      finish: z.enum(['gold', 'silver', 'marble', 'black']),
    }),
    /** Ô trống (blocker) — layout 65% kiểu Envoy/Neo65 bỏ phím Ctrl phải để chừa khe trước cụm mũi tên */
    z.object({ kind: z.literal('blank'), ...placement }),
  ])
  .refine((m) => Boolean(m.replaces) !== Boolean(m.at), { message: 'Module cần đúng một trong hai: replaces hoặc at' });

export type KeyboardModule = z.infer<typeof moduleSchema>;
export type ModuleKind = KeyboardModule['kind'];

/** Module đã đặt chỗ: kèm khung trong lưới phím (u) và gắn trên plate hay trên mặt viền vỏ */
export type PlacedModule = KeyboardModule & {
  rect: ModuleRect;
  mount: 'plate' | 'case';
  /** Màn hình lấy từ layout (L99) chứ không do build khai báo */
  fromLayout?: boolean;
};

/** Khung bao các phím bị thay chỗ; thiếu phím nào trong layout thì trả null (module không áp dụng được) */
export const rectOfKeys = (layout: LayoutDefinition, codes: string[]): ModuleRect | null => {
  const keys = codes.map((code) => layout.keys.find((key) => key.code === code));
  if (keys.some((key) => !key)) return null;
  const placed = keys as NonNullable<(typeof keys)[number]>[];
  const x = Math.min(...placed.map((k) => k.x));
  const y = Math.min(...placed.map((k) => k.y));
  const right = Math.max(...placed.map((k) => k.x + k.w));
  const bottom = Math.max(...placed.map((k) => k.y + 1));
  return { x, y, w: right - x, h: bottom - y };
};

/** Khung nằm ngoài vùng phím (trên viền vỏ) thì module gắn trên mặt vỏ, không phải trên plate */
const mountOf = (rect: ModuleRect, layout: LayoutDefinition): PlacedModule['mount'] => {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return cx < 0 || cx > layout.width || cy < 0 || cy > layout.depth ? 'case' : 'plate';
};

export interface ModuleSource {
  layout: LayoutDefinition;
  /** Module của build (đúng layout của build); undefined = mẫu tự phối */
  modules?: KeyboardModule[];
  /** Mẫu tự phối / bản build đã lưu trước khi có modules: núm góc phải, LCD 2U kiểu Zoom75 */
  legacyKnob?: boolean;
  shellStyle?: ShellStyle;
}

/** Danh sách module cuối cùng của mô hình: build (hoặc kiểu cũ) + màn hình cố định của layout */
export const resolveModules = ({ layout, modules, legacyKnob, shellStyle }: ModuleSource): PlacedModule[] => {
  const declared: KeyboardModule[] =
    modules ??
    [
      ...(legacyKnob && knobKeyCode(layout.id)
        ? [{ kind: 'knob', replaces: [knobKeyCode(layout.id) as string], style: 'knurled' } as KeyboardModule]
        : []),
      ...(shellStyle === 'lcd-75'
        ? [{ kind: 'screen', replaces: topRowModuleCodes(layout.id, 2), size: 'medium', ui: 'clock' } as KeyboardModule]
        : []),
    ];
  const placed: PlacedModule[] = [];
  declared.forEach((module) => {
    const rect = module.replaces ? rectOfKeys(layout, module.replaces) : (module.at ?? null);
    if (rect) placed.push({ ...module, rect, mount: mountOf(rect, layout) });
  });
  (layout.displays ?? []).forEach((rect) =>
    placed.push({ kind: 'screen', size: 'large', ui: 'calculator', at: rect, rect, mount: 'plate', fromLayout: true })
  );
  return placed;
};

/** Mã phím bị module thay chỗ (bỏ khỏi keycap/switch/lỗ plate) */
export const replacedKeyCodes = (modules: PlacedModule[]): Set<string> =>
  new Set(modules.flatMap((module) => module.replaces ?? []));

/** Tâm và kích thước (đơn vị thế giới) của khung module, cùng hệ toạ độ với keyCenter() */
export const moduleFootprint = (
  rect: ModuleRect,
  layoutWidthU: number,
  layoutDepthU: number,
  unit: number
): { x: number; z: number; width: number; depth: number } => ({
  x: (rect.x + rect.w / 2 - layoutWidthU / 2) * unit,
  z: (rect.y + rect.h / 2 - layoutDepthU / 2) * unit,
  width: rect.w * unit,
  depth: rect.h * unit,
});
