import { create } from 'zustand';

export type SidebarTab = 'design' | 'sound' | 'ai';

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
  activeTab: 'design',
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
  setIntroDone: (introDone) => set({ introDone }),
  setHighQuality: (highQuality) => set({ highQuality }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
