import { describe, it, expect, beforeEach } from 'vitest';
import { parseSSELines, formatToolCallSummary, applyToolToStore } from './chatStream';
import { useKeyboardStore } from '@/store/useKeyboardStore';

describe('chatStream utility', () => {
  beforeEach(() => {
    useKeyboardStore.getState().resetConfig();
  });

  describe('parseSSELines', () => {
    it('phân tích chính xác dòng data SSE đơn lẻ', () => {
      const events: unknown[] = [];
      const remainder = parseSSELines(
        'data: {"type":"text-delta","delta":"Xin chào"}\n',
        (ev) => events.push(ev)
      );

      expect(remainder).toBe('');
      expect(events).toEqual([{ type: 'text-delta', delta: 'Xin chào' }]);
    });

    it('giữ lại phần dở dang (remainder) khi chunk chưa có ký tự xuống dòng', () => {
      const events: unknown[] = [];
      const chunk1 = 'data: {"type":"text-delta","delta":"Một"}\ndata: {"type":"text-';
      const remainder1 = parseSSELines(chunk1, (ev) => events.push(ev));

      expect(events).toHaveLength(1);
      expect(remainder1).toBe('data: {"type":"text-');

      // Ghép chunk tiếp theo
      const chunk2 = remainder1 + 'delta","delta":"Hai"}\n';
      const remainder2 = parseSSELines(chunk2, (ev) => events.push(ev));

      expect(events).toHaveLength(2);
      expect(remainder2).toBe('');
      expect(events[1]).toEqual({ type: 'text-delta', delta: 'Hai' });
    });

    it('bỏ qua dòng data: [DONE] và dòng trống', () => {
      const events: unknown[] = [];
      const buffer = '\n\ndata: [DONE]\n\n';
      const remainder = parseSSELines(buffer, (ev) => events.push(ev));

      expect(remainder).toBe('');
      expect(events).toHaveLength(0);
    });
  });

  describe('formatToolCallSummary', () => {
    it('tóm tắt cấu hình thay đổi của updateKeyboardConfig', () => {
      const summary = formatToolCallSummary('updateKeyboardConfig', {
        layout: '75%',
        plateMaterial: 'pom',
        switchType: 'linear',
        caseColor: '#1d1d20',
      });

      expect(summary).toContain('Layout 75%');
      expect(summary).toContain('Plate POM');
      expect(summary).toContain('Switch Linear');
      expect(summary).toContain('Vỏ #1d1d20');
    });

    it('tóm tắt hành động tách lớp 3D', () => {
      expect(formatToolCallSummary('toggleExplodedView', { isExploded: true, explosionOffset: 1.5 })).toBe(
        'Tách lớp 3D (1.5x)'
      );
      expect(formatToolCallSummary('toggleExplodedView', { isExploded: false })).toBe(
        'Gộp linh kiện 3D'
      );
    });

    it('tóm tắt tư vấn âm học', () => {
      expect(formatToolCallSummary('getAcousticRecommendation', { soundProfilePreference: 'thock' })).toBe(
        'Tư vấn âm học: THOCK'
      );
    });
  });

  describe('applyToolToStore', () => {
    it('cập nhật trực tiếp cấu hình vào useKeyboardStore khi AI gọi updateKeyboardConfig', () => {
      const result = applyToolToStore('updateKeyboardConfig', {
        layout: '75%',
        plateMaterial: 'pom',
        switchType: 'tactile',
        caseColor: '#00f0ff',
        cameraPreset: 'top',
      });

      expect(result.applied).toBe(true);

      const state = useKeyboardStore.getState();
      expect(state.layout).toBe('75%');
      expect(state.plateMaterial).toBe('pom');
      expect(state.switchType).toBe('tactile');
      expect(state.caseColor).toBe('#00f0ff');
      expect(state.cameraPreset).toBe('top');
      expect(state.soundProfile.label).toBe('Bumpy Thock Tactile');
    });

    it('bật/tắt tách lớp khi AI gọi toggleExplodedView', () => {
      const result = applyToolToStore('toggleExplodedView', {
        isExploded: true,
        explosionOffset: 2.0,
      });

      expect(result.applied).toBe(true);
      expect(useKeyboardStore.getState().isExploded).toBe(true);
      expect(useKeyboardStore.getState().explosionOffset).toBe(2.0);
    });
  });
});
