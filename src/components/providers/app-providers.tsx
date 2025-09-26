"use client";

import type { Session } from "@supabase/supabase-js";
import type { Profile } from "@/lib/supabase/types";
import { ReactQueryProvider } from "./react-query-provider";
import { SupabaseProvider } from "./supabase-provider";
import { ToastProvider } from "./toast-provider";

interface AppProvidersProps {
  children: React.ReactNode;
  initialSession?: Session | null;
  initialProfile?: Profile | null;
}

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
