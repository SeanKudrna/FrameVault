"use client";

/**
 * Thin wrapper around React Query that creates a client per browser session.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

/**
 * Provides a per-session React Query client and mounts devtools in non-production environments.
 */
export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV !== "production" ? <ReactQueryDevtools /> : null}
    </QueryClientProvider>
  );
}
