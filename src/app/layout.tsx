import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Inter_Tight } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'vietnamese'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'vietnamese'],
});

// Font hiển thị cho tiêu đề: nét chặt, tracking âm đẹp ở cỡ lớn
const interTight = Inter_Tight({
  variable: '--font-inter-tight',
  subsets: ['latin', 'vietnamese'],
});

export const metadata: Metadata = {
  title: 'KeyCraft 3D — Custom Mechanical Keyboard Studio & AI Acoustic Architect',
  description:
    'Studio 3D tuỳ biến bàn phím cơ: xoay, tách 7 lớp phần cứng và xem hồ sơ âm học thay đổi theo thời gian thực.',
};

export const viewport: Viewport = {
  themeColor: '#09090b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${interTight.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground overflow-x-hidden">{children}</body>
    </html>
  );
}
