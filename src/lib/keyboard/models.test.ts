import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_MODEL_ID, KEYBOARD_MODELS, getModelEntry, modelListSchema } from './models';

describe('danh mục mẫu bàn phím', () => {
  it('mẫu mặc định là mẫu dựng bằng code và đứng đầu danh sách', () => {
    expect(KEYBOARD_MODELS[0]).toMatchObject({ id: DEFAULT_MODEL_ID, source: 'procedural' });
  });

  it('mọi file .glb khai báo đều có thật trong public/', () => {
    KEYBOARD_MODELS.forEach((entry) => {
      if (entry.source === 'glb') expect(existsSync(join(process.cwd(), 'public', entry.url))).toBe(true);
    });
  });

  it('id lạ quay về mẫu mặc định', () => {
    expect(getModelEntry('khong-co').id).toBe(DEFAULT_MODEL_ID);
  });

  it('báo lỗi rõ khi khai báo sai: id trùng, url sai chỗ, thiếu layout', () => {
    const base = { id: 'a', name: 'A', source: 'procedural' as const };
    expect(modelListSchema.safeParse([base, base]).success).toBe(false);
    expect(
      modelListSchema.safeParse([{ id: 'b', name: 'B', source: 'glb', url: 'C:/Downloads/b.glb', layout: '75%' }]).success
    ).toBe(false);
    expect(modelListSchema.safeParse([{ id: 'c', name: 'C', source: 'glb', url: '/models/c.glb' }]).success).toBe(false);
  });

  it('recolor mặc định là true', () => {
    const parsed = modelListSchema.parse([{ id: 'd', name: 'D', source: 'glb', url: '/models/d.glb', layout: 'TKL' }]);
    expect(parsed[0]).toMatchObject({ recolor: true });
  });
});
