'use client';

import { create } from 'zustand';
import type { CaptchaChallenge } from '@/lib/auth/bruteForce';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';

  // Trạng thái thử thách bảo mật Brute-force & CAPTCHA
  requireCaptcha: boolean;
  captchaChallenge: CaptchaChallenge | null;
  errorMessage: string | null;

  openModal: (mode?: 'login' | 'register') => void;
  closeModal: () => void;
  setMode: (mode: 'login' | 'register') => void;
  setCaptcha: (challenge: CaptchaChallenge | null) => void;
  fetchCaptcha: () => Promise<void>;

  checkAuth: () => Promise<void>;
  login: (credentials: {
    email: string;
    password: string;
    captchaAnswer?: string;
    captchaChallengeId?: string;
    captchaSignature?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isAuthModalOpen: false,
  authModalMode: 'login',

  requireCaptcha: false,
  captchaChallenge: null,
  errorMessage: null,

  openModal: (mode = 'login') =>
    set({
      isAuthModalOpen: true,
      authModalMode: mode,
      errorMessage: null,
    }),

  closeModal: () =>
    set({
      isAuthModalOpen: false,
      errorMessage: null,
    }),

  setMode: (mode) => set({ authModalMode: mode, errorMessage: null }),

  setCaptcha: (captchaChallenge) =>
    set({ captchaChallenge, requireCaptcha: Boolean(captchaChallenge) }),

  fetchCaptcha: async () => {
    try {
      const res = await fetch('/api/auth/captcha');
      const data = await res.json();
      if (data.captcha) {
        set({ captchaChallenge: data.captcha, requireCaptcha: true });
      }
    } catch {
      // Bỏ qua lỗi mạng
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          set({ user: data.user, isAuthenticated: true });
        } else {
          set({ user: null, isAuthenticated: false });
        }
      } else {
        set({ user: null, isAuthenticated: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (credentials) => {
    set({ isLoading: true, errorMessage: null });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await res.json();

      if (!res.ok) {
        set({
          errorMessage: data.error,
          requireCaptcha: Boolean(data.requireCaptcha),
          captchaChallenge: data.captcha || null,
        });
        return { success: false, error: data.error };
      }

      set({
        user: data.user,
        isAuthenticated: true,
        isAuthModalOpen: false,
        requireCaptcha: false,
        captchaChallenge: null,
        errorMessage: null,
      });

      return { success: true };
    } catch {
      const msg = 'Lỗi kết nối máy chủ. Vui lòng thử lại.';
      set({ errorMessage: msg });
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (registerData) => {
    set({ isLoading: true, errorMessage: null });
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData),
      });

      const data = await res.json();

      if (!res.ok) {
        set({ errorMessage: data.error });
        return { success: false, error: data.error };
      }

      set({
        user: data.user,
        isAuthenticated: true,
        isAuthModalOpen: false,
        errorMessage: null,
      });

      return { success: true };
    } catch {
      const msg = 'Lỗi kết nối máy chủ. Vui lòng thử lại.';
      set({ errorMessage: msg });
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isAuthModalOpen: false,
      });
    }
  },
}));
