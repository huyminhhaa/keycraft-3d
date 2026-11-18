'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { getOAuthErrorMessage } from '@/lib/auth/oauthErrors';

/**
 * Đồng bộ trạng thái đăng nhập (httpOnly Cookie -> Zustand) ở cấp RootLayout
 * để mọi trang (/, /studio, /build/[slug]) luôn hiển thị phiên đăng nhập đồng nhất.
 */
export function AuthHydrator() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const openModal = useAuthStore((s) => s.openModal);

  useEffect(() => {
    void checkAuth();

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const authError = url.searchParams.get('auth_error');
      if (authError) {
        const message = getOAuthErrorMessage(authError);
        if (message) {
          openModal('login', message);
        }
        url.searchParams.delete('auth_error');
        const cleaned = url.pathname + (url.search ? url.search : '') + url.hash;
        window.history.replaceState({}, '', cleaned);
      }
    }
  }, [checkAuth, openModal]);

  return null;
}
