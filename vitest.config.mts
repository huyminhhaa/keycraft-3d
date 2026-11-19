import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Giả lập app đứng sau 1 proxy đáng tin (như Vercel) để test rate limit theo IP
    // Đề CAPTCHA Proof-of-Work nhẹ hơn cho test nhanh (production mặc định 17 bit)
    env: { TRUSTED_PROXY_HOPS: '1', CAPTCHA_POW_DIFFICULTY: '10' },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
