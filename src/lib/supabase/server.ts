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

export async function createSupabaseServerClient(cookieStore?: CookieStore) {
  const store = cookieStore ?? (await cookies());
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getServerEnv();

  return createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        const mutable = store as MutableCookieStore;
        mutable.set?.({ name, value, ...(options ?? {}) });
      },
      remove(name: string, options?: CookieOptions) {
        const mutable = store as MutableCookieStore;
        if (mutable.delete) {
          mutable.delete(name, options);
        } else if (mutable.set) {
          mutable.set({ name, value: "", expires: new Date(0), ...(options ?? {}) });
        }
      },
    },
  });
}

export const getSupabaseServerClient = cache(async () => createSupabaseServerClient());
