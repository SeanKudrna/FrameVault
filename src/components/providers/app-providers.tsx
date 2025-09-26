"use client";

/**
 * Composition root for all client-side providers. Keeps page/layout files tidy
 * by hiding the provider wiring in a single component.
 */

import type { Session } from "@supabase/supabase-js";
import type { Profile } from "@/lib/supabase/types";
import { ReactQueryProvider } from "./react-query-provider";
import { SupabaseProvider } from "./supabase-provider";
import { ToastProvider } from "./toast-provider";

/**
 * Props for the root provider composition component.
 */
interface AppProvidersProps {
  children: React.ReactNode;
  initialSession?: Session | null;
  initialProfile?: Profile | null;
}

/**
 * Mounts all global React providers (React Query, Toasts, Supabase) for the client subtree.
 */
export function AppProviders({
  children,
  initialSession = null,
  initialProfile = null,
}: AppProvidersProps) {
  return (
    <ReactQueryProvider>
      <ToastProvider>
        <SupabaseProvider initialSession={initialSession} initialProfile={initialProfile}>
          {children}
        </SupabaseProvider>
      </ToastProvider>
    </ReactQueryProvider>
  );
}
