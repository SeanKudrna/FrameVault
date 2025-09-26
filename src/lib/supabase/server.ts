/**
 * Next.js server-side Supabase client factories. These helpers make it trivial
 * for route handlers and server components to read/write Supabase data while
 * automatically wiring cookie persistence.
 */

import { cookies } from "next/headers";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { getServerEnv } from "@/env";
import type { Database } from "./types";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

interface CookieOptions {
  path?: string;
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none" | true;
  maxAge?: number;
}

interface MutableCookieStore extends CookieStore {
  set?: (options: { name: string; value: string } & CookieOptions) => void;
  delete?: (name: string, options?: CookieOptions) => void;
}

/**
 * Creates a Supabase client configured for server-side execution within Next.js,
 * wiring cookie persistence so auth state survives across requests and server
 * actions. The cookie adapter gracefully handles calls from environments where
 * the cookie store is immutable (e.g., during rendering) by swallowing the
 * update with a development warning.
 */
export async function createSupabaseServerClient(cookieStore?: CookieStore) {
  const store = cookieStore ?? (await cookies());
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getServerEnv();

  const client = createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        const mutable = store as MutableCookieStore;
        if (typeof mutable.set === "function") {
          try {
            mutable.set({ name, value, ...(options ?? {}) });
          } catch (error) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("Skipping cookie.set outside a Server Action", error);
            }
          }
        }
      },
      remove(name: string, options?: CookieOptions) {
        const mutable = store as MutableCookieStore;
        try {
          if (typeof mutable.delete === "function") {
            mutable.delete(name, options);
          } else if (typeof mutable.set === "function") {
            mutable.set({ name, value: "", expires: new Date(0), ...(options ?? {}) });
          }
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Skipping cookie.remove outside a Server Action", error);
          }
        }
      },
    },
  });

  // We always pair getSession with getUser for verification, so suppress noisy warnings.
  (client.auth as typeof client.auth & { suppressGetSessionWarning?: boolean }).suppressGetSessionWarning = true;

  return client;
}

/**
 * Cached helper that reuses a single server client within a request lifecycle.
 * Wrapping with `cache` prevents redundant instantiations when multiple
 * components call the helper during a single request.
 */
export const getSupabaseServerClient = cache(async () => createSupabaseServerClient());
