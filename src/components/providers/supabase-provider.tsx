"use client";

/**
 * Supabase context provider responsible for managing client-side auth state,
 * refreshing sessions, and exposing helper actions to the rest of the app.
 */

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

/**
 * Shape of the Supabase context shared across the application.
 */
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

/**
 * Fetches the current session and verified user concurrently, returning `null` if unauthenticated.
 */
async function fetchVerifiedSession(client: SupabaseClient<Database>): Promise<Session | null> {
  const [sessionResult, userResult] = await Promise.all([
    client.auth.getSession(),
    client.auth.getUser(),
  ]);

  if (sessionResult.error) throw sessionResult.error;
  if (userResult.error) throw userResult.error;

  const session = sessionResult.data.session;
  const user = userResult.data.user ?? null;

  if (!session || !user) {
    return null;
  }

  return { ...session, user } as Session;
}

/**
 * Wraps children with Supabase context, handling session verification and profile hydration.
 */
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

    async function initialize() {
      if (initialSession) {
        setLoading(false);
        return;
      }

      try {
        const verifiedSession = await fetchVerifiedSession(supabase);
        if (!isMounted) return;
        setSession(verifiedSession);
        if (!verifiedSession) {
          setProfile(null);
        }
      } catch {
        if (!isMounted) return;
        setSession(null);
        setProfile(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      if (!isMounted) return;
      try {
        const verifiedSession = await fetchVerifiedSession(supabase);
        if (!isMounted) return;
        setSession(verifiedSession);
        if (!verifiedSession) {
          setProfile(null);
        }
      } catch {
        if (!isMounted) return;
        setSession(null);
        setProfile(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, initialSession]);

  useEffect(() => {
    setProfile(initialProfile ?? null);
  }, [initialProfile]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      return;
    }
    if (profile?.id === userId) {
      return;
    }

    let active = true;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setProfile((data as Profile | null) ?? null);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [supabase, session?.user?.id, profile?.id]);

  const refreshSession = useCallback(async () => {
    try {
      const verifiedSession = await fetchVerifiedSession(supabase);
      setSession(verifiedSession);
      if (!verifiedSession) {
        setProfile(null);
      }
      return verifiedSession;
    } catch (error) {
      setSession(null);
      setProfile(null);
      throw error;
    }
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

/**
 * Hook for consuming the Supabase context. Throws when used outside of `SupabaseProvider`.
 */
export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return ctx;
}
