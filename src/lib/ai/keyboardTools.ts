import { tool } from 'ai';
import { z } from 'zod';

// Regex chuẩn mã màu HEX (#RGB hoặc #RRGGBB)
const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// -----------------------------------------------------------------------------
// 1. Schema & Tool: Cập nhật cấu hình bàn phím 3D (updateKeyboardConfig)
// -----------------------------------------------------------------------------
export const updateKeyboardConfigSchema = z.object({
  layout: z
    .enum(['65%', '75%', 'TKL'])
    .optional()
    .describe('Kích thước layout bàn phím: 65% (nhỏ gọn), 75% (có F-row), TKL (87 phím)'),
  plateMaterial: z
    .enum(['aluminum', 'polycarbonate', 'pom', 'fr4'])
    .optional()
    .describe('Chất liệu Plate: aluminum (đanh giòn), polycarbonate (trầm ấm), pom (thock sâu), fr4 (cân bằng)'),
  caseMaterial: z
    .enum(['aluminum', 'polycarbonate', 'acrylic', 'wood'])
    .optional()
    .describe('Chất liệu vỏ Case ngoài: aluminum (nhôm CNC), polycarbonate (PC mờ), acrylic, wood (gỗ tự nhiên)'),
  switchType: z
    .enum(['linear', 'tactile', 'clicky', 'silent_linear'])
    .optional()
    .describe('Hệ thống switch cơ học: linear (mượt mà), tactile (khấc nảy), clicky (click đanh), silent_linear (êm văn phòng)'),
  caseColor: z
    .string()
    .regex(hexColorRegex, 'Mã màu Case phải là mã HEX hợp lệ (ví dụ: #0f172a)')
    .optional()
    .describe('Mã màu HEX cho vỏ case (ví dụ: #0f172a cho Slate, #020617 cho Midnight)'),
  keycapColor: z
    .string()
    .regex(hexColorRegex, 'Mã màu Keycap phải là mã HEX hợp lệ (ví dụ: #1e293b)')
    .optional()
    .describe('Mã màu HEX cho các phím chữ và số (alpha)'),
  keycapModifierColor: z
    .string()
    .regex(hexColorRegex, 'Mã màu phím chức năng phải là mã HEX hợp lệ (ví dụ: #c41f2d)')
    .optional()
    .describe('Mã màu HEX cho phím chức năng: Tab, Caps, Shift, Ctrl, Alt, cụm điều hướng, phím mũi tên'),
  keycapAccentColor: z
    .string()
    .regex(hexColorRegex, 'Mã màu Accent phải là mã HEX hợp lệ (ví dụ: #3b82f6)')
    .optional()
    .describe('Mã màu HEX cho các phím nhấn Esc và Enter'),
  underglowColor: z
    .string()
    .regex(hexColorRegex, 'Mã màu Underglow phải là mã HEX hợp lệ (ví dụ: #00f0ff)')
    .optional()
    .describe('Mã màu HEX của dải đèn LED hai bên hông vỏ'),
  underglowBrightness: z
    .number()
    .min(0, 'Độ sáng tối thiểu là 0')
    .max(1, 'Độ sáng tối đa là 1')
    .optional()
    .describe('Độ sáng phát quang đèn gầm (từ 0.0 đến 1.0)'),
  underglowEnabled: z
    .boolean()
    .optional()
    .describe('Bật (true) hoặc tắt (false) đèn gầm RGB'),
  cameraPreset: z
    .enum(['perspective', 'top', 'front', 'side', 'isometric'])
    .optional()
    .describe('Góc nhìn camera 3D trong studio'),
});

export type UpdateKeyboardConfigInput = z.infer<typeof updateKeyboardConfigSchema>;

export const updateKeyboardConfigTool = tool({
  description:
    'Cập nhật trực tiếp cấu hình phần cứng, chất liệu plate/case, hệ thống switch, màu sắc RGB và góc quay camera 3D của bàn phím.',
  inputSchema: updateKeyboardConfigSchema,
  execute: async (args: UpdateKeyboardConfigInput) => {
    return {
      status: 'success',
      appliedConfig: args,
      message: 'Cấu hình bàn phím 3D đã được cập nhật thành công lên Studio Canvas.',
    };
  },
});

