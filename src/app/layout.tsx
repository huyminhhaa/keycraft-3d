import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'KeyCraft 3D — Custom Mechanical Keyboard Studio & AI Acoustic Architect',
  description:
    'Interactive 3D custom mechanical keyboard studio featuring real-time acoustic simulation, AI architect, and cinematic liquid glass UI inspired by MotionSites.ai.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-[#09090b] text-[#f4f4f5] overflow-x-hidden selection:bg-cyan-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
