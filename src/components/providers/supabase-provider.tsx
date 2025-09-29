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
  useRef,
  useState,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetSupabaseBrowserClient } from "@/lib/supabase/client";
import { signOutAction } from "@/app/(app)/actions";
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
  const sessionResult = await client.auth.getSession().catch((error) => {
    // Handle auth session missing errors gracefully
    if (isAuthSessionMissingError(error)) {
      return { data: { session: null }, error: null };
    }
    throw error;
  });
  if (sessionResult.error) throw sessionResult.error;

  const session = sessionResult.data.session;
  if (!session) {
    return null;
  }

  const userResult = await client.auth.getUser().catch((error) => {
    // Handle auth session missing errors gracefully
    if (isAuthSessionMissingError(error)) {
      return { data: { user: null }, error: null };
    }
    throw error;
  });
  if (userResult.error) throw userResult.error;

  const user = userResult.data.user ?? null;
  if (!user) {
    return null;
  }

  return { ...session, user } as Session;
}

function isAuthSessionMissingError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const message = "message" in error ? String((error as { message?: string }).message ?? "") : "";
  return message.includes("Auth session missing");
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
  const hadSessionRef = useRef(!!initialSession);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const verifiedSession = await fetchVerifiedSession(supabase);
        if (!isMounted) return;
        setSession(verifiedSession);
        if (!verifiedSession) {
          setProfile(null);
        }
        hadSessionRef.current = !!verifiedSession;
      } catch (error) {
        if (!isMounted) return;
        setSession(null);
        setProfile(null);
        hadSessionRef.current = false;
        if (error && !isAuthSessionMissingError(error)) {
          console.error("Supabase auth initialization failed", error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, sessionFromEvent) => {
      if (!isMounted) return;

      try {
        let verifiedSession = await fetchVerifiedSession(supabase);
        if (!verifiedSession && sessionFromEvent) {
          verifiedSession = sessionFromEvent;
        }
        if (!isMounted) return;

        const wasAuthenticated = hadSessionRef.current;
        const isAuthenticated = !!verifiedSession;

        setSession(verifiedSession);
        if (!verifiedSession) {
          setProfile(null);
        }
        hadSessionRef.current = isAuthenticated;

        // Navigate to app when user signs in and we're on an auth page
        if (!wasAuthenticated && isAuthenticated && event === "SIGNED_IN") {
          const currentPath = window.location.pathname;
          if (currentPath.startsWith("/auth/") || currentPath === "/") {
            router.replace("/app");
          }
        }
      } catch (error) {
        if (!isMounted) return;
        setSession(null);
        setProfile(null);
        hadSessionRef.current = false;
        if (error && !isAuthSessionMissingError(error)) {
          console.error("Supabase auth state sync failed", error);
        }
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
  }, [supabase, initialSession, router]);

  useEffect(() => {
    hadSessionRef.current = !!session;
  }, [session]);

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
      hadSessionRef.current = !!verifiedSession;
      return verifiedSession;
    } catch (error) {
      setSession(null);
      setProfile(null);
      hadSessionRef.current = false;
      if (isAuthSessionMissingError(error)) {
        return null;
      }
      throw error;
    }
  }, [supabase]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`profile-plan-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const next = (payload.new ?? null) as Profile | null;
          if (!next) {
            return;
          }
          setProfile((current) => {
            if (current && current.id === next.id && current.plan === next.plan) {
              return current;
            }
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabase, session?.user?.id]);

  const signOut = useCallback(async () => {
    try {
      await signOutAction();
    } catch (error) {
      console.error("Server sign out failed", error);
    }

    // Clear client state immediately
    setSession(null);
    setProfile(null);
    hadSessionRef.current = false;

    // Reset the Supabase client cache
    resetSupabaseBrowserClient();

    // Clear Supabase-related storage only, preserve user preferences
    if (typeof window !== "undefined") {
      try {
        // Clear sessionStorage completely
        sessionStorage.clear();

        // Clear localStorage selectively - only Supabase-related keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('supabase') || key.includes('sb-'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Clear Supabase-related cookies only
        document.cookie.split(";").forEach((cookie) => {
          const cookieName = cookie.split("=")[0].trim();
          if (cookieName.includes('supabase') || cookieName.includes('sb-')) {
            document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          }
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Navigate to a clean sign-out page that will redirect to home
    window.location.href = "/auth/sign-out";
  }, [router, supabase]);

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
