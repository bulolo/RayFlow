'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast, Toaster } from 'sonner';
import { ApiError } from '@/shared/api/client';
import { getErrorMessage } from '@/lib/error-message';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnMount: 'always',
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (!(event.reason instanceof ApiError)) return;

      event.preventDefault();
      const message = getErrorMessage(event.reason, '请求失败，请稍后重试');
      // Keep network/API failures in the app surface instead of letting Next.js
      // show the development runtime error overlay.
      toast.error(message);
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
