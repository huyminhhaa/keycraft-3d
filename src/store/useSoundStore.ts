import { create } from 'zustand';
import { soundEngine } from '@/lib/audio/soundEngine';
import { SOUND_ROOT, packIndexSchema, type PackSummary } from '@/lib/audio/soundPacks';

/**
 * Gói tiếng gõ thật đang có và gói đang chọn.
 * `none`: chưa có gói nào (chưa chạy `npm run sounds`) → bộ phát dùng tiếng tổng hợp.
 */
export type SoundStatus = 'idle' | 'loading' | 'ready' | 'none' | 'error';

const STORAGE_KEY = 'keycraft:sound-pack';

const remembered = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const remember = (id: string): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Chế độ ẩn danh / chặn lưu trữ: chỉ mất phần nhớ lựa chọn
  }
};

interface SoundState {
  packs: PackSummary[];
  selectedId: string | null;
  status: SoundStatus;
  error: string | null;
  loadIndex: () => Promise<void>;
  selectPack: (id: string) => Promise<void>;
}

export const useSoundStore = create<SoundState>((set, get) => ({
  packs: [],
  selectedId: null,
  status: 'idle',
  error: null,

  loadIndex: async () => {
    if (get().status !== 'idle') return;
    set({ status: 'loading' });
    let packs: PackSummary[] = [];
    try {
      const response = await fetch(`${SOUND_ROOT}/index.json`);
      if (response.ok) packs = packIndexSchema.parse(await response.json());
    } catch {
      packs = [];
    }
    if (packs.length === 0) {
      set({ packs, status: 'none' });
      return;
    }
    set({ packs });
    const saved = remembered();
    await get().selectPack(packs.some((p) => p.id === saved) ? (saved as string) : packs[0].id);
  },

  selectPack: async (id) => {
    set({ selectedId: id, status: 'loading', error: null });
    remember(id);
    try {
      await soundEngine.loadPack(id);
      if (get().selectedId === id) set({ status: 'ready' });
    } catch (error) {
      if (get().selectedId === id) set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  },
}));
