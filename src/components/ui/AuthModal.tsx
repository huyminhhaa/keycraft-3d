'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, RefreshCw, Lock, Mail, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface AuthFormProps {
  mode: 'login' | 'register';
}

const AuthForm: React.FC<AuthFormProps> = ({ mode }) => {
  const {
    isLoading,
    requireCaptcha,
    captchaChallenge,
    login,
    register,
    fetchCaptcha,
  } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'login') {
      await login({
        email,
        password,
        captchaAnswer: requireCaptcha ? captchaAnswer : undefined,
        captchaChallengeId: captchaChallenge?.challengeId,
        captchaSignature: captchaChallenge?.signature,
      });
    } else {
      await register({
        name,
        email,
        password,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {mode === 'register' && (
        <div>
          <label className="mb-1 block text-[12px] font-medium text-muted">Họ và tên</label>
          <div className="relative flex items-center">
            <UserIcon className="absolute left-3 h-4 w-4 text-faint" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full rounded-md border border-line bg-canvas py-2.5 pl-9 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
            />
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-[12px] font-medium text-muted">Email</label>
        <div className="relative flex items-center">
          <Mail className="absolute left-3 h-4 w-4 text-faint" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="builder@keycraft.io"
            className="w-full rounded-md border border-line bg-canvas py-2.5 pl-9 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[12px] font-medium text-muted">Mật khẩu</label>
        <div className="relative flex items-center">
          <Lock className="absolute left-3 h-4 w-4 text-faint" />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tối thiểu 8 ký tự..."
            className="w-full rounded-md border border-line bg-canvas py-2.5 pl-9 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
          />
        </div>
      </div>

      {/* Thử thách Brute-force Shield CAPTCHA khi nhập sai >= 3 lần */}
      {requireCaptcha && mode === 'login' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-amber-400">Thử thách chống Brute-force:</span>
            <button
              type="button"
              onClick={fetchCaptcha}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-ink"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Đổi câu đố</span>
            </button>
          </div>
          <p className="mt-1 text-[13px] font-semibold tabular-nums text-ink">
            {captchaChallenge?.question || 'Đang tải câu đố...'}
          </p>
          <input
            type="text"
            required
            value={captchaAnswer}
            onChange={(e) => setCaptchaAnswer(e.target.value)}
            placeholder="Nhập kết quả số vào đây..."
            className="mt-2 w-full rounded border border-line bg-canvas px-3 py-1.5 text-[13px] text-ink focus:border-ink focus:outline-none"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="btn-press flex w-full items-center justify-center rounded-md bg-ink py-2.5 text-[13px] font-medium text-canvas transition-opacity hover:opacity-95 disabled:opacity-50"
      >
        {isLoading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-canvas border-t-transparent" />
        ) : mode === 'login' ? (
          'Đăng nhập'
        ) : (
          'Tạo tài khoản'
        )}
      </button>
    </form>
  );
};

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalMode,
    errorMessage,
    closeModal,
    setMode,
  } = useAuthStore();

  return (
    <AnimatePresence>
      {isAuthModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop tối mờ phong cách Frosted Glass */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface p-6 shadow-2xl"
          >
            {/* Nút đóng */}
            <button
              type="button"
              onClick={closeModal}
              aria-label="Đóng cửa sổ xác thực"
              className="btn-press absolute right-4 top-4 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header & Tabs */}
            <div className="mb-5">
              <h2 id="auth-modal-title" className="text-[18px] font-semibold tracking-tight text-ink">
                {authModalMode === 'login' ? 'Đăng nhập KeyCraft' : 'Tạo tài khoản mới'}
              </h2>
              <p className="mt-1 text-[13px] text-muted">
                {authModalMode === 'login'
                  ? 'Đăng nhập để lưu, chia sẻ và đồng bộ bản build bàn phím 3D của bạn.'
                  : 'Tham gia cộng đồng Custom Keyboard & kiến tạo âm thanh phím cơ.'}
              </p>

              {/* Tab Switcher */}
              <div role="tablist" className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authModalMode === 'login'}
                  onClick={() => setMode('login')}
                  className={`rounded-md py-1.5 text-[13px] font-medium transition-colors ${
                    authModalMode === 'login'
                      ? 'bg-ink text-canvas shadow'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authModalMode === 'register'}
                  onClick={() => setMode('register')}
                  className={`rounded-md py-1.5 text-[13px] font-medium transition-colors ${
                    authModalMode === 'register'
                      ? 'bg-ink text-canvas shadow'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Đăng ký
                </button>
              </div>
            </div>

            {/* Thông báo lỗi */}
            {errorMessage && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-400">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {/* Dynamic Form with key for fresh unmount/mount */}
            <AuthForm key={authModalMode} mode={authModalMode} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
