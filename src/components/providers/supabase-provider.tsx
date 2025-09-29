"use client";

/**
 * Supabase Provider Component
 *
 * Central authentication and session management provider for the FrameVault application.
 * Handles complex auth state synchronization between Supabase, React state, and the UI.
 *
 * Core Responsibilities:
 * - Session verification and refresh on app initialization
 * - Real-time auth state synchronization with Supabase auth events
 * - Profile data fetching and caching with Realtime updates
 * - Automatic navigation based on authentication state
 * - Comprehensive session cleanup on sign-out
 * - Hydration-safe state management for SSR compatibility
 *
 * Authentication Flow:
 * 1. Initialize with server-provided session/profile data
 * 2. Verify session validity on client-side mount
 * 3. Listen for auth state changes (login/logout/token refresh)
 * 4. Fetch and sync profile data with database changes
 * 5. Handle authentication errors gracefully with fallbacks
 *
 * State Management Strategy:
 * - Multiple layers of state (session, profile, loading) for different UI needs
 * - Optimistic updates with error recovery mechanisms
 * - Persistent references to prevent unnecessary re-renders
 * - Cleanup handlers to prevent memory leaks
 *
 * Real-time Synchronization:
 * - Profile plan changes trigger immediate UI updates
 * - Automatic session refresh on token expiration
 * - Cross-tab session consistency via localStorage
 *
 * Error Handling:
 * - Graceful degradation for network failures
 * - Auth session missing errors treated as normal sign-out flow
 * - Comprehensive error logging for debugging
 * - User-friendly error messages through toast notifications
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
 * Session Verification Function
 *
 * Performs comprehensive session validation by checking both session existence
 * and user verification status. This ensures we have a fully authenticated state
 * before allowing access to protected features.
 *
 * Verification Process:
 * 1. Fetch current session from Supabase (may exist in storage but be expired)
 * 2. Verify the session's user still exists and is valid
 * 3. Return complete session object or null for unauthenticated state
 *
 * Error Handling Strategy:
 * - "Auth session missing" errors are treated as normal unauthenticated state
 * - Other errors are thrown for proper error boundary handling
 * - Graceful fallback ensures app doesn't crash on auth failures
 *
 * Security Considerations:
 * - Always verifies user existence, not just session validity
 * - Handles race conditions between session and user validation
 * - Provides consistent null return for all unauthenticated scenarios
 *
 * @param client - Supabase client instance
 * @returns Verified session with user data, or null if unauthenticated
 * @throws Error for unexpected auth failures (not session missing)
 */
