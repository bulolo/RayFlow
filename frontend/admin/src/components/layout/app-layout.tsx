'use client';

import { Header } from './header';
import { Platform } from '@/features/platform/components/platform';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-16">
        {children}
      </div>
      <Platform />
    </div>
  );
}
