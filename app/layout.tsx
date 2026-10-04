import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/lib/auth-context';
import ErrorBoundary from '@/components/error-boundary';

export const metadata: Metadata = {
  title: 'Exam Availability Portal',
  description: 'A centralized system for students to submit exam schedules and for faculty to verify exam availability efficiently.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