// -----------------------------------------------------------------------------
// 2. Schema & Tool: Tách lớp phần cứng 3D (toggleExplodedView)
// -----------------------------------------------------------------------------
export const toggleExplodedViewSchema = z.object({
  isExploded: z
    .boolean()
    .describe('true để bung 7 tầng linh kiện ra không gian 3D, false để gộp lại'),
  explosionOffset: z
    .number()
    .min(0.5, 'Khoảng cách bung tối thiểu là 0.5x')
    .max(3.0, 'Khoảng cách bung tối đa là 3.0x')
    .optional()
    .describe('Hệ số khoảng cách bung giữa các tầng (mặc định 1.5x)'),
});

export type ToggleExplodedViewInput = z.infer<typeof toggleExplodedViewSchema>;

export const toggleExplodedViewTool = tool({
  description:
    'Bật hoặc tắt chế độ tách lớp phần cứng 7 tầng (Exploded View) kèm nhãn chú thích linh kiện để người dùng quan sát cấu trúc bên trong.',
  inputSchema: toggleExplodedViewSchema,
  execute: async (args: ToggleExplodedViewInput) => {
    return {
      status: 'success',
      isExploded: args.isExploded,
      explosionOffset: args.explosionOffset ?? 1.5,
      message: args.isExploded
        ? 'Đã bung tách lớp 7 tầng phần cứng trên Studio Canvas.'
        : 'Đã gộp hoàn chỉnh các tầng linh kiện bàn phím lại.',
    };
  },
});

// -----------------------------------------------------------------------------
// 3. Schema & Tool: Chuyên gia tư vấn âm học (getAcousticRecommendation)
// -----------------------------------------------------------------------------
export const getAcousticRecommendationSchema = z.object({
  targetProfile: z
    .enum(['thock', 'deep_thock', 'clack', 'creamy', 'silent'])
    .describe('Kiểu âm thanh mục tiêu người dùng mong muốn: thock (trầm ấm), deep_thock (trầm sâu), clack (đanh giòn), creamy (mượt ngậy), silent (êm tĩnh)'),
});

export type GetAcousticRecommendationInput = z.infer<typeof getAcousticRecommendationSchema>;

export const getAcousticRecommendationTool = tool({
  description:
    'Phân tích vật lý âm học và đưa ra công thức phối linh kiện (Plate + Switch + Foam) tối ưu nhất theo hồ sơ âm mong muốn.',
  inputSchema: getAcousticRecommendationSchema,
  execute: async ({ targetProfile }: GetAcousticRecommendationInput) => {
    switch (targetProfile) {
      case 'deep_thock':
        return {
          plate: 'pom',
          switchType: 'linear',
          foam: 'Poron 3.5mm bắt buộc',
          explanation: 'Chất liệu POM có mật độ phân tử cao hấp thụ tần số cao, tạo độ vang trầm ấm cực sâu (Deep Thock).',
        };
      case 'thock':
        return {
          plate: 'polycarbonate',
          switchType: 'linear',
          foam: 'Poron tiêu âm',
          explanation: 'Plate Polycarbonate mềm dẻo mang lại cảm giác gõ êm ái và âm Thock đầm chắc đặc trưng.',
        };
      case 'clack':
        return {
          plate: 'aluminum',
          switchType: 'tactile',
          foam: 'Không dùng foam hoặc foam mỏng',
          explanation: 'Plate nhôm CNC cứng tạo sóng phản xạ âm thanh dứt khoát, âm gõ đanh và sáng (Clack).',
        };
      case 'creamy':
        return {
          plate: 'fr4',
          switchType: 'linear',
          foam: 'Poron kết hợp PE sheet',
          explanation: 'Chất liệu FR4 kết hợp switch linear bôi trơn kỹ lưỡng tạo âm sắc mượt mà, dày dặn (Creamy).',
        };
      case 'silent':
      default:
        return {
          plate: 'polycarbonate',
          switchType: 'silent_linear',
          foam: 'Poron full lót đáy',
          explanation: 'Cụm switch giảm chấn silicone cùng plate mềm triệt tiêu đến 95% tiếng va đập khi gõ.',
        };
    }
  },
});

// Tập hợp tất cả các Tools sẵn sàng truyền vào streamText
export const keyboardTools = {
  updateKeyboardConfig: updateKeyboardConfigTool,
  toggleExplodedView: toggleExplodedViewTool,
  getAcousticRecommendation: getAcousticRecommendationTool,
};
