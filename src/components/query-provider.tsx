'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: how long data is considered fresh
            staleTime: 5 * 60 * 1000, // 5 minutes
            // Cache time: how long data stays in cache after component unmounts
            gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
            // Retry configuration
            retry: (failureCount, error: unknown) => {
              // Don't retry on 4xx errors (client errors)
              if (error && typeof error === 'object' && 'status' in error) {
                const statusError = error as { status: number };
                if (statusError.status >= 400 && statusError.status < 500) {
                  return false;
                }
              }
              // Retry up to 2 times for other errors
              return failureCount < 2;
            },
            // Refetch on window focus (disabled for better UX)
            refetchOnWindowFocus: false,
            // Refetch on reconnect
            refetchOnReconnect: true,
          },
          mutations: {
            // Retry mutations once on failure
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
