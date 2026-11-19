import { z } from 'zod';
import { jsonByteSize, KB } from '@/lib/security/requestGuard';

/** Giới hạn cứng cho payload bản build (chống nhồi JSONB khổng lồ vào PostgreSQL) */
export const MAX_BUILD_PAYLOAD_BYTES = 50 * KB;
export const MAX_BUILD_TITLE = 100;
export const MAX_BUILD_DESCRIPTION = 500;
const MAX_CONFIG_KEYS = 64;

export const buildConfigSchema = z
  .record(z.string().max(64), z.unknown())
  .refine((cfg) => Object.keys(cfg).length <= MAX_CONFIG_KEYS, {
    message: 'Cấu hình bàn phím có quá nhiều trường.',
  })
  .refine((cfg) => typeof cfg.layout === 'string' && typeof cfg.plateMaterial === 'string', {
    message: 'Cấu hình bàn phím 3D không hợp lệ',
  })
  .refine((cfg) => jsonByteSize(cfg) <= MAX_BUILD_PAYLOAD_BYTES, {
    message: 'Cấu hình bàn phím vượt quá giới hạn 50KB.',
  });

const titleSchema = z
  .string()
  .trim()
  .min(2, 'Tiêu đề bản build phải từ 2 ký tự trở lên')
  .max(MAX_BUILD_TITLE, `Tiêu đề không được vượt quá ${MAX_BUILD_TITLE} ký tự`);

const descriptionSchema = z
  .string()
  .max(MAX_BUILD_DESCRIPTION, `Mô tả không được vượt quá ${MAX_BUILD_DESCRIPTION} ký tự`);

export const createBuildBodySchema = z.object({
  title: titleSchema,
  description: descriptionSchema.optional(),
  config: buildConfigSchema,
  isPublic: z.boolean().optional().default(true),
});

/** PATCH: mọi trường đều tuỳ chọn nhưng phải có ít nhất một trường; trường lạ bị từ chối */
export const updateBuildBodySchema = z
  .strictObject({
    title: titleSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    config: buildConfigSchema.optional(),
    isPublic: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Không có thay đổi nào để cập nhật.' });

export const forkBuildBodySchema = z.object({ title: titleSchema.optional() });

/** Slug hợp lệ do `slugify` sinh ra: chữ thường, số, gạch ngang */
export const SLUG_PATTERN = /^[a-z0-9-]{1,140}$/;
