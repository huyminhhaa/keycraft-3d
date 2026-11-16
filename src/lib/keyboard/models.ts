import { z } from 'zod';

/**
 * Danh mục mẫu bàn phím hiện trên web.
 *
 * Thêm một mẫu mới (xem docs/theory/11-keyboard-model-library-glb.md):
 *   1. Chép file vào `public/models/<ten-mau>.glb`
 *   2. Thêm một dòng `{ id, name, source: 'glb', url, layout }` vào MODEL_ENTRIES bên dưới
 * Sai định dạng thì Zod báo lỗi rõ ràng ngay khi chạy `npm run dev`.
 */

const layoutSchema = z.enum(['65%', '75%', 'TKL']);

const baseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id chỉ gồm chữ thường, số và dấu gạch ngang'),
  name: z.string().min(1),
});

const proceduralSchema = baseSchema.extend({
  /** Dựng bằng code (keyboardGeometry.ts): đổi được layout, chất liệu, màu */
  source: z.literal('procedural'),
});

const glbSchema = baseSchema.extend({
  source: z.literal('glb'),
  /** Đường dẫn tính từ thư mục public/, ví dụ /models/aurora-80.glb */
  url: z.string().regex(/^\/models\/[\w.-]+\.glb$/, 'url phải có dạng /models/<ten-file>.glb'),
  /** Layout của file 3D: dùng để camera canh khung và chọn đúng kích thước */
  layout: layoutSchema,
  /**
   * true: vỏ, keycap, plate lấy màu/chất liệu đang chọn trên web.
   * false: giữ nguyên màu và texture trong file (nên dùng cho mô hình chụp/scan giống thật).
   */
  recolor: z.boolean().default(true),
  /** Nguồn và giấy phép của file 3D (bắt buộc ghi khi tải file của người khác) */
  credit: z.string().optional(),
});

export const modelEntrySchema = z.discriminatedUnion('source', [proceduralSchema, glbSchema]);

export const modelListSchema = z
  .array(modelEntrySchema)
  .min(1)
  .superRefine((entries, ctx) => {
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
      if (seen.has(entry.id)) ctx.addIssue({ code: 'custom', message: `id "${entry.id}" bị trùng`, path: [index, 'id'] });
      seen.add(entry.id);
    });
  });

export type KeyboardModelEntry = z.infer<typeof modelEntrySchema>;
export type GlbModelEntry = Extract<KeyboardModelEntry, { source: 'glb' }>;

/** Mẫu mặc định: luôn có, không cần file, dùng làm dự phòng khi file .glb lỗi */
export const DEFAULT_MODEL_ID = 'keycraft';

const MODEL_ENTRIES: z.input<typeof modelListSchema> = [
  { id: DEFAULT_MODEL_ID, name: 'KeyCraft (dựng bằng code)', source: 'procedural' },
  {
    id: 'keycraft-starter',
    name: 'KeyCraft TKL (file .glb mẫu)',
    source: 'glb',
    url: '/models/keycraft-starter.glb',
    layout: 'TKL',
    recolor: true,
    credit: 'Xuất từ chính mẫu dựng bằng code của dự án',
  },
];

export const KEYBOARD_MODELS: KeyboardModelEntry[] = modelListSchema.parse(MODEL_ENTRIES);

export const getModelEntry = (id: string): KeyboardModelEntry =>
  KEYBOARD_MODELS.find((entry) => entry.id === id) ?? KEYBOARD_MODELS[0];