async function fetchVerifiedSession(client: SupabaseClient<Database>): Promise<Session | null> {
  // Attempt to retrieve existing session (may be from localStorage)
  const sessionResult = await client.auth.getSession().catch((error) => {
    // Handle "session missing" as normal unauthenticated state
    if (isAuthSessionMissingError(error)) {
      return { data: { session: null }, error: null };
    }
    throw error; // Re-throw unexpected errors
  });

  if (sessionResult.error) throw sessionResult.error;

  const session = sessionResult.data.session;
  if (!session) {
    return null; // No session exists
  }

  // Verify the session's user still exists and is valid
  const userResult = await client.auth.getUser().catch((error) => {
    // Handle "session missing" as normal unauthenticated state
    if (isAuthSessionMissingError(error)) {
      return { data: { user: null }, error: null };
    }
    throw error; // Re-throw unexpected errors
  });

  if (userResult.error) throw userResult.error;

  const user = userResult.data.user ?? null;
  if (!user) {
    return null; // Session exists but user is invalid
  }

  // Return complete session with verified user
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
 * Supabase Provider Component Implementation
 *
 * The main provider component that orchestrates authentication state management.
 * Implements a complex initialization and synchronization flow to ensure
 * consistent auth state across server/client boundaries and real-time updates.
 *
 * Initialization Strategy:
 * - Accepts server-rendered session/profile data to prevent hydration mismatches
 * - Performs client-side session verification on mount
 * - Maintains loading states for proper UI rendering
 * - Tracks authentication history to handle navigation logic
 *
 * State Management Layers:
 * - `session`: Current Supabase session with user data
 * - `profile`: Extended user profile from database
 * - `loading`: Prevents UI flashes during initialization
 * - `hadSessionRef`: Tracks authentication state changes for navigation
 *
 * @param children - Child components that consume the Supabase context
 * @param initialSession - Server-provided session data (prevents hydration issues)
 * @param initialProfile - Server-provided profile data (prevents hydration issues)
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

  // Initialize Supabase client for browser environment
  const supabase = getSupabaseBrowserClient();

  // Core authentication state
  const [session, setSession] = useState<Session | null>(initialSession);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [loading, setLoading] = useState(!initialSession); // Start loading if no initial session

  /**
   * Authentication History Tracker
   *
   * Maintains reference to previous authentication state for navigation decisions.
   * Used to determine when to redirect users after login and handle auth flows.
   * Persists across re-renders to track state transitions.
   */
  const hadSessionRef = useRef(!!initialSession);

  /**
   * Authentication Initialization Effect
   *
   * Performs client-side session verification on component mount.
   * Ensures the server-provided session data is still valid and synchronizes
   * the client state accordingly. This prevents hydration mismatches and
   * handles cases where the server session may have expired.
   *
   * Initialization Flow:
   * 1. Verify the server-provided session is still valid
   * 2. Update client state with verified session data
   * 3. Clear profile if session is invalid
   * 4. Update authentication history tracker
   * 5. Handle errors gracefully without crashing the app
   *
   * Mount Safety:
   * - Uses `isMounted` flag to prevent state updates after unmount
   * - Catches and logs unexpected errors while treating session missing as normal
   * - Always sets loading to false when complete
   */
  useEffect(() => {
    let isMounted = true; // Prevent state updates after component unmount

    async function initialize() {
      try {
        // Verify server-provided session is still valid on client
        const verifiedSession = await fetchVerifiedSession(supabase);
        if (!isMounted) return;

        // Update authentication state
        setSession(verifiedSession);
        if (!verifiedSession) {
          setProfile(null); // Clear profile if session invalid
        }
        hadSessionRef.current = !!verifiedSession;
      } catch (error) {
        if (!isMounted) return;

        // Reset state on initialization failure
        setSession(null);
        setProfile(null);
        hadSessionRef.current = false;

        // Log unexpected errors (session missing is normal)
        if (error && !isAuthSessionMissingError(error)) {
          console.error("Supabase auth initialization failed", error);
        }
      } finally {
        // Always stop loading regardless of outcome
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    // Start initialization process
    initialize();

    /**
     * Auth State Change Listener
     *
     * Monitors Supabase authentication events and synchronizes React state accordingly.
     * Handles sign-in/sign-out events, token refreshes, and session validation.
     *
     * Event Handling:
     * - SIGNED_IN: Triggers navigation to app dashboard from auth pages
     * - SIGNED_OUT: Clears session and profile state
     * - TOKEN_REFRESHED: Updates session with new tokens
     *
     * Navigation Logic:
     * - Redirects to /app when signing in from auth or home pages
     * - Uses replace() to avoid back button navigation to auth pages
     *
     * State Synchronization:
     * - Updates authentication history for navigation decisions
     * - Clears profile data on sign-out
     * - Handles race conditions with mount state checks
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, sessionFromEvent) => {
      if (!isMounted) return;

      try {
        // Verify session validity, falling back to event-provided session if needed
        let verifiedSession = await fetchVerifiedSession(supabase);
        if (!verifiedSession && sessionFromEvent) {
          verifiedSession = sessionFromEvent;
        }
        if (!isMounted) return;

        // Track authentication state changes for navigation logic
        const wasAuthenticated = hadSessionRef.current;
        const isAuthenticated = !!verifiedSession;

        // Update authentication state
        setSession(verifiedSession);
        if (!verifiedSession) {
          setProfile(null); // Clear profile on sign-out
        }
        hadSessionRef.current = isAuthenticated;

        // Automatic navigation after successful sign-in
        if (!wasAuthenticated && isAuthenticated && event === "SIGNED_IN") {
          const currentPath = window.location.pathname;
          // Redirect from auth pages or home page to app dashboard
          if (currentPath.startsWith("/auth/") || currentPath === "/") {
            router.replace("/app");
          }
        }
      } catch (error) {
        if (!isMounted) return;
        // Reset state on sync failure
        setSession(null);
        setProfile(null);
        hadSessionRef.current = false;
        // Log unexpected errors (session missing is normal)
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
