import './globals.css';
import AuthProvider from '@/components/providers/AuthProvider';
import SyncProvider from '@/components/providers/SyncProvider';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ReadStack',
  description: 'Your personal reading library',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          <SyncProvider>
            {children}
          </SyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
