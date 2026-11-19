import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthHydrator } from '@/components/ui/AuthHydrator';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'vietnamese'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'vietnamese'],
});

export const metadata: Metadata = {
  title: 'KeyCraft — Bàn phím cơ 3D tự cấu hình',
  description:
    'Cấu hình bàn phím cơ 65%, 75% hoặc TKL trong 3D: chọn vỏ, keycap, plate và switch, xem 7 lớp linh kiện và gõ thử từng phím.',
};

export const viewport: Viewport = {
  themeColor: '#141416',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // CSP nonce (src/proxy.ts) đổi theo từng request: trang phải render theo request để Next gắn đúng
  // nonce vào script. Trang build sẵn lúc build sẽ mang script không có nonce và bị CSP chặn.
  await connection();

  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <AuthHydrator />
        {children}
      </body>
    </html>
  );
}
