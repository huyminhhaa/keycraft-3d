import { useKeyboardStore } from '@/store/useKeyboardStore';
import type { CameraPreset, CaseMaterial, KeyboardLayout, PlateMaterial, SwitchType } from '@/types/keyboard';

export interface SSEChunkEvent {
  type: string;
  id?: string;
  delta?: string;
  toolCallId?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  [key: string]: unknown;
}

/**
 * Xử lý chuỗi buffer SSE, phân tách từng dòng data: {...} và gọi callback event.
 * Trả về phần dòng chưa hoàn thiện (remainder) để ghép với chunk kế tiếp.
 */
export function parseSSELines(
  buffer: string,
  onEvent: (event: SSEChunkEvent) => void
): string {
  const lines = buffer.split('\n');
  const remainder = lines.pop() ?? '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || !line.startsWith('data:')) continue;

    const dataContent = line.slice(5).trim();
    if (dataContent === '[DONE]') continue;

    try {
      const parsed = JSON.parse(dataContent) as SSEChunkEvent;
      if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
        onEvent(parsed);
      }
    } catch {
      // Bỏ qua dòng JSON chưa trọn vẹn hoặc sai định dạng
    }
  }

  return remainder;
}

/**
 * Tóm tắt ngắn gọn thay đổi cấu hình mà AI đã thực hiện bằng tiếng Việt tự nhiên.
 */
export function formatToolCallSummary(toolName: string, input: Record<string, unknown>): string {
  if (toolName === 'toggleExplodedView') {
    const isExploded = Boolean(input.isExploded);
    const offset = input.explosionOffset ? ` (${input.explosionOffset}x)` : '';
    return isExploded ? `Tách lớp 3D${offset}` : 'Gộp linh kiện 3D';
  }

  if (toolName === 'getAcousticRecommendation') {
    const pref = typeof input.soundProfilePreference === 'string' ? input.soundProfilePreference.toUpperCase() : 'Tự động';
    return `Tư vấn âm học: ${pref}`;
  }

  if (toolName === 'updateKeyboardConfig') {
    const changes: string[] = [];

    if (typeof input.layout === 'string') changes.push(`Layout ${input.layout}`);
    if (typeof input.plateMaterial === 'string') {
      const plateMap: Record<string, string> = {
        aluminum: 'Plate Nhôm',
        polycarbonate: 'Plate PC',
        pom: 'Plate POM',
        fr4: 'Plate FR4',
      };
      changes.push(plateMap[input.plateMaterial] ?? `Plate ${input.plateMaterial}`);
    }
    if (typeof input.switchType === 'string') {
      const switchMap: Record<string, string> = {
        linear: 'Switch Linear',
        tactile: 'Switch Tactile',
        clicky: 'Switch Clicky',
        silent_linear: 'Switch Silent Linear',
      };
      changes.push(switchMap[input.switchType] ?? `Switch ${input.switchType}`);
    }
    if (typeof input.caseMaterial === 'string') {
      const caseMatMap: Record<string, string> = {
        aluminum: 'Vỏ nhôm',
        polycarbonate: 'Vỏ PC',
        acrylic: 'Vỏ Acrylic',
        wood: 'Vỏ gỗ',
      };
      changes.push(caseMatMap[input.caseMaterial] ?? `Vỏ ${input.caseMaterial}`);
    }
    if (typeof input.caseColor === 'string') changes.push(`Vỏ ${input.caseColor}`);
    if (typeof input.keycapColor === 'string') changes.push(`Keycap ${input.keycapColor}`);
    if (typeof input.cameraPreset === 'string') changes.push(`Camera ${input.cameraPreset}`);
    if (typeof input.underglowEnabled === 'boolean') {
      changes.push(input.underglowEnabled ? 'Bật LED' : 'Tắt LED');
    }

    return changes.length > 0 ? `Đã đổi: ${changes.join(' • ')}` : 'Đã cập nhật cấu hình 3D';
  }

  return `Thực thi: ${toolName}`;
}

/**
 * Áp dụng trực tiếp tham số tool call từ AI vào Zustand store của bàn phím 3D.
 */
export function applyToolToStore(
  toolName: string,
  input: Record<string, unknown>
): { applied: boolean; summary: string } {
  const summary = formatToolCallSummary(toolName, input);

  if (toolName === 'updateKeyboardConfig') {
    const store = useKeyboardStore.getState();

    // Đồng bộ các tham số cấu hình phần cứng vào store
    store.applyAIConfig({
      layout: input.layout as KeyboardLayout | undefined,
      plateMaterial: input.plateMaterial as PlateMaterial | undefined,
      caseMaterial: input.caseMaterial as CaseMaterial | undefined,
      switchType: input.switchType as SwitchType | undefined,
      caseColor: typeof input.caseColor === 'string' ? input.caseColor : undefined,
      keycapColor: typeof input.keycapColor === 'string' ? input.keycapColor : undefined,
      keycapModifierColor: typeof input.keycapModifierColor === 'string' ? input.keycapModifierColor : undefined,
      keycapAccentColor: typeof input.keycapAccentColor === 'string' ? input.keycapAccentColor : undefined,
      underglowColor: typeof input.underglowColor === 'string' ? input.underglowColor : undefined,
      underglowBrightness: typeof input.underglowBrightness === 'number' ? input.underglowBrightness : undefined,
      underglowEnabled: typeof input.underglowEnabled === 'boolean' ? input.underglowEnabled : undefined,
      cameraPreset: input.cameraPreset as CameraPreset | undefined,
    });

    if (input.cameraPreset && typeof input.cameraPreset === 'string') {
      store.setCameraPreset(input.cameraPreset as CameraPreset);
    }

    return { applied: true, summary };
  }

  if (toolName === 'toggleExplodedView') {
    const isExploded = Boolean(input.isExploded);
    const store = useKeyboardStore.getState();

    store.applyAIConfig({
      isExploded,
      explosionOffset: typeof input.explosionOffset === 'number' ? input.explosionOffset : store.explosionOffset,
    });

    return { applied: true, summary };
  }

  if (toolName === 'getAcousticRecommendation') {
    return { applied: true, summary };
  }

  return { applied: false, summary };
}
