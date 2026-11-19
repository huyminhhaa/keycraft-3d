import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthModal } from './AuthModal';
import { useAuthStore } from '@/store/useAuthStore';

// Mock framer-motion để render mượt mà trong test
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, ...props }: React.ComponentProps<'div'>) => (
      <div className={className} onClick={onClick} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AuthModal Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthModalOpen: false,
      authModalMode: 'login',
      user: null,
      isAuthenticated: false,
      isLoading: false,
      requireCaptcha: false,
      captchaChallenge: null,
      errorMessage: null,
    });
  });

  it('không hiển thị khi isAuthModalOpen = false', () => {
    render(<AuthModal />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hiển thị form Đăng nhập khi isAuthModalOpen = true', () => {
    useAuthStore.setState({ isAuthModalOpen: true, authModalMode: 'login' });
    render(<AuthModal />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Đăng nhập KeyCraft')).toBeDefined();
    expect(screen.getByPlaceholderText('builder@keycraft.io')).toBeDefined();
    expect(screen.getByPlaceholderText('Tối thiểu 8 ký tự...')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeDefined();
  });

  it('chuyển đổi tab sang Đăng ký khi click', () => {
    useAuthStore.setState({ isAuthModalOpen: true, authModalMode: 'login' });
    render(<AuthModal />);

    const registerTab = screen.getByRole('tab', { name: 'Đăng ký' });
    fireEvent.click(registerTab);

    expect(screen.getByText('Tạo tài khoản mới')).toBeDefined();
    expect(screen.getByPlaceholderText('Nguyễn Văn A')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tạo tài khoản' })).toBeDefined();
  });

  it('khi requireCaptcha: tự giải đề Proof-of-Work, không bắt người dùng nhập gì', async () => {
    useAuthStore.setState({
      isAuthModalOpen: true,
      authModalMode: 'login',
      requireCaptcha: true,
      captchaChallenge: {
        challengeId: 'test-challenge-123',
        difficulty: 4,
        signature: 'valid-sig',
      },
    });

    render(<AuthModal />);

    expect(screen.getByText('Xác minh chống dò mật khẩu')).toBeDefined();
    // Đề dễ (4 bit) giải xong gần như tức thì -> nút Đăng nhập mở lại
    await waitFor(() => expect(screen.getByText('Đã xác minh. Bạn có thể đăng nhập.')).toBeDefined());
    expect((screen.getByRole('button', { name: 'Đăng nhập' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('gọi closeModal khi bấm nút Đóng (X)', () => {
    const closeSpy = vi.fn();
    useAuthStore.setState({
      isAuthModalOpen: true,
      closeModal: closeSpy,
    });

    render(<AuthModal />);
    const closeBtn = screen.getByLabelText('Đóng cửa sổ xác thực');
    fireEvent.click(closeBtn);

    expect(closeSpy).toHaveBeenCalled();
  });
});
