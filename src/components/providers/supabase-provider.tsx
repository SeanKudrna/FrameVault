"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database, Profile } from "@/lib/supabase/types";

interface SupabaseContextValue {
  supabase: SupabaseClient<Database>;
  session: Session | null;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  loading: boolean;
  refreshSession: () => Promise<Session | null>;
  signOut: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export function SupabaseProvider({
  children,
  initialSession = null,
  initialProfile = null,
}: {
  children: React.ReactNode;
  initialSession?: Session | null;
  initialProfile?: Profile | null;
}) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(initialSession);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [loading, setLoading] = useState(!initialSession);

  useEffect(() => {
    let isMounted = true;
    if (!initialSession) {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!isMounted) return;
          setSession(data.session ?? null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }

    if (initialProfile) {
      setProfile(initialProfile);
    } else if (initialSession?.user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', initialSession.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!isMounted) return;
          setProfile((data as Profile | null) ?? null);
        })
        .catch(() => undefined);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, initialSession, initialProfile]);

  const refreshSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    setSession(data.session ?? null);
    return data.session ?? null;
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    router.replace("/");
  }, [supabase, router]);

  const value = useMemo(
    () => ({
      supabase,
      session,
      profile,
      setProfile,
      loading,
      refreshSession,
      signOut,
    }),
    [supabase, session, profile, loading, refreshSession, signOut]
  );

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return ctx;
}
