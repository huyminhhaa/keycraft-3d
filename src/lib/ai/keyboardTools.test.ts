import { describe, it, expect } from 'vitest';
import {
  updateKeyboardConfigSchema,
  toggleExplodedViewSchema,
  getAcousticRecommendationSchema,
  searchHardwareKnowledgeSchema,
  updateKeyboardConfigTool,
  toggleExplodedViewTool,
  getAcousticRecommendationTool,
  searchHardwareKnowledgeTool,
  UpdateKeyboardConfigInput,
  ToggleExplodedViewInput,
  GetAcousticRecommendationInput,
  SearchHardwareKnowledgeInput,
} from './keyboardTools';

describe('AI Tools & Zod Schema Validation', () => {
  describe('updateKeyboardConfigSchema', () => {
    it('chấp nhận cấu hình bàn phím hợp lệ', () => {
      const validPayload = {
        layout: '75%' as const,
        plateMaterial: 'polycarbonate' as const,
        caseMaterial: 'aluminum' as const,
        switchType: 'linear' as const,
        caseColor: '#0f172a',
        keycapColor: '#1e293b',
        keycapModifierColor: '#c41f2d',
        keycapAccentColor: '#3b82f6',
        underglowColor: '#00f0ff',
        underglowBrightness: 0.85,
        underglowEnabled: true,
        cameraPreset: 'isometric' as const,
      };

      const result = updateKeyboardConfigSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('từ chối layout không được hỗ trợ', () => {
      const invalidLayout = {
        layout: '100%', // Chỉ hỗ trợ '65%', '75%', 'TKL'
      };

      const result = updateKeyboardConfigSchema.safeParse(invalidLayout);
      expect(result.success).toBe(false);
    });

    it('từ chối mã màu HEX không hợp lệ', () => {
      const invalidColor = {
        caseColor: 'rgb(0,0,0)', // Phải là mã HEX
      };

      const result = updateKeyboardConfigSchema.safeParse(invalidColor);
      expect(result.success).toBe(false);

      const invalidHex = {
        keycapColor: '#12345', // Sai độ dài HEX
      };
      expect(updateKeyboardConfigSchema.safeParse(invalidHex).success).toBe(false);
    });

    it('từ chối độ sáng underglow ngoài ngưỡng [0, 1]', () => {
      expect(
        updateKeyboardConfigSchema.safeParse({ underglowBrightness: 1.5 }).success
      ).toBe(false);
      expect(
        updateKeyboardConfigSchema.safeParse({ underglowBrightness: -0.2 }).success
      ).toBe(false);
    });

    it('thực thi execute() trả về status success và config', async () => {
      if (!updateKeyboardConfigTool.execute) throw new Error('Tool execute missing');
      const input: UpdateKeyboardConfigInput = {
        plateMaterial: 'pom',
        switchType: 'linear',
      };
      const executeFn = updateKeyboardConfigTool.execute as (
        args: UpdateKeyboardConfigInput
      ) => Promise<{
        status: string;
        appliedConfig: UpdateKeyboardConfigInput;
        message: string;
      }>;
      const res = await executeFn(input);

      expect(res.status).toBe('success');
      expect(res.appliedConfig.plateMaterial).toBe('pom');
    });
  });

  describe('toggleExplodedViewSchema', () => {
    it('chấp nhận trạng thái bung lớp và offset hợp lệ', () => {
      const valid = {
        isExploded: true,
        explosionOffset: 2.0,
      };

      expect(toggleExplodedViewSchema.safeParse(valid).success).toBe(true);
    });

    it('từ chối offset vượt quá giới hạn 0.5x - 3.0x', () => {
      expect(
        toggleExplodedViewSchema.safeParse({ isExploded: true, explosionOffset: 0.2 })
          .success
      ).toBe(false);
      expect(
        toggleExplodedViewSchema.safeParse({ isExploded: true, explosionOffset: 3.5 })
          .success
      ).toBe(false);
    });

    it('thực thi execute() trả về trạng thái bung tương ứng', async () => {
      if (!toggleExplodedViewTool.execute) throw new Error('Tool execute missing');
      const input: ToggleExplodedViewInput = {
        isExploded: true,
        explosionOffset: 2.2,
      };
      const executeFn = toggleExplodedViewTool.execute as (
        args: ToggleExplodedViewInput
      ) => Promise<{
        status: string;
        isExploded: boolean;
        explosionOffset: number;
        message: string;
      }>;
      const res = await executeFn(input);

      expect(res.status).toBe('success');
      expect(res.isExploded).toBe(true);
      expect(res.explosionOffset).toBe(2.2);
    });
  });

  describe('getAcousticRecommendationSchema & Tool', () => {
    it('chấp nhận các hồ sơ âm thanh chuẩn', () => {
      expect(
        getAcousticRecommendationSchema.safeParse({ targetProfile: 'deep_thock' })
          .success
      ).toBe(true);
      expect(
        getAcousticRecommendationSchema.safeParse({ targetProfile: 'clack' })
          .success
      ).toBe(true);
    });

    it('từ chối hồ sơ âm thanh không tồn tại', () => {
      expect(
        getAcousticRecommendationSchema.safeParse({ targetProfile: 'noisy' })
          .success
      ).toBe(false);
    });

    it('trả về công thức phối linh kiện chuẩn cho deep_thock', async () => {
      if (!getAcousticRecommendationTool.execute)
        throw new Error('Tool execute missing');
      const input: GetAcousticRecommendationInput = {
        targetProfile: 'deep_thock',
      };
      const executeFn = getAcousticRecommendationTool.execute as (
        args: GetAcousticRecommendationInput
      ) => Promise<{
        plate: string;
        switchType: string;
        foam: string;
        explanation: string;
      }>;
      const res = await executeFn(input);

      expect(res.plate).toBe('pom');
      expect(res.switchType).toBe('linear');
      expect(res.explanation).toContain('POM');
    });

    it('trả về công thức phối linh kiện chuẩn cho clack', async () => {
      if (!getAcousticRecommendationTool.execute)
        throw new Error('Tool execute missing');
      const input: GetAcousticRecommendationInput = {
        targetProfile: 'clack',
      };
      const executeFn = getAcousticRecommendationTool.execute as (
        args: GetAcousticRecommendationInput
      ) => Promise<{
        plate: string;
        switchType: string;
        foam: string;
        explanation: string;
      }>;
      const res = await executeFn(input);

      expect(res.plate).toBe('aluminum');
      expect(res.switchType).toBe('tactile');
    });
  });

  describe('searchHardwareKnowledgeSchema & Tool (RAG)', () => {
    it('chấp nhận truy vấn hợp lệ với các tham số', () => {
      const valid = {
        query: 'switch deep thock trầm ấm',
        type: 'switch' as const,
        limit: 4,
      };

      const parsed = searchHardwareKnowledgeSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('từ chối truy vấn rỗng', () => {
      const invalid = {
        query: '',
      };
      const parsed = searchHardwareKnowledgeSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('từ chối type không được hỗ trợ', () => {
      const invalid = {
        query: 'oil king',
        type: 'keycap_profile',
      };
      const parsed = searchHardwareKnowledgeSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('thực thi searchHardwareKnowledgeTool trả về danh sách linh kiện và similarity', async () => {
      if (!searchHardwareKnowledgeTool.execute) {
        throw new Error('Tool execute missing');
      }

      const input: SearchHardwareKnowledgeInput = {
        query: 'gateron oil king linear trầm',
        type: 'switch',
        limit: 2,
      };

      const executeFn = searchHardwareKnowledgeTool.execute as unknown as (
        args: SearchHardwareKnowledgeInput
      ) => Promise<{
        status: string;
        query: string;
        resultsCount: number;
        components: Array<{
          id: string;
          name: string;
          type: string;
          similarity: number;
        }>;
      }>;

      const res = await executeFn(input);
      expect(res.status).toBe('success');
      expect(res.resultsCount).toBeGreaterThan(0);
      expect(res.components[0].type).toBe('switch');
      expect(res.components[0].similarity).toBeGreaterThan(0);
    });
  });
});
