import { create } from 'zustand';

export type SidebarTab = 'builds' | 'design' | 'sound' | 'ai';

/**
 * Trạng thái của sân khấu 3D & điều hướng thanh công cụ:
 * bàn xoay 360°, cảnh mở đầu, chất lượng đồ họa và tab Sidebar đang mở.
 */
interface StageState {
  autoRotate: boolean;
  introDone: boolean;
  /** Hiệu ứng nặng (sàn phản chiếu, ambient occlusion). Tự tắt khi máy không giữ nổi FPS. */
  highQuality: boolean;
  /** Tab đang mở trên Sidebar: Thiết kế, Âm thanh hoặc Trợ lý AI */
  activeTab: SidebarTab;
  /** Thanh cấu hình bên trái (desktop) đang mở hay thu gọn để sân khấu chiếm trọn màn hình */
  sidebarOpen: boolean;
  /** Khung chat AI ở chế độ rộng (Focus) 640px thay vì 440px — chỉ có tác dụng ở tab Trợ lý AI trên desktop */
  chatWide: boolean;
  toggleChatWide: () => void;
  /** Lỗi khi nạp file .glb của mẫu đang chọn (null = không lỗi); web tạm hiện mẫu dựng bằng code */
  modelError: string | null;
  setModelError: (message: string | null) => void;
  toggleSidebar: () => void;
  setAutoRotate: (on: boolean) => void;
  toggleAutoRotate: () => void;
  setIntroDone: (done: boolean) => void;
  setHighQuality: (on: boolean) => void;
  setActiveTab: (tab: SidebarTab) => void;
}

export const useStageStore = create<StageState>((set) => ({
  autoRotate: true,
  introDone: false,
  highQuality: true,
  // Mở studio là thấy ngay thư viện build phím thật
  activeTab: 'builds',
  sidebarOpen: true,
  chatWide: false,
  toggleChatWide: () => set((state) => ({ chatWide: !state.chatWide })),
  modelError: null,
  setModelError: (modelError) => set({ modelError }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
  setIntroDone: (introDone) => set({ introDone }),
  setHighQuality: (highQuality) => set({ highQuality }),
  // Mở một tab (kể cả từ nút "Trợ lý AI" trên sân khấu) thì thanh cấu hình phải hiện ra
  setActiveTab: (activeTab) => set({ activeTab, sidebarOpen: true }),
}));
