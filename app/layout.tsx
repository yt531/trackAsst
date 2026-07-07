import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from 'next-themes';

export const metadata: Metadata = {
  title: 'FinTrack 記帳',
  description: '支援離線使用的跨平台個人記帳應用程式',
  manifest: '/manifest.json', // Will be useful for PWA
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
