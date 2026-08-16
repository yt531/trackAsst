import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from 'next-themes';
import { LockProvider } from '@/components/LockProvider';
import { UserInteractionLock } from '@/components/UserInteractionLock';
import { PrivacyProvider } from '@/components/PrivacyProvider';
import { LedgerProvider } from '@/components/LedgerProvider';

export const metadata: Metadata = {
  title: '輕鬆記 (FinTrack) - 輕鬆記、不忘記',
  description: '簡單、無壓力的個人記帳與發票存摺應用程式',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 antialiased select-none">
        <UserInteractionLock />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <LockProvider>
              <PrivacyProvider>
                <LedgerProvider>
                  {children}
                </LedgerProvider>
              </PrivacyProvider>
            </LockProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>

    </html>
  );
}
